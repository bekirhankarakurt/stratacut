from __future__ import annotations

import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from backend.app.core.errors import ValidationError
from backend.app.services import pdf_service
from backend.app.services.save_service import delete_save, read_save, write_save
from backend.app.services.storage_service import normalize_output_dir
from backend.app.services.lan_rank_service import (
    clear_local_avatar,
    get_peer_avatar,
    local_identity,
    publish,
    schedule_scan_lan,
    set_local_avatar,
    snapshot,
    start_lan_rank,
)
from backend.app.models.schemas import (
    CursorPosRequest,
    CursorPosResponse,
    DeleteOutputRequest,
    DeleteOutputResponse,
    LanAvatarBody,
    LanBoardResponse,
    LanIdentityResponse,
    LanProfileBody,
    OutputScanRequest,
    OutputScanResponse,
    OutputScanFile,
    PickFolderResponse,
    PickPdfResponse,
    SaveBody,
    SaveResponse,
)

router = APIRouter(prefix="/api/system", tags=["system"])

_DELETE_NAME_RE = re.compile(r"^bolum_\d{3}_sayfa_.+\.pdf$", re.IGNORECASE)


def _tk():
    import tkinter as tk
    from tkinter import filedialog

    return tk, filedialog


@router.post("/pick-folder", response_model=PickFolderResponse)
def pick_folder():
    try:
        try:
            tk, filedialog = _tk()
        except Exception as e:  # noqa: BLE001
            raise ValidationError("Klasör seçici (tkinter) bu ortamda kullanılamıyor.") from e

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        path = filedialog.askdirectory(title="Çıktı klasörünü seçin")
        try:
            root.destroy()
        except Exception:
            pass
        return PickFolderResponse(path=path or None)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Klasör seçici açılamadı.")


@router.post("/pick-pdf", response_model=PickPdfResponse)
def pick_pdf():
    try:
        try:
            tk, filedialog = _tk()
        except Exception as e:  # noqa: BLE001
            raise ValidationError("PDF seçici (tkinter) bu ortamda kullanılamıyor.") from e

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        path = filedialog.askopenfilename(title="PDF seçin", filetypes=[("PDF", "*.pdf")])
        try:
            root.destroy()
        except Exception:
            pass
        return PickPdfResponse(path=path or None)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="PDF seçici açılamadı.")


@router.post("/delete-output", response_model=DeleteOutputResponse)
def delete_output(req: DeleteOutputRequest):
    """Delete a split output file produced by this app (bolum_XXX_sayfa_*.pdf only)."""
    try:
        filename = (req.filename or "").strip()
        if not filename:
            raise ValidationError("Dosya adı boş olamaz.")
        if "/" in filename or "\\" in filename or ".." in filename:
            raise ValidationError("Dosya adı geçersiz: yol ayracı veya '..' içeremez.")
        if Path(filename).name != filename:
            raise ValidationError("Dosya adı geçersiz.")
        if not _DELETE_NAME_RE.match(filename):
            raise ValidationError(
                "Sadece bu uygulamanın ürettiği bolum_XXX_sayfa_*.pdf dosyaları silinebilir."
            )

        out_dir = normalize_output_dir(req.outputDir)
        target = (out_dir / filename).resolve()
        try:
            target.relative_to(out_dir.resolve())
        except ValueError as e:
            raise ValidationError("Dosya hedef klasörün dışında olamaz.") from e

        if not target.exists() or not target.is_file():
            raise HTTPException(status_code=404, detail=f"Dosya bulunamadı: {filename}")

        target.unlink()
        return DeleteOutputResponse(ok=True)
    except HTTPException:
        raise
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Dosya silinemedi.")


_OUT_RE_RANGE = re.compile(r"^bolum_(\d{3})_sayfa_(\d+)-(\d+)\.pdf$", re.IGNORECASE)
# RLE sepet: 1+2+3+5+7-9+… veya (legacy) sadece 1+2+3+…
_OUT_RE_NAMED = re.compile(r"^bolum_(\d{3})_sayfa_(.+)\.pdf$", re.IGNORECASE)
_MAX_COVERED_EXPAND = 5000


def _pages_from_split_filename(name: str) -> tuple[int, set[int] | None] | None:
    """Return (section, pages) or (section, None) for hash tokens. None if not a split file."""
    m = _OUT_RE_RANGE.match(name)
    if m:
        sec = int(m.group(1))
        a = int(m.group(2))
        b = int(m.group(3))
        if a <= 0 or b <= 0:
            return sec, set()
        if a > b:
            a, b = b, a
        if b - a > _MAX_COVERED_EXPAND:
            return sec, set()
        return sec, set(range(a, b + 1))

    m3 = _OUT_RE_NAMED.match(name)
    if not m3:
        return None
    sec = int(m3.group(1))
    token = m3.group(2).strip()
    pset = pdf_service.parse_basket_token_to_pages(token)
    return sec, pset


