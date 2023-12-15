from __future__ import annotations

import socket
import threading
import time
from pathlib import Path

import fitz
import uvicorn

from backend.app.core.config import settings
from backend.app.desktop_entry import health_ok
from backend.app.services.pdf_service import PageAdj, _adjust_pixmap, _render_page_pixmap, open_pdf


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = int(s.getsockname()[1])
    s.close()
    return port


def _make_pdf(path: Path, pages: int = 3) -> None:
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page(width=400, height=560)
        page.insert_text((40, 80), f"page {i + 1}")
    path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(path)
    doc.close()


def test_mirror_contrast_is_fast(tmp_path: Path) -> None:
    pdf = tmp_path / "t.pdf"
    _make_pdf(pdf)
    doc = fitz.open(pdf)
    page = doc.load_page(0)
    adj = PageAdj(rotate=90, mirror_h=True, mirror_v=True, contrast=1.4)
    t0 = time.perf_counter()
    pix = _render_page_pixmap(page, 900, adj)
    elapsed = time.perf_counter() - t0
    assert pix.width > 10 and pix.height > 10
    assert elapsed < 1.5, f"render too slow: {elapsed:.3f}s"
    out = _adjust_pixmap(pix, adj)
    assert out.width > 10
    doc.close()


def test_open_pdf_then_close(tmp_path: Path) -> None:
    object.__setattr__(settings, "workdir", tmp_path / "wd")
    pdf = tmp_path / "a.pdf"
    _make_pdf(pdf, 4)
    s1 = open_pdf(pdf, "a.pdf")
    assert s1.page_count == 4
    s2 = open_pdf(pdf, "b.pdf")
    assert s2.page_count == 4
    from backend.app.services import pdf_service

    assert s1.id not in pdf_service._sessions


def test_health_false_when_down() -> None:
    assert health_ok(port=59999, timeout=0.3) is False


def test_health_true_when_app_up() -> None:
    from backend.app.main import app

    port = _free_port()
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error", access_log=False)
    server = uvicorn.Server(config)

    def _run() -> None:
        server.run()

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    ok = False
    for _ in range(50):
        if health_ok(port=port, timeout=0.4):
            ok = True
            break
        time.sleep(0.1)
    server.should_exit = True
    t.join(timeout=4)
    assert ok, "health endpoint never came up"
