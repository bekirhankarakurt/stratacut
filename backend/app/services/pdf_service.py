from __future__ import annotations

import gc
import hashlib
import re
import shutil
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Generator

import fitz  # PyMuPDF
from PIL import Image, ImageEnhance

from backend.app.core.config import settings
from backend.app.core.errors import ConflictError, NotFoundError, ValidationError
from backend.app.models.schemas import PageAdjustmentEntry
from backend.app.services.storage_service import ensure_workdir, normalize_output_dir


@dataclass(frozen=True)
class PageAdj:
    rotate: int = 0
    mirror_h: bool = False
    mirror_v: bool = False
    contrast: float = 1.0


def _clamp_contrast(value: float) -> float:
    return max(0.5, min(2.0, float(value)))


def _normalize_rotate(rotate: int) -> int:
    rotate = int(rotate) % 360
    if rotate not in (0, 90, 180, 270):
        raise ValidationError("Rotate sadece 0/90/180/270 olabilir.")
    return rotate


def _adj_from_entry(entry: PageAdjustmentEntry) -> PageAdj:
    return PageAdj(
        rotate=_normalize_rotate(entry.rotate),
        mirror_h=bool(entry.mirrorH),
        mirror_v=bool(entry.mirrorV),
        contrast=_clamp_contrast(entry.contrast),
    )


def _parse_page_adjustments(
    entries: list[PageAdjustmentEntry] | None,
) -> dict[int, PageAdj]:
    out: dict[int, PageAdj] = {}
    if not entries:
        return out
    for entry in entries:
        out[int(entry.page)] = _adj_from_entry(entry)
    return out


def _adj_for_page(
    page_1idx: int,
    adjustments: dict[int, PageAdj],
    global_rotate: int,
) -> PageAdj:
    if page_1idx in adjustments:
        return adjustments[page_1idx]
    return PageAdj(rotate=_normalize_rotate(global_rotate))


def _needs_raster(adj: PageAdj) -> bool:
    return adj.mirror_h or adj.mirror_v or abs(adj.contrast - 1.0) >= 0.01


def _pixmap_from_pil(img: Image.Image) -> fitz.Pixmap:
    if img.mode != "RGB":
        img = img.convert("RGB")
    w, h = img.size
    return fitz.Pixmap(fitz.csRGB, w, h, img.tobytes(), False)


def _adjust_pixmap(pix: fitz.Pixmap, adj: PageAdj) -> fitz.Pixmap:
    need_mirror = adj.mirror_h or adj.mirror_v
    need_contrast = abs(adj.contrast - 1.0) >= 0.01
    if not need_mirror and not need_contrast:
        return pix
    if pix.n not in (1, 3):
        pix = fitz.Pixmap(fitz.csRGB, pix)
    mode = "RGB" if pix.n == 3 else "L"
    img = Image.frombytes(mode, (pix.width, pix.height), pix.samples)
    if adj.mirror_h:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    if adj.mirror_v:
        img = img.transpose(Image.FLIP_TOP_BOTTOM)
    if need_contrast:
        img = ImageEnhance.Contrast(img).enhance(_clamp_contrast(adj.contrast))
    return _pixmap_from_pil(img)


def _render_page_pixmap(
    page: fitz.Page,
    width: int,
    adj: PageAdj,
) -> fitz.Pixmap:
    rect = page.rect
    scale = width / rect.width if rect.width else 1.0
    # Keep huge scanned pages from allocating hundreds of MB.
    max_h = max(80, int(rect.height * scale)) if rect.height else width
    if width * max_h > 2_400_000:
        scale *= (2_400_000 / max(1, width * max_h)) ** 0.5
    mat = fitz.Matrix(scale, scale).prerotate(adj.rotate)
    try:
        pix = page.get_pixmap(matrix=mat, alpha=False)
    except Exception:
        pix = page.get_pixmap(matrix=mat, alpha=False, colorspace=fitz.csRGB)
    if pix.n not in (1, 3):
        pix = fitz.Pixmap(fitz.csRGB, pix)
    return _adjust_pixmap(pix, adj)