def _scan_split_dir(out_dir: Path) -> tuple[set[int], list[tuple[int, int]], int, list[OutputScanFile]]:
    covered: set[int] = set()
    ranges: list[tuple[int, int]] = []
    max_section = 0
    files: list[OutputScanFile] = []
    try:
        entries = list(out_dir.iterdir())[:2500]
    except OSError:
        return covered, ranges, max_section, files
    for p in entries:
        if not p.is_file():
            continue
        parsed = _pages_from_split_filename(p.name)
        if parsed is None:
            continue
        sec, pset = parsed
        if sec > max_section:
            max_section = sec
        if pset is None or not pset:
            continue
        alo, ahi = min(pset), max(pset)
        ranges.append((alo, ahi))
        if len(pset) > _MAX_COVERED_EXPAND:
            kept = {x for x in sorted(pset)[:_MAX_COVERED_EXPAND] if x > 0}
        else:
            kept = {x for x in pset if x > 0}
        covered |= kept
        files.append(OutputScanFile(filename=p.name, pages=sorted(kept)))
    ranges.sort()
    return covered, ranges, max_section, files


@router.post("/scan-output", response_model=OutputScanResponse)
def scan_output(req: OutputScanRequest):
    """
    Scan output directory for bolum_XXX_sayfa_A-B.pdf, RLE sepet (1+2+3+5+7-9+…)
    and legacy sadece sayfa+sayfa+…, veya Hxxxxxxxx hash (bildirilmez, sayfa yok).
    Optional notFoundDir is scanned separately so those pages are Bulunamadı, not Yapıldı/Atlanan.
    """
    try:
        out_dir = normalize_output_dir(req.outputDir)
        covered, ranges, max_section, _files = _scan_split_dir(out_dir)

        nf_pages: set[int] = set()
        nf_max = 0
        nf_files: list[OutputScanFile] = []
        nf_raw = (req.notFoundDir or "").strip()
        if nf_raw:
            try:
                nf_dir = normalize_output_dir(nf_raw)
                same = False
                try:
                    same = nf_dir.resolve() == out_dir.resolve()
                except OSError:
                    same = str(nf_dir).lower() == str(out_dir).lower()
                if not same:
                    nf_covered, _nf_ranges, nf_max, nf_files = _scan_split_dir(nf_dir)
                    nf_pages = nf_covered
                    covered -= nf_pages
            except ValidationError:
                pass

        return OutputScanResponse(
            coveredPages=sorted(covered),
            ranges=ranges,
            maxSectionNo=max_section,
            notFoundPages=sorted(nf_pages),
            notFoundMaxSectionNo=nf_max,
            notFoundFiles=nf_files,
        )
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Çıktı klasörü taranamadı.")


@router.post("/cursor", response_model=CursorPosResponse)
def set_cursor(req: CursorPosRequest):
    """Move the OS pointer. Local desktop only — used by Enderman/spider effects."""
    try:
        import ctypes

        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(2)
        except Exception:
            try:
                ctypes.windll.user32.SetProcessDPIAware()
            except Exception:
                pass
        ctypes.windll.user32.SetCursorPos(int(req.x), int(req.y))
        return CursorPosResponse(ok=True)
    except Exception:  # noqa: BLE001
        return CursorPosResponse(ok=False)


@router.get("/save", response_model=SaveResponse)
def get_save():
    try:
        return SaveResponse(ok=True, data=read_save())
    except Exception:  # noqa: BLE001
        return SaveResponse(ok=True, data=None)


@router.put("/save", response_model=SaveResponse)
@router.post("/save", response_model=SaveResponse)
def put_save(req: SaveBody):
    try:
        if not isinstance(req.data, dict):
            raise ValidationError("Kayıt geçersiz.")
        write_save(req.data)
        return SaveResponse(ok=True, data=req.data)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=413, detail=str(e))
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Kayıt yazılamadı.")


@router.delete("/save", response_model=SaveResponse)
def erase_save():
    try:
        delete_save()
        return SaveResponse(ok=True, data=None)
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=500, detail="Kayıt silinemedi.")


@router.get("/identity", response_model=LanIdentityResponse)
def get_identity():
    ident = local_identity()
    return LanIdentityResponse(id=ident["id"], username=ident["username"], hostname=ident["hostname"])


@router.put("/lan-profile", response_model=LanBoardResponse)
@router.post("/lan-profile", response_model=LanBoardResponse)
def put_lan_profile(req: LanProfileBody):
    board = publish(req.model_dump())
    return LanBoardResponse(**board)


@router.put("/lan-avatar")
def put_lan_avatar(req: LanAvatarBody):
    try:
        if not (req.dataUrl or "").strip():
            stamp = clear_local_avatar()
            return {"ok": True, "avatarAt": stamp}
        stamp = set_local_avatar(req.dataUrl)
        return {"ok": True, "avatarAt": stamp}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception:
        raise HTTPException(status_code=500, detail="Profil fotoğrafı kaydedilemedi.")


@router.get("/lan-board", response_model=LanBoardResponse)
def get_lan_board():
    start_lan_rank()
    schedule_scan_lan()
    return LanBoardResponse(**snapshot())


@router.get("/lan-peer-avatar")
def get_lan_peer_avatar(ip: str = Query("", max_length=45), v: int = Query(0)):
    raw = get_peer_avatar(ip, v)
    if not raw:
        raise HTTPException(status_code=404, detail="Profil fotoğrafı yok.")
    return Response(
        content=raw,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"},
    )

