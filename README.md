# PDF Splitter Pro

Yerelde çalışan web arayüzü ile büyük PDF’leri önizleyip sayfa aralığına göre parçalayan uygulama.

## Hızlı başlat (unutma bunu)

Proje klasöründe:

```powershell
.\start.ps1
```

Tarayıcı: `http://127.0.0.1:5173/` — Durdurmak için açılan 2 PowerShell penceresini kapat.

## Dev çalıştırma (manuel)

Backend:

```powershell
python -m pip install -e .
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8001 --reload
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

UI: `http://127.0.0.1:5173/`

## EXE (Windows) build

Bu yöntemle hedef PC'lerde Python/Node kurmadan çalıştırabilirsiniz (portable klasör).

Gerekenler (sadece build alınan PC'de):
- Python 3.10+ (öneri: 3.11/3.12)
- Node.js (LTS önerilir)

Build:

```powershell
cd c:\projects\pdfsplitterpro
.\scripts\build-exe.ps1
```

Çıktı:
- `dist\PDFSplitterPro\PDFSplitterPro.exe`

Kodu güncelledikten sonra **yeni EXE** için yine aynı komutu çalıştırmanız yeterli: `.\scripts\build-exe.ps1` (eski `dist\PDFSplitterPro` üzerine yazar).

Dağıtım:
- `dist\PDFSplitterPro\` klasörünü **komple** zipleyip diğer PC'ye kopyalayın (`PDFSplitterPro.exe` ile birlikte `_internal` klasörü şart; silinirse arayüz gelmez).
- Bu paket **Windows x64** içindir (PyMuPDF tekerleği). Kod güncelledikten sonra EXE’yi yeniden üretin: `.\scripts\build-exe.ps1`