def _insert_export_page(
    new_doc: fitz.Document,
    src_doc: fitz.Document,
    page_1idx: int,
    adj: PageAdj,
    raster_width: int = 1600,
) -> None:
    if not _needs_raster(adj):
        new_doc.insert_pdf(src_doc, from_page=page_1idx - 1, to_page=page_1idx - 1)
        if adj.rotate:
            new_doc.load_page(new_doc.page_count - 1).set_rotation(adj.rotate)
        return

    page = src_doc.load_page(page_1idx - 1)
    pix = _render_page_pixmap(page, raster_width, adj)
    try:
        new_page = new_doc.new_page(width=pix.width, height=pix.height)
        new_page.insert_image(new_page.rect, pixmap=pix)
    finally:
        del pix


@dataclass(frozen=True)
class PdfSession:
    id: str
    pdf_path: Path
    filename: str
    page_count: int


_sessions: dict[str, PdfSession] = {}
_render_sema = threading.Semaphore(2)
RENDER_POOL = ThreadPoolExecutor(max_workers=2, thread_name_prefix="pdf-render")
SPLIT_POOL = ThreadPoolExecutor(max_workers=1, thread_name_prefix="pdf-split")

# ---------------------------------------------------------------------------
# Per-session document cache
# ---------------------------------------------------------------------------
# Opening a large PDF (fitz.open) parses its cross-reference table, which can
# take 50–200 ms for 1000-page files.  Re-opening on every thumbnail request
# multiplies that cost by the page count.  We keep one open fitz.Document per
# session and protect it with a per-session lock so concurrent renders are
# serialised on that single handle (fitz is NOT thread-safe).
# split_pdf() intentionally opens its own handle to avoid blocking thumbnails
# during a potentially long export operation.
# ---------------------------------------------------------------------------
_doc_cache: dict[str, fitz.Document] = {}
_doc_cache_locks: dict[str, threading.Lock] = {}
_doc_cache_guard = threading.Lock()
_file_locks: dict[str, threading.Lock] = {}


def _lock_for_file(path: Path) -> threading.Lock:
    key = str(path)
    with _doc_cache_guard:
        lock = _file_locks.get(key)
        if lock is None:
            lock = threading.Lock()
            _file_locks[key] = lock
        return lock


@contextmanager
def _borrow_doc(session: PdfSession) -> Generator[fitz.Document, None, None]:
    """Yield the cached fitz.Document for *session*, held under its per-session lock."""
    with _doc_cache_guard:
        if session.id not in _doc_cache:
            _doc_cache[session.id] = fitz.open(session.pdf_path)
            _doc_cache_locks[session.id] = threading.Lock()
        doc = _doc_cache[session.id]
        lock = _doc_cache_locks[session.id]
    with lock:
        try:
            yield doc
        except Exception:
            try:
                doc.close()
            except Exception:
                pass
            with _doc_cache_guard:
                if _doc_cache.get(session.id) is doc:
                    _doc_cache.pop(session.id, None)
                    _doc_cache_locks.pop(session.id, None)
            raise


def _make_id_for_path(pdf_path: Path) -> str:
    h = hashlib.sha256(str(pdf_path).encode("utf-8")).hexdigest()[:16]
    return f"{h}-{uuid.uuid4().hex[:8]}"


def close_session(sid: str) -> None:
    with _doc_cache_guard:
        lock = _doc_cache_locks.get(sid)
        doc = _doc_cache.get(sid)
    if lock:
        with lock:
            if doc is not None:
                try:
                    doc.close()
                except Exception:
                    pass
            with _doc_cache_guard:
                if _doc_cache.get(sid) is doc:
                    _doc_cache.pop(sid, None)
                    _doc_cache_locks.pop(sid, None)
                _sessions.pop(sid, None)
    else:
        with _doc_cache_guard:
            _sessions.pop(sid, None)
            _doc_cache.pop(sid, None)
            _doc_cache_locks.pop(sid, None)


