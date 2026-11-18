# StrataCut

A local desktop app for previewing large PDFs and splitting them by page ranges, wrapped in a playful Minecraft-inspired, gamified UI.

StrataCut keeps the PDF on your machine. A React dashboard talks to a FastAPI service on localhost. PyMuPDF renders thumbnails and writes the split files into a folder you choose.

## Features

### PDF workflow

- **Upload.** Drop a `.pdf` onto the dashboard or pick one with the file input. The API accepts only `.pdf` files and rejects empty uploads. `POST /api/pdf/open-path` can also open a PDF that is already on disk.
- **Thumbnails and preview.** Page thumbnails and a larger JPEG preview are rendered on demand. The preview supports zoom, pan, and jump-to-page.
- **Range mode.** Choose an inclusive start page and end page. Output pages are ordered with an optional first page and second page at the front, then the remaining pages in numeric order.
- **Excluded pages.** Inside a range, skip pages with the spec parser in `frontend/src/utils/pageSpec.ts`. Tokens are separated by commas, semicolons, or whitespace. A token is a single page or an inclusive range (either order):

  ```text
  4, 7-9; 12
  ```

  `7-9` and `9-7` both mean pages 7, 8, and 9. Every excluded page must sit inside the start–end range and inside `1 … page count`. At least one page in the range must remain.
- **Basket mode.** Click thumbnails to collect pages in click order. Duplicates are dropped. The same first-page and second-page lead rules apply, and the rest of the basket keeps selection order.
- **Per-page adjustments.** Rotate a page by 0°, 90°, 180°, or 270°, mirror it horizontally or vertically, and set contrast between 0.5 and 2.0. Rotation alone stays in the PDF page tree. Mirror or contrast rasterizes that page into the export.
- **Skipped pages.** Mark pages as skipped, filter that list with the same page and range syntax, send the selection to the basket, or export it to its own folder.
- **Not-found pages.** Mark a previewed page as not found and export that set to a separate folder. A folder scan treats those files as not-found rather than done.
- **Save to disk.** Each export is a new PDF in the chosen output directory, named `bolum_XXX_sayfa_….pdf` (section number padded to three digits). A full contiguous range uses `start-end`. A range with gaps, and every basket export, uses a reversible run-length token: consecutive pages become `a-b`, and segments are joined with `+` (for example `1+2+3+5+7-9`). If that token is longer than 200 characters, the name uses `H` plus the first 8 hex characters of a SHA-256 of the sorted page list. Existing files are left in place unless overwrite is allowed. The app can delete only files that match this naming pattern, and it can rescan the output folder to mark pages already saved.

### Gamified layer

Progress, coins, inventory, and profile live in the browser and are mirrored to a JSON save file on disk.

- **XP and ranks.** Splits, opened PDFs, and related actions grant XP. Level thresholds grow with level. Ranks run from Yeni Madenci up through titles such as Usta, Efsane, and PDFCraft Efsanesi.
- **Achievements.** Thresholds cover splits, pages saved, PDFs opened, sessions, not-found exports, skipped exports, and one-off goals such as a profile photo or a written bio. Unlocks show a popup.
- **Shop.** Coins buy cursor tools, food, potions, armor, and timed talismans. Equipped tools change the cursor. Hearts, a day/night clock, mobs, and an optional deadly mode sit on top of the PDF workspace. Death drops half of the XP in the current level.
- **Profiles and avatars.** Set a display name (up to 24 characters), a bio (up to 140 characters), and a profile photo. Photos are cropped to a 128×128 JPEG.
- **LAN ranks.** Other copies on the same private network can appear on a leaderboard with level, XP, and the public profile fields listed under Privacy.
- **Keyboard shortcuts.** Defaults, rebound in the shortcuts modal (no Ctrl, Alt, or Meta): `B` first page, `N` second page, `F` mark not found, `S` split and save, `R` rotate 90° clockwise, `Backspace` twice to delete the last output. Shortcuts are ignored while typing in a field.
- **Themes and graphics.** Classic and Minecraft themes (a theme change reloads the UI), graphics quality high / medium / low, panel opacity, night mobs, and deadly mode.

## Tech stack

- **Backend:** Python 3.10+, FastAPI, Uvicorn, Pydantic v2, PyMuPDF, Pillow, python-multipart
- **Frontend:** React 18, TypeScript, Vite 5, Tailwind CSS, Three.js for the 3D TNT block
- **Desktop build:** PyInstaller, driven by `scripts/build-exe.ps1`
- **Tests:** pytest

## Architecture

In development the UI is Vite at `http://127.0.0.1:5173/`. Vite proxies `/api` to FastAPI on `http://127.0.0.1:8001`. The packaged app serves the built frontend from that same local API and opens the browser itself.

PDF bytes, thumbnails, and split files stay on loopback. LAN ranks use a separate UDP beacon and a small TCP listener on port **18181** (see Privacy).

`GET /api/health` returns `{ "ok": true, "apiVersion": 2 }`.

