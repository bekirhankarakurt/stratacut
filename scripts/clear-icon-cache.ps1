# Windows ikon onbellegini temizler (Explorer eski simgeyi tutabiliyor).
$ErrorActionPreference = "SilentlyContinue"
Stop-Process -Name explorer -Force
Start-Sleep -Seconds 2
$local = "$env:LOCALAPPDATA\Microsoft\Windows\Explorer"
Get-ChildItem $local -Filter "iconcache*" | Remove-Item -Force
Get-ChildItem $local -Filter "thumbcache*" | Remove-Item -Force
Start-Process explorer
Write-Host "Ikon onbellegi temizlendi. dist klasorunu F5 ile yenileyin." -ForegroundColor Green