def close_other_sessions(keep_sid: str | None = None) -> None:
    with _doc_cache_guard:
        ids = [sid for sid in _sessions if sid != keep_sid]
    for sid in ids:
        close_session(sid)
    cache_root = settings.workdir / "cache"
    sessions_root = settings.workdir / "sessions"
    keep_file = ""
    if keep_sid:
        keep_sess = _sessions.get(keep_sid)
        if keep_sess:
            keep_file = str(keep_sess.pdf_path)
    if cache_root.is_dir():
        for p in cache_root.iterdir():
            if keep_sid and p.name == keep_sid:
                continue
            shutil.rmtree(p, ignore_errors=True)
    if sessions_root.is_dir():
        for p in sessions_root.iterdir():
            if keep_file and str(p) == keep_file:
                continue
            try:
                p.unlink()
            except OSError:
                pass
    gc.collect()


def open_pdf(pdf_path: Path, filename: str | None = None) -> PdfSession:
    ensure_workdir()
    doc = fitz.open(pdf_path)
    try:
        page_count = doc.page_count
    finally:
        doc.close()

    if page_count <= 0:
        raise ValidationError("PDF sayfa sayısı okunamadı.")

    sid = _make_id_for_path(pdf_path)
    session = PdfSession(
        id=sid,
        pdf_path=pdf_path,
        filename=(filename or pdf_path.name),
        page_count=page_count,
    )
    with _doc_cache_guard:
        _sessions[sid] = session
    close_other_sessions(keep_sid=sid)
    return session


def get_session(sid: str) -> PdfSession:
    session = _sessions.get(sid)
    if not session:
        raise NotFoundError("PDF oturumu bulunamadı. Lütfen PDF'i tekrar açın.")
    return session


def _render_page_image(
    session: PdfSession,
    page_number_1idx: int,
    width: int,
    cache_subdir: str,
    rotate: int = 0,
    mirror_h: bool = False,
    mirror_v: bool = False,
    contrast: float = 1.0,
) -> Path:
    if page_number_1idx < 1 or page_number_1idx > session.page_count:
        raise ValidationError("Sayfa numarası aralık dışında.")

    width = max(50, int(width))
    adj = PageAdj(
        rotate=_normalize_rotate(rotate),
        mirror_h=bool(mirror_h),
        mirror_v=bool(mirror_v),
        contrast=_clamp_contrast(contrast),
    )
    ensure_workdir()

    c_key = int(round(adj.contrast * 100))
    cache_dir = (
        settings.workdir
        / "cache"
        / session.id
        / cache_subdir
        / str(width)
        / f"r{adj.rotate}_mh{int(adj.mirror_h)}_mv{int(adj.mirror_v)}_c{c_key}"
    )
    cache_dir.mkdir(parents=True, exist_ok=True)
    out_path = cache_dir / f"{page_number_1idx}.jpg"
    with _render_sema:
        with _lock_for_file(out_path):
            if out_path.exists() and out_path.stat().st_size > 32:
                return out_path
            with _borrow_doc(session) as doc:
                page = doc.load_page(page_number_1idx - 1)
                pix = _render_page_pixmap(page, width, adj)
            tmp_path = out_path.with_name(f"{out_path.stem}.{threading.get_ident()}.tmp.jpg")
            quality = 52 if cache_subdir == "thumb" else 72
            try:
                pix.save(tmp_path, jpg_quality=quality)
            except TypeError:
                pix.save(tmp_path)
            del pix
            tmp_path.replace(out_path)
            return out_path


def get_thumbnail_path(
    session: PdfSession,
    page_number_1idx: int,
    width: int,
    rotate: int = 0,
    mirror_h: bool = False,
    mirror_v: bool = False,
    contrast: float = 1.0,
) -> Path:
    return _render_page_image(
        session,
        page_number_1idx,
        width,
        cache_subdir="thumb",
        rotate=rotate,
        mirror_h=mirror_h,
        mirror_v=mirror_v,
        contrast=contrast,
    )


def render_thumbnail(
    sid: str,
    page: int,
    width: int,
    rotate: int = 0,
    mirror_h: bool = False,
    mirror_v: bool = False,
    contrast: float = 1.0,
) -> Path:
    session = get_session(sid)
    return get_thumbnail_path(
        session,
        page,
        min(max(50, int(width)), settings.max_thumb_width),
        rotate=rotate,
        mirror_h=mirror_h,
        mirror_v=mirror_v,
        contrast=contrast,
    )


