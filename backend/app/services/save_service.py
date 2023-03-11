from __future__ import annotations

import json
import sys
from pathlib import Path

SAVE_NAME = "PDFSplitterPro-save.json"
MAX_BYTES = 1_000_000


def save_file_path() -> Path:
    """Save lives next to the EXE so replacing the binary does not wipe progress."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent / SAVE_NAME
    return Path(__file__).resolve().parents[3] / SAVE_NAME


def read_save() -> dict | None:
    path = save_file_path()
    if not path.is_file():
        return None
    raw = path.read_bytes()
    if not raw or len(raw) > MAX_BYTES:
        return None
    data = json.loads(raw.decode("utf-8"))
    return data if isinstance(data, dict) else None


def _progress_xp(data: dict) -> int:
    prog = data.get("progress")
    if not isinstance(prog, dict):
        return 0
    try:
        return max(0, int(prog.get("xp") or 0))
    except (TypeError, ValueError):
        return 0


def write_save(data: dict) -> None:
    existing = read_save()
    if existing and _progress_xp(existing) > 0 and _progress_xp(data) == 0:
        return
    path = save_file_path()
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    encoded = text.encode("utf-8")
    if len(encoded) > MAX_BYTES:
        raise ValueError("Kayıt dosyası çok büyük.")
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_bytes(encoded)
    tmp.replace(path)


def delete_save() -> None:
    path = save_file_path()
    if path.is_file():
        path.unlink()
    tmp = path.with_suffix(".json.tmp")
    if tmp.is_file():
        tmp.unlink()
