from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from pathlib import Path


def _is_remote_path(path: Path) -> bool:
    text = str(path)
    if text.startswith("\\\\") or text.startswith("//"):
        return True
    drive = os.path.splitdrive(text)[0]
    if len(drive) == 2 and drive[1] == ":":
        try:
            import ctypes

            DRIVE_REMOTE = 4
            return ctypes.windll.kernel32.GetDriveTypeW(f"{drive}\\") == DRIVE_REMOTE
        except Exception:
            return False
    return False


def _default_workdir() -> Path:
    if getattr(sys, "frozen", False):
        # Cache/temp next to the EXE when local. If the EXE lives on a network
        # share, write locally so thumbnail I/O cannot freeze the HTTP server.
        exe_dir = Path(sys.executable).resolve().parent
        if _is_remote_path(exe_dir):
            root = os.environ.get("LOCALAPPDATA") or str(Path.home())
            return Path(root) / "PDFSplitterPro" / "workdir"
        return exe_dir / "workdir"
    return Path(__file__).resolve().parents[3] / "workdir"


@dataclass(frozen=True)
class Settings:
    host: str = "127.0.0.1"
    default_thumb_width: int = 160
    default_image_width: int = 900
    max_thumb_width: int = 240
    max_image_width: int = 1100
    workdir: Path = field(default_factory=_default_workdir)


settings = Settings()

