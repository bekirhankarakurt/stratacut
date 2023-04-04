from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.app.api.routes_pdf import router as pdf_router
from backend.app.api.routes_system import router as system_router
from backend.app.services.lan_rank_service import stop_lan_rank


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        from anyio.to_thread import current_default_thread_limiter

        current_default_thread_limiter().total_tokens = 16
    except Exception:
        pass
    yield
    stop_lan_rank()


app = FastAPI(title="PDF Splitter Pro", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pdf_router)
app.include_router(system_router)


@app.get("/api/health")
async def health():
    # apiVersion helps frontend detect stale/old backend instances.
    return {"ok": True, "apiVersion": 2, "features": {"splitRotate": True, "openPath": True}}


def _frontend_dist_dir() -> Path:
    override = os.getenv("PDFSPLITTER_FRONTEND_DIST")
    if override:
        return Path(override)
    if getattr(sys, "frozen", False):
        # PyInstaller onedir: bundled data is under sys._MEIPASS (typically .../_internal).
        # Older layouts or manual copies may use frontend/dist next to the exe.
        exe_dir = Path(sys.executable).resolve().parent
        meipass = getattr(sys, "_MEIPASS", None)
        candidates: list[Path] = []
        if meipass:
            candidates.append(Path(meipass) / "frontend" / "dist")
        candidates.extend(
            [
                exe_dir / "_internal" / "frontend" / "dist",
                exe_dir / "frontend" / "dist",
            ],
        )
        for p in candidates:
            if p.is_dir():
                return p
        return candidates[0]
    return Path(__file__).resolve().parents[2] / "frontend" / "dist"


dist_dir = _frontend_dist_dir()
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")


@app.get("/")
def index_fallback():
    if dist_dir.exists():
        return FileResponse(dist_dir / "index.html")
    return {"message": "Frontend build yok. Dev için: frontend/ altında npm run dev çalıştırın."}