def render_preview_image(
    sid: str,
    page: int,
    width: int,
    rotate: int = 0,
    mirror_h: bool = False,
    mirror_v: bool = False,
    contrast: float = 1.0,
) -> Path:
    session = get_session(sid)
    return get_image_path(
        session,
        page,
        min(max(50, int(width)), settings.max_image_width),
        rotate=rotate,
        mirror_h=mirror_h,
        mirror_v=mirror_v,
        contrast=contrast,
    )


def get_image_path(
    session: PdfSession,
    page_number_1idx: int,
    width: int,
    rotate: int = 0,
    mirror_h: bool = False,
    mirror_v: bool = False,
    contrast: float = 1.0,
) -> Path:
    return _render_page_image(
        session,
        page_number_1idx,
        width,
        cache_subdir="image",
        rotate=rotate,
        mirror_h=mirror_h,
        mirror_v=mirror_v,
        contrast=contrast,
    )


# Max length for sayfa token (Windows path friendly; RLE "1+2+3+5+7-9+...").
SAYFA_TOKEN_MAX_LEN = 200
HASH_PREFIX = "H"


def _build_split_filename(
    section_no: int,
    start: int,
    end: int,
    exported: list[int] | None = None,
) -> str:
    """Range mode: start–end if the span is contiguous; otherwise RLE of actually exported pages."""
    sec = str(section_no).zfill(3)
    if exported:
        uniq = sorted({int(x) for x in exported})
        expected = end - start + 1
        if uniq and (len(uniq) != expected or uniq[0] != start or uniq[-1] != end):
            token = encode_basket_token_for_filename(uniq)
            return f"bolum_{sec}_sayfa_{token}.pdf"
    return f"bolum_{sec}_sayfa_{start}-{end}.pdf"


def _build_basket_filename(section_no: int, token: str) -> str:
    sec = str(section_no).zfill(3)
    return f"bolum_{sec}_sayfa_{token}.pdf"


def _unique_preserve(page_list: list[int]) -> list[int]:
    seen: set[int] = set()
    out: list[int] = []
    for p in page_list:
        p = int(p)
        if p in seen:
            continue
        seen.add(p)
        out.append(p)
    return out


def encode_basket_token_for_filename(sorted_pages: list[int]) -> str:
    """
    Reversible RLE: consecutive runs become a-b, segments joined with +.
    If too long, H + 8 hex(sha256 of full sorted list) (then scan cannot mark per-page; rare).
    """
    if not sorted_pages:
        raise ValidationError("Sepet boş olamaz.")
    s = sorted(set(int(x) for x in sorted_pages))
    segs: list[str] = []
    i = 0
    n = len(s)
    while i < n:
        j = i
        while j + 1 < n and s[j + 1] == s[j] + 1:
            j += 1
        if j > i:
            segs.append(f"{s[i]}-{s[j]}")
        else:
            segs.append(f"{s[i]}")
        i = j + 1
    token = "+".join(segs)
    if len(token) > SAYFA_TOKEN_MAX_LEN:
        h = hashlib.sha256(",".join(str(x) for x in s).encode("utf-8")).hexdigest()[:8]
        return f"{HASH_PREFIX}{h}"
    return token


def parse_basket_token_to_pages(token: str) -> set[int] | None:
    """None if H-hash (unknown per-page set). Empty set for empty. Raise nothing from scan: returns None on parse error."""
    t = token.strip()
    if not t:
        return set()
    if t.startswith(HASH_PREFIX) and len(t) == 1 + 8 and all(
        c in "0123456789abcdef" for c in t[1:].lower()
    ):
        return None
    try:
        return _parse_basket_rle(t)
    except ValueError:
        return None


def _parse_basket_rle(t: str) -> set[int]:
    out: set[int] = set()
    for part in t.split("+"):
        part = part.strip()
        if not part:
            continue
        m = re.match(r"^(\d+)-(\d+)$", part)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            if a > b:
                a, b = b, a
            for x in range(a, b + 1):
                out.add(x)
            continue
        if re.match(r"^\d+$", part):
            out.add(int(part))
            continue
        raise ValueError(f"Geçersiz sepet token parçası: {part!r}")
    return out


