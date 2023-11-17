$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"
$Png = Join-Path $Root "packaging\pdfsplitterpro-icon.png"
$Ico = Join-Path $Root "packaging\pdfsplitterpro.ico"

if (-not (Test-Path $Png)) {
    throw "Kaynak PNG yok: $Png"
}

if (-not (Test-Path $VenvPython)) {
    throw "venv yok. Once projeyi bir kez calistirin veya build-exe.ps1 calistirin."
}

& $VenvPython -m pip install pillow -q
& $VenvPython (Join-Path $Root "scripts\generate_icon.py") $Png $Ico
Write-Host "Icon hazir: $Ico" -ForegroundColor Green
