from __future__ import annotations

import os
from pathlib import Path

from backend.app.core.config import settings
from backend.app.core.errors import ValidationError


def ensure_workdir() -> Path:
    settings.workdir.mkdir(parents=True, exist_ok=True)
    (settings.workdir / "cache").mkdir(parents=True, exist_ok=True)
    (settings.workdir / "sessions").mkdir(parents=True, exist_ok=True)
    return settings.workdir


def normalize_existing_file_path(path_str: str) -> Path:
    p = Path(path_str).expanduser()
    try:
        p = p.resolve(strict=True)
    except FileNotFoundError as e:
        raise ValidationError(f"PDF bulunamadı: {path_str}") from e
    if not p.is_file():
        raise ValidationError(f"PDF dosyası değil: {path_str}")
    if p.suffix.lower() != ".pdf":
        raise ValidationError("Sadece .pdf dosyaları desteklenir.")
    return p


def normalize_output_dir(path_str: str) -> Path:
    if not path_str:
        raise ValidationError("Çıktı klasörü boş olamaz.")
    p = Path(path_str).expanduser()
    p = p.resolve()
    if not p.exists():
        raise ValidationError("Çıktı klasörü bulunamadı.")
    if not p.is_dir():
        raise ValidationError("Çıktı yolu bir klasör olmalı.")
    if not os.access(p, os.W_OK):
        raise ValidationError("Çıktı klasörüne yazma izni yok.")
    return p