def _pages_to_export(
    start_page_1idx: int,
    end_page_1idx: int,
    excluded_pages: list[int] | None,
    session_page_count: int,
) -> list[int]:
    if start_page_1idx > end_page_1idx:
        raise ValidationError("Başlangıç sayfası bitiş sayfasından büyük olamaz.")
    if start_page_1idx < 1 or end_page_1idx > session_page_count:
        raise ValidationError("Sayfa aralığı PDF sayfa sayısı dışında.")
    base = list(range(start_page_1idx, end_page_1idx + 1))
    if not excluded_pages:
        return base
    ex_set = {int(p) for p in excluded_pages}
    for p in ex_set:
        if p < start_page_1idx or p > end_page_1idx:
            raise ValidationError(
                f"Hariç tutulacak sayfalar [{start_page_1idx}, {end_page_1idx}] aralığında olmalı: {p} uygun değil."
            )
        if p < 1 or p > session_page_count:
            raise ValidationError("Hariç tutulacak sayfa PDF sınırları dışında.")
    out = [p for p in base if p not in ex_set]
    if not out:
        raise ValidationError("En az bir sayfa dışa aktarılmalı; tüm sayfaları hariç tutamazsınız.")
    return out


def _order_pages_with_leads(
    pages: list[int],
    first_page_1idx: int | None,
    second_page_1idx: int | None,
    *,
    sort_rest: bool,
) -> list[int]:
    """Put first/second pages at the start of the output; rest keeps order or is sorted."""
    if (
        first_page_1idx is not None
        and second_page_1idx is not None
        and first_page_1idx == second_page_1idx
    ):
        raise ValidationError("İkinci sayfa, ilk sayfa ile aynı olamaz.")

    used: set[int] = set()
    lead: list[int] = []

    if first_page_1idx is not None:
        lead.append(first_page_1idx)
        used.add(first_page_1idx)
    elif second_page_1idx is not None:
        remaining = [p for p in pages if p != second_page_1idx]
        if remaining:
            default_first = min(remaining) if sort_rest else remaining[0]
            lead.append(default_first)
            used.add(default_first)

    if second_page_1idx is not None:
        lead.append(second_page_1idx)
        used.add(second_page_1idx)

    rest = [p for p in pages if p not in used]
    if sort_rest:
        rest = sorted(rest)
    return lead + rest


def split_pdf(
    session: PdfSession,
    start_page_1idx: int,
    end_page_1idx: int,
    section_no: int,
    output_dir: str,
    first_page_1idx: int | None = None,
    second_page_1idx: int | None = None,
    rotate: int = 0,
    allow_overwrite: bool = False,
    excluded_pages: list[int] | None = None,
    page_adjustments: list[PageAdjustmentEntry] | None = None,
) -> tuple[Path, int, int]:
    pages_list = _pages_to_export(
        start_page_1idx,
        end_page_1idx,
        excluded_pages,
        session.page_count,
    )
    if first_page_1idx is not None:
        if first_page_1idx < start_page_1idx or first_page_1idx > end_page_1idx:
            raise ValidationError("İlk sayfa seçimi, seçilen aralığın içinde olmalı.")
        if first_page_1idx not in pages_list:
            raise ValidationError("İlk sayfa hariç tutulmuş; dışa aktarılan sayfalar arasında olmalı.")
    if second_page_1idx is not None:
        if second_page_1idx < start_page_1idx or second_page_1idx > end_page_1idx:
            raise ValidationError("İkinci sayfa seçimi, seçilen aralığın içinde olmalı.")
        if second_page_1idx not in pages_list:
            raise ValidationError("İkinci sayfa hariç tutulmuş; dışa aktarılan sayfalar arasında olmalı.")
    rotate = _normalize_rotate(rotate)
    adj_map = _parse_page_adjustments(page_adjustments)

    pages_ordered = _order_pages_with_leads(
        pages_list,
        first_page_1idx,
        second_page_1idx,
        sort_rest=True,
    )

    out_dir = normalize_output_dir(output_dir)
    filename = _build_split_filename(section_no, start_page_1idx, end_page_1idx, pages_list)
    final_path = out_dir / filename
    if final_path.exists() and not allow_overwrite:
        raise ConflictError("Bu isimde bir dosya zaten var. Üzerine yazma engellendi.")

    doc = fitz.open(session.pdf_path)
    try:
        new_doc = fitz.open()
        try:
            for p in pages_ordered:
                adj = _adj_for_page(p, adj_map, rotate)
                _insert_export_page(new_doc, doc, p, adj)

            # Ensure page labels start from 1 in the output PDF (intern-friendly).
            try:
                new_doc.set_page_labels(
                    [
                        {
                            "startpage": 0,
                            "style": "D",
                            "prefix": "",
                            "firstpagenum": 1,
                        }
                    ]
                )
            except Exception:
                # Page labels are optional; ignore if not supported by this build.
                pass

            tmp_path = final_path.with_suffix(".tmp.pdf")
            new_doc.save(tmp_path)
            tmp_path.replace(final_path)
            span_lo = min(pages_ordered)
            span_hi = max(pages_ordered)
            return final_path, span_lo, span_hi
        finally:
            new_doc.close()
    finally:
        doc.close()


