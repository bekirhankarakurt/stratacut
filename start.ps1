# PDF Splitter Pro — tek komutla dev başlat
# Kullanım:  .\start.ps1

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host ""
Write-Host "  PDF Splitter Pro" -ForegroundColor Cyan
Write-Host "  ================" -ForegroundColor Cyan
Write-Host ""

$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Host "venv yok, olusturuluyor..." -ForegroundColor Yellow
    python -m venv (Join-Path $Root ".venv")
    & $VenvPython -m pip install -U pip
    & $VenvPython -m pip install -e $Root
}

$FrontendDir = Join-Path $Root "frontend"
if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "npm install..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    npm install
    Pop-Location
}

function Test-PortListen([int]$Port) {
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return [bool]$c
}

function Wait-HttpOk([string]$Url, [int]$TimeoutSec = 45) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    return $false
}

# Eski surecler portu tutuyorsa uyar (kullanici iki kez start.ps1 calistirinca tipik)
foreach ($port in 8001, 5173) {
    if (Test-PortListen $port) {
        Write-Host "Uyari: Port $port zaten acik — mevcut surec kullanilacak." -ForegroundColor Yellow
    }
}

$BackendCmd = "& '$VenvPython' -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8001 --reload"
$FrontendCmd = "Set-Location '$FrontendDir'; npm run dev"

if (-not (Test-PortListen 8001)) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $BackendCmd -WorkingDirectory $Root
} else {
    Write-Host "Backend zaten calisiyor, yeni pencere acilmiyor." -ForegroundColor Yellow
}

if (-not (Test-PortListen 5173)) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $FrontendCmd -WorkingDirectory $FrontendDir
} else {
    Write-Host "Frontend zaten calisiyor, yeni pencere acilmiyor." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Servisler hazir olana kadar bekleniyor..." -ForegroundColor Cyan

$backendOk = Wait-HttpOk "http://127.0.0.1:8001/api/health" 45
$frontendOk = Wait-HttpOk "http://127.0.0.1:5173/" 45

if ($backendOk) {
    Write-Host "Backend  -> http://127.0.0.1:8001  OK" -ForegroundColor Green
} else {
    Write-Host "Backend  -> HAZIR OLMADI (8001). Acilan PowerShell penceresindeki hataya bak." -ForegroundColor Red
}

if ($frontendOk) {
    Write-Host "Frontend -> http://127.0.0.1:5173  OK" -ForegroundColor Green
} else {
    Write-Host "Frontend -> HAZIR OLMADI (5173). Acilan PowerShell penceresindeki hataya bak." -ForegroundColor Red
    Write-Host "Ipucu: Port doluysa o pencereyi kapat veya: Get-NetTCPConnection -LocalPort 5173" -ForegroundColor Yellow
}

if ($frontendOk) {
    Write-Host ""
    Write-Host "Tarayici aciliyor..." -ForegroundColor Cyan
    Start-Process "http://127.0.0.1:5173/"
} else {
    Write-Host "Tarayici acilmadi — once frontend hatasini duzelt." -ForegroundColor Red
}

Write-Host ""
Write-Host "Durdurmak icin acilan PowerShell pencerelerini kapat." -ForegroundColor Yellow
Write-Host ""
