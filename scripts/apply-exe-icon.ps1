param(
  [string]$ExePath = "",
  [string]$IcoPath = ""
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $ExePath) { $ExePath = Join-Path $Root "dist\PDFSplitterPro-v2.exe" }
if (-not $IcoPath) { $IcoPath = Join-Path $Root "packaging\pdfsplitterpro.ico" }

if (-not (Test-Path $ExePath)) { throw "EXE yok: $ExePath" }
if (-not (Test-Path $IcoPath)) { throw "ICO yok: $IcoPath" }

$RceditDir = Join-Path $Root "tools\rcedit"
$RceditExe = Join-Path $RceditDir "rcedit-x64.exe"
if (-not (Test-Path $RceditExe)) {
  New-Item -ItemType Directory -Force -Path $RceditDir | Out-Null
  $Zip = Join-Path $env:TEMP "rcedit.zip"
  $Url = "https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe"
  Write-Host "rcedit indiriliyor..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri $Url -OutFile $RceditExe -UseBasicParsing
}

Write-Host "EXE ikonu zorla guncelleniyor..." -ForegroundColor Cyan
& $RceditExe $ExePath --set-icon $IcoPath
if ($LASTEXITCODE -ne 0) { throw "rcedit basarisiz (exit $LASTEXITCODE)" }

Write-Host "Icon uygulandi: $ExePath" -ForegroundColor Green