def split_pdf_basket(
    session: PdfSession,
    basket_pages_1idx: list[int],
    section_no: int,
    output_dir: str,
    first_page_1idx: int | None = None,
    second_page_1idx: int | None = None,
    rotate: int = 0,
    allow_overwrite: bool = False,
    page_adjustments: list[PageAdjustmentEntry] | None = None,
) -> tuple[Path, int, int]:
    """Export the basket (unique, order kept); output name uses RLE token of the full set."""
    pages_order = _unique_preserve(basket_pages_1idx)
    if not pages_order:
        raise ValidationError("Sepet en az bir sayfa içermeli.")
    for p in pages_order:
        if p < 1 or p > session.page_count:
            raise ValidationError(f"Sepetteki sayfa PDF sınırları dışında: {p}")

    sset = set(pages_order)
    token = encode_basket_token_for_filename(list(sset))
    rotate = _normalize_rotate(rotate)
    adj_map = _parse_page_adjustments(page_adjustments)

    if first_page_1idx is not None:
        if first_page_1idx < 1 or first_page_1idx > session.page_count:
            raise ValidationError("İlk sayfa PDF sınırları dışında.")
        if first_page_1idx not in sset:
            raise ValidationError("İlk sayfa, sepetteki sayfalardan biri olmalı.")
    if second_page_1idx is not None:
        if second_page_1idx < 1 or second_page_1idx > session.page_count:
            raise ValidationError("İkinci sayfa PDF sınırları dışında.")
        if second_page_1idx not in sset:
            raise ValidationError("İkinci sayfa, sepetteki sayfalardan biri olmalı.")
    pages_export = _order_pages_with_leads(
        pages_order,
        first_page_1idx,
        second_page_1idx,
        sort_rest=False,
    )

    out_dir = normalize_output_dir(output_dir)
    filename = _build_basket_filename(section_no, token)
    final_path = out_dir / filename
    if final_path.exists() and not allow_overwrite:
        raise ConflictError("Bu isimde bir dosya zaten var. Üzerine yazma engellendi.")

    doc = fitz.open(session.pdf_path)
    try:
        new_doc = fitz.open()
        try:
            for p in pages_export:
                adj = _adj_for_page(p, adj_map, rotate)
                _insert_export_page(new_doc, doc, p, adj)

            try:
                new_doc.set_page_labels(
                    [
                        {
                            "startpage": 0,
                            "style": "D",
                            "prefix": "",
                            "firstpagenum": 1,
                        }
                    ]
                )
            except Exception:
                pass

            tmp_path = final_path.with_suffix(".tmp.pdf")
            new_doc.save(tmp_path)
            tmp_path.replace(final_path)
            span_lo = min(pages_export)
            span_hi = max(pages_export)
            return final_path, span_lo, span_hi
        finally:
            new_doc.close()
    finally:
        doc.close()

