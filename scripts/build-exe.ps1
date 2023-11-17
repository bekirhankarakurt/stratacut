param(
  [string]$Python = "python"
)

$ErrorActionPreference = "Stop"

Write-Host "== PDF Splitter Pro: EXE build ==" -ForegroundColor Cyan

Push-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
Pop-Location

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Write-Host "Project root: $Root"

# 1) App icon (Windows .ico)
Write-Host "== Icon: PNG -> ICO ==" -ForegroundColor Cyan
& (Join-Path $Root "scripts\generate-icon.ps1")

# 2) Build frontend
Write-Host "== Frontend: npm install/build ==" -ForegroundColor Cyan
Push-Location (Join-Path $Root "frontend")
npm install
npm run build
Pop-Location

# 3) Create venv (if missing) & install deps
$Venv = Join-Path $Root ".venv"
if (-not (Test-Path $Venv)) {
  Write-Host "== Creating venv ==" -ForegroundColor Cyan
  & $Python -m venv $Venv
}

$VenvPython = Join-Path $Venv "Scripts\python.exe"
Write-Host "Using venv python: $VenvPython"

Write-Host "== Installing backend deps + PyInstaller ==" -ForegroundColor Cyan
& $VenvPython -m pip install -U pip
& $VenvPython -m pip install -e $Root
& $VenvPython -m pip install pyinstaller

# 4) Build EXE (onefile)
Write-Host "== PyInstaller ==" -ForegroundColor Cyan
Push-Location $Root
& $VenvPython -m PyInstaller (Join-Path $Root "packaging\pdfsplitterpro.spec") --noconfirm --clean
if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed with exit code $LASTEXITCODE" }
Pop-Location

# 5) rcedit onefile EXE'yi bozabiliyor (~330KB kalir) — sadece PyInstaller icon kullan.
# Icon: packaging/pdfsplitterpro.ico (generate-icon.ps1)

$DistExe = Join-Path $Root "dist\PDFSplitterPro-v2.exe"
if (Test-Path $DistExe) {
  $sizeMb = [math]::Round((Get-Item $DistExe).Length / 1MB, 1)
  if ((Get-Item $DistExe).Length -lt 20MB) {
    throw "EXE too small ($sizeMb MB) - build failed or corrupted."
  }
  Write-Host "EXE boyutu OK: $sizeMb MB" -ForegroundColor Green
}

Write-Host ""
Write-Host "DONE. Output file:" -ForegroundColor Green
Write-Host "  $Root\dist\PDFSplitterPro-v2.exe"

