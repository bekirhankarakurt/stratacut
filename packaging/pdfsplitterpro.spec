# PyInstaller spec for PDF Splitter Pro (Windows)
# Target: single-file EXE (--onefile), no console window (--noconsole).
#
# Build with:
#   python -m PyInstaller packaging/pdfsplitterpro.spec --noconfirm --clean
# (or use scripts/build-exe.ps1 which does the full npm + venv + pyinstaller flow)

from __future__ import annotations

from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_submodules

# NOTE: PyInstaller executes the spec via exec() without defining __file__.
# Rely on the working directory; always run PyInstaller from the project root.
project_root = Path.cwd().resolve()
frontend_dist = project_root / "frontend" / "dist"
icon_file = project_root / "packaging" / "pdfsplitterpro.ico"

# ── Python hidden imports ────────────────────────────────────────────────────
hiddenimports = collect_submodules("backend")

# ── PyMuPDF (fitz) – collect native libs + hooks explicitly ─────────────────
# collect_all() returns (datas, binaries, hiddenimports) for the package.
# This ensures the compiled fitz extension and its data files are bundled.
fitz_datas, fitz_binaries, fitz_hiddenimports = collect_all("fitz")
hiddenimports += fitz_hiddenimports
pil_datas, pil_binaries, pil_hiddenimports = collect_all("PIL")
hiddenimports += pil_hiddenimports

# ── Data files ───────────────────────────────────────────────────────────────
datas = list(fitz_datas) + list(pil_datas)
if frontend_dist.exists():
    # Bundled under frontend/dist so _frontend_dist_dir() finds it via sys._MEIPASS.
    datas.append((str(frontend_dist), "frontend/dist"))

a = Analysis(
    [str(project_root / "backend" / "app" / "desktop_entry.py")],
    pathex=[str(project_root)],
    binaries=list(fitz_binaries) + list(pil_binaries),
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

# ── Single-file EXE ──────────────────────────────────────────────────────────
# Pass a.binaries and a.datas directly into EXE (no COLLECT) → --onefile mode.
# console=False  → --noconsole (no terminal window on Windows).
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="PDFSplitterPro-v2",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    icon=str(icon_file) if icon_file.is_file() else None,
)