**PDF**

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/api/pdf/open` | Upload a PDF and open a session |
| `POST` | `/api/pdf/open-path` | Open a PDF by local path |
| `GET` | `/api/pdf/{sid}` | Session id, filename, page count |
| `GET` | `/api/pdf/{sid}/page/{page}/thumb` | JPEG thumbnail (`width`, `rotate`, `mirrorH`, `mirrorV`, `contrast`) |
| `GET` | `/api/pdf/{sid}/page/{page}/image` | Larger JPEG preview (same query params) |
| `POST` | `/api/pdf/{sid}/split` | Range or basket export to a folder on disk |

**System**

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/api/system/pick-folder` | Native folder dialog |
| `POST` | `/api/system/pick-pdf` | Native PDF dialog |
| `POST` | `/api/system/scan-output` | Read `bolum_XXX_sayfa_*.pdf` names in the output and not-found folders |
| `POST` | `/api/system/delete-output` | Delete one app-produced output file |
| `POST` | `/api/system/cursor` | Move the OS pointer for local mob effects |
| `GET` `PUT` `POST` | `/api/system/save` | Read or write the local progress save |
| `DELETE` | `/api/system/save` | Delete that save |
| `GET` | `/api/system/identity` | Local id, username, hostname |
| `PUT` `POST` | `/api/system/lan-profile` | Publish the LAN profile and return the board |
| `PUT` | `/api/system/lan-avatar` | Store or clear the local avatar JPEG |
| `GET` | `/api/system/lan-board` | Current LAN leaderboard |
| `GET` | `/api/system/lan-peer-avatar` | Peer avatar, fetched by the backend from a private LAN address |

## Getting started

Windows, PowerShell, from the repository root. Python 3.10+ and Node.js LTS need to be on `PATH`.

### Quick start

```powershell
.\start.ps1
```

The script creates `.venv` and installs the backend on first run, runs `npm install` in `frontend/` when `node_modules` is missing, then starts Uvicorn on `127.0.0.1:8001` and Vite on port `5173`. When both respond, it opens `http://127.0.0.1:5173/`. Close the spawned PowerShell windows to stop the servers. If a port is already in use, that process is left running.

### Manual dev servers

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -U pip
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8001 --reload
```

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

### Tests

From the repository root, with the virtualenv above:

```powershell
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pytest
```

## Building a portable Windows EXE

Requirements: Python 3.10+, Node.js LTS, Windows x64.

```powershell
.\scripts\build-exe.ps1
```

The script builds the frontend, installs backend dependencies and PyInstaller into `.venv`, and writes the portable build under `dist/`. Copy the whole folder created under `dist/`, including `_internal`, so the executable can find the bundled UI and native libraries. The build is Windows x64 only.

The packaged process listens on `127.0.0.1:8001` (override with the `PDFSPLITTER_PORT` environment variable), opens the default browser, and restarts its HTTP worker after repeated failed health checks. A second launch opens that same local URL and exits.

## Privacy

PDF upload, preview, and split traffic stays on `127.0.0.1`. Files are written to the working directory and to the output folders you pick. They are not uploaded to a remote service.

Progress (XP, game state, profile) is stored in `localStorage` and in a JSON file beside the project during development, or beside the executable when packaged.

LAN ranks are optional network traffic on the local network, and they do not carry PDF bytes, page images, or output paths. While the board is in use the backend:

- Binds UDP port **18181** and broadcasts a small JSON profile (magic prefix `PDFC1`) to the subnet broadcast address about every 4 seconds.
- Serves `GET /lan`, `POST /lan`, and `GET /lan/avatar` on `0.0.0.0:18181`.
- Walks the local private IPv4 `/24` and pulls `GET /lan` from peers. Avatar JPEGs are requested only from private or loopback addresses.
- Opens a UDP socket to `8.8.8.8:80` solely to learn this machine’s LAN address. No profile or file data is sent.

The published profile is a display name, hostname, a 16-character id derived from hostname and username, level, XP, achievement count, achievement ids, coins, alive days, split count, deaths, rank title, theme, activity (`idle` or `pdf`), deadly-mode flag, time spent in each theme, mob and boss kills, PDFs opened, pages saved, a bio of at most 140 characters, and an optional JPEG avatar (about 80 KB). The Windows username is the default display name until you set one. A copy of the board, including peer IPs seen on the LAN, is stored in a local JSON file next to the save file.

## Assets

Minecraft item and effect textures are not included in this repository for copyright reasons. The app still runs. To show those icons, add your own 16×16 PNGs under `frontend/src/assets/mc` and `frontend/src/assets/fx`, using the file names referenced in `frontend/src/utils/mcAssets.ts` (for example `wooden_pickaxe.png`, `heart_full.png`, `explosion_0.png`, `mc_fire.png`). `frontend/src/utils/shopItems.ts` requests additional item files through the same helper; those names belong in `frontend/src/assets/mc` as well.

Mob sprites in `frontend/src/assets/mobs` are original pixel art generated by `scripts/gen_mc_sprites.py` and `scripts/fix_mc_sprites.py`.

Not affiliated with or endorsed by Mojang or Microsoft. Minecraft is a trademark of Mojang Synergies AB.

## Project structure

```text
stratacut/
  backend/app/
    api/            routes_pdf.py, routes_system.py
    core/           config, errors
    models/         request and response schemas
    services/       pdf_service.py, storage_service.py,
                    save_service.py, lan_rank_service.py
    main.py         FastAPI app
    desktop_entry.py
  frontend/src/
    pages/          Dashboard.tsx
    components/     SplitForm, ThumbGrid, PagePreview,
                    shop, achievements, LAN ranks, shortcuts
    utils/          page ranges, progression, shop, profile
    assets/         mc/, fx/, mobs/
  packaging/        PyInstaller spec and icon
  scripts/          build-exe.ps1, sprite generators
  tests/            pytest
  start.ps1
  pyproject.toml
```
