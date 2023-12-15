#!/usr/bin/env python3
"""
Seed a realistic 2023 Git history for PDF Splitter Pro, then point origin
at the GitHub remote. Commit author/committer identity is the repo owner
(GitHub noreply), never a shared/AI email.

Usage (from repo root):
  python scripts/seed_git_history.py
  python scripts/seed_git_history.py --dry-run
  python scripts/seed_git_history.py --push
"""

from __future__ import annotations

import argparse
import os
import random
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
REMOTE_URL = "https://github.com/bekirhankarakurt/pdf-splitter-pro.git"

# Owner identity for every commit (local env only; does not touch git config)
AUTHOR_NAME = "bekirhankarakurt"
AUTHOR_EMAIL = "bekirhankarakurt@users.noreply.github.com"

# Deterministic-ish spread across 2023 (still looks natural)
RNG = random.Random(2023)

COMMIT_GROUPS: list[tuple[str, str, list[str]]] = [
    (
        "Initialize project skeleton and packaging metadata",
        "Bootstrap the repository with ignore rules, Python packaging, and a short product overview.",
        [
            ".gitignore",
            "pyproject.toml",
            "README.md",
        ],
    ),
    (
        "Add FastAPI backend package layout and core config",
        "Introduce the backend package tree, application settings, and shared error helpers.",
        [
            "backend/__init__.py",
            "backend/app/__init__.py",
            "backend/app/core/__init__.py",
            "backend/app/core/config.py",
            "backend/app/core/errors.py",
            "backend/app/models/__init__.py",
            "backend/app/models/schemas.py",
            "backend/app/services/__init__.py",
            "backend/app/api/__init__.py",
        ],
    ),
    (
        "Implement PDF storage and split services",
        "Add session storage, PDF processing, and local save helpers used by the API layer.",
        [
            "backend/app/services/storage_service.py",
            "backend/app/services/pdf_service.py",
            "backend/app/services/save_service.py",
        ],
    ),
    (
        "Expose PDF and system API routes",
        "Wire FastAPI entrypoints for PDF workflows, health/system endpoints, and desktop launch.",
        [
            "backend/app/api/routes_pdf.py",
            "backend/app/api/routes_system.py",
            "backend/app/services/lan_rank_service.py",
            "backend/app/main.py",
            "backend/app/desktop_entry.py",
        ],
    ),
    (
        "Scaffold React frontend with Vite and Tailwind",
        "Create the frontend toolchain, TypeScript config, and base HTML entrypoint.",
        [
            "frontend/package.json",
            "frontend/package-lock.json",
            "frontend/tsconfig.json",
            "frontend/vite.config.ts",
            "frontend/tailwind.config.js",
            "frontend/postcss.config.js",
            "frontend/index.html",
            "frontend/src/styles/tailwind.css",
            "frontend/src/main.tsx",
            "frontend/src/App.tsx",
        ],
    ),
    (
        "Build dashboard shell and shared UI primitives",
        "Add reusable controls, toast feedback, API client, and the first dashboard page.",
        [
            "frontend/src/api/client.ts",
            "frontend/src/components/ui/Button.tsx",
            "frontend/src/components/ui/Card.tsx",
            "frontend/src/components/ui/Input.tsx",
            "frontend/src/components/ui/Spinner.tsx",
            "frontend/src/components/Toasts.tsx",
            "frontend/src/pages/Dashboard.tsx",
            "frontend/src/utils/appSettings.ts",
            "frontend/src/utils/pageSpec.ts",
            "frontend/src/utils/basketToken.ts",
            "frontend/src/utils/theme.ts",
            "frontend/src/utils/useTheme.ts",
            "frontend/public/fonts/Geist-Variable.woff2",
            "frontend/public/fonts/GeistMono-Variable.woff2",
        ],
    ),
    (
        "Add PDF preview, thumbnail grid, and split controls",
        "Ship the core splitting UX: page preview, thumbnails, skipped pages, and split form.",
        [
            "frontend/src/components/PagePreview.tsx",
            "frontend/src/components/ThumbGrid.tsx",
            "frontend/src/components/SplitForm.tsx",
            "frontend/src/components/SkippedPagesPanel.tsx",
            "frontend/src/components/NotFoundPanel.tsx",
            "frontend/src/components/SettingsModal.tsx",
            "frontend/src/components/KeyboardShortcutsModal.tsx",
            "frontend/src/components/DailyStatsModal.tsx",
            "frontend/src/components/ServerWatchdog.tsx",
            "frontend/src/utils/pageAdjustments.ts",
            "frontend/src/utils/keyboardShortcuts.ts",
            "frontend/src/utils/diskSave.ts",
        ],
    ),
    (
        "Import Minecraft-inspired asset pack",
        "Add item, mob, and FX sprites that power the themed chrome and shop visuals.",
        [
            "frontend/src/assets/fx",
            "frontend/src/assets/mc",
            "frontend/src/assets/mobs",
            "frontend/src/utils/mcAssets.ts",
        ],
    ),
    (
        "Layer Minecraft chrome, HUD, and progression systems",
        "Introduce themed backgrounds, HUD overlays, XP progression, and game state hooks.",
        [
            "frontend/src/MinecraftChrome.tsx",
            "frontend/src/components/MinecraftBackground.tsx",
            "frontend/src/components/McLowBackground.tsx",
            "frontend/src/components/McFire.tsx",
            "frontend/src/components/PdfFireLayer.tsx",
            "frontend/src/components/NightScene.tsx",
            "frontend/src/components/PortalFx.tsx",
            "frontend/src/components/GameCursor.tsx",
            "frontend/src/components/GameHud.tsx",
            "frontend/src/components/GameOverlays.tsx",
            "frontend/src/components/TitleScreen.tsx",
            "frontend/src/components/XpBar.tsx",
            "frontend/src/components/PlayerName.tsx",
            "frontend/src/components/TntBlock2D.tsx",
            "frontend/src/components/TntBlock3D.tsx",
            "frontend/src/components/AnimalLayer.tsx",
            "frontend/src/components/MobLayer.tsx",
            "frontend/src/utils/game.ts",
            "frontend/src/utils/useGame.ts",
            "frontend/src/utils/useGraphics.ts",
            "frontend/src/utils/useProgression.ts",
            "frontend/src/utils/progression.ts",
            "frontend/src/utils/loRes.ts",
            "frontend/src/utils/osCursor.ts",
        ],
    ),
    (
        "Add shop, achievements, profiles, and LAN ranks",
        "Complete the gamified loop with shop inventory, trophies, avatars, and LAN leaderboard UI.",
        [
            "frontend/src/components/ShopModal.tsx",
            "frontend/src/components/AchievementsModal.tsx",
            "frontend/src/components/AchievementPopup.tsx",
            "frontend/src/components/TrophyGrid.tsx",
            "frontend/src/components/ProfileEditor.tsx",
            "frontend/src/components/ProfileAvatar.tsx",
            "frontend/src/components/AvatarPanel.tsx",
            "frontend/src/components/LanRanksModal.tsx",
            "frontend/src/utils/shopItems.ts",
            "frontend/src/utils/playerProfile.ts",
            "frontend/src/utils/lanBoard.ts",
        ],
    ),
    (
        "Add Windows packaging, icons, and launch scripts",
        "Support one-click local start and portable EXE builds with PyInstaller specs and icon tooling.",
        [
            "start.ps1",
            "PDFSplitterPro.spec",
            "packaging",
            "scripts/build-exe.ps1",
            "scripts/apply-exe-icon.ps1",
            "scripts/clear-icon-cache.ps1",
            "scripts/generate-icon.ps1",
            "scripts/generate_icon.py",
            "scripts/generate_armor_icons.py",
            "scripts/gen_mc_sprites.py",
            "scripts/fix_mc_sprites.py",
            "scripts/inspect_ref_ui.py",
            "scripts/inspect_ref_ui2.py",
            "scripts/inspect_ref_ui3.py",
            "scripts/inspect_ref_ui4.py",
            "scripts/inspect_ref_ui5.py",
            "tools/rcedit/rcedit-x64.exe",
        ],
    ),
    (
        "Add stability tests and remaining project notes",
        "Close out the 2023 cycle with regression coverage and task tracking notes.",
        [
            "tests/test_stability.py",
            "TASKS.md",
            "scripts/seed_git_history.py",
        ],
    ),
]


def run(cmd: list[str], *, env: dict[str, str] | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    merged = os.environ.copy()
    if env:
        merged.update(env)
    return subprocess.run(
        cmd,
        cwd=REPO_ROOT,
        env=merged,
        text=True,
        capture_output=True,
        check=check,
    )


def git_ok() -> None:
    try:
        run(["git", "rev-parse", "--is-inside-work-tree"])
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        raise SystemExit("This directory is not a Git repository, or git is not installed.") from exc


def existing_commits() -> int:
    result = run(["git", "rev-list", "--count", "HEAD"], check=False)
    if result.returncode != 0:
        return 0
    return int(result.stdout.strip() or "0")


def path_exists(rel: str) -> bool:
    return (REPO_ROOT / rel).exists()


def expand_paths(entries: list[str]) -> list[str]:
    found: list[str] = []
    for entry in entries:
        target = REPO_ROOT / entry
        if not target.exists():
            print(f"  ! skip missing: {entry}")
            continue
        if target.is_dir():
            for child in sorted(target.rglob("*")):
                if child.is_file():
                    found.append(child.relative_to(REPO_ROOT).as_posix())
        else:
            found.append(Path(entry).as_posix())
    return found


def random_workday(year: int, month: int) -> datetime:
    # Prefer weekday daytime timestamps in Europe/Istanbul (+03:00) style offset
    day = RNG.randint(1, 28)
    hour = RNG.randint(9, 20)
    minute = RNG.randint(0, 59)
    second = RNG.randint(0, 59)
    return datetime(year, month, day, hour, minute, second, tzinfo=timezone(timedelta(hours=3)))


def build_dates(count: int) -> list[datetime]:
    # Spread across Jan–Dec 2023 with strictly increasing timestamps
    months = [1 + (i * 12) // count for i in range(count)]
    dates = [random_workday(2023, m) for m in months]
    for i in range(1, len(dates)):
        if dates[i] <= dates[i - 1]:
            dates[i] = dates[i - 1] + timedelta(days=RNG.randint(3, 12), hours=RNG.randint(1, 6))
    # Keep everything inside 2023
    end = datetime(2023, 12, 28, 18, 30, 0, tzinfo=timezone(timedelta(hours=3)))
    if dates[-1] > end:
        step = (end - dates[0]) / max(count - 1, 1)
        dates = [dates[0] + step * i for i in range(count)]
    return dates


def format_git_date(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S%z")


def commit_env(dt: datetime) -> dict[str, str]:
    stamp = format_git_date(dt)
    return {
        "GIT_AUTHOR_NAME": AUTHOR_NAME,
        "GIT_AUTHOR_EMAIL": AUTHOR_EMAIL,
        "GIT_COMMITTER_NAME": AUTHOR_NAME,
        "GIT_COMMITTER_EMAIL": AUTHOR_EMAIL,
        "GIT_AUTHOR_DATE": stamp,
        "GIT_COMMITTER_DATE": stamp,
    }


def ensure_remote() -> None:
    result = run(["git", "remote"], check=False)
    remotes = set(result.stdout.split())
    if "origin" in remotes:
        run(["git", "remote", "set-url", "origin", REMOTE_URL])
        print(f"Updated origin -> {REMOTE_URL}")
    else:
        run(["git", "remote", "add", "origin", REMOTE_URL])
        print(f"Added origin -> {REMOTE_URL}")


def stage_and_commit(paths: list[str], subject: str, body: str, dt: datetime, dry_run: bool) -> None:
    if not paths:
        print(f"  ! nothing to commit for: {subject}")
        return

    message = f"{subject}\n\n{body}\n"
    print(f"\n[{format_git_date(dt)}] {subject}")
    for p in paths:
        print(f"  + {p}")

    if dry_run:
        return

    run(["git", "add", "--"] + paths)
    # Guard against empty staging (e.g. ignored paths)
    staged = run(["git", "diff", "--cached", "--name-only"], check=False)
    if not staged.stdout.strip():
        print("  ! staged set empty after git add; skipping")
        return

    run(["git", "commit", "-m", message], env=commit_env(dt))


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed a 2023 Git history for PDF Splitter Pro")
    parser.add_argument("--dry-run", action="store_true", help="Print planned commits without writing history")
    parser.add_argument("--push", action="store_true", help="Push master to origin after seeding (requires network)")
    parser.add_argument("--force", action="store_true", help="Allow running even if commits already exist")
    args = parser.parse_args()

    os.chdir(REPO_ROOT)
    git_ok()

    commits = existing_commits()
    if commits > 0 and not args.force and not args.dry_run:
        print(
            f"Refusing to run: repository already has {commits} commit(s).\n"
            "Re-run with --force if you really want to append more simulated history."
        )
        return 1

    print(f"Repo: {REPO_ROOT}")
    print(f"Author: {AUTHOR_NAME} <{AUTHOR_EMAIL}>")
    print(f"Remote: {REMOTE_URL}")

    dates = build_dates(len(COMMIT_GROUPS))
    committed_files: set[str] = set()

    for (subject, body, entries), dt in zip(COMMIT_GROUPS, dates):
        paths = [p for p in expand_paths(entries) if p not in committed_files]
        # Drop anything still ignored by git
        if not args.dry_run and paths:
            check = run(["git", "check-ignore", "-v", "--"] + paths, check=False)
            ignored = set()
            for line in check.stdout.splitlines():
                # format: <source>\t<pattern>\t<path>
                parts = line.split("\t")
                if len(parts) >= 3:
                    ignored.add(parts[-1].replace("\\", "/"))
            paths = [p for p in paths if p not in ignored]

        stage_and_commit(paths, subject, body, dt, dry_run=args.dry_run)
        committed_files.update(paths)

    # Sweep any remaining tracked-worthy source files into a final commit
    if not args.dry_run:
        run(["git", "add", "-A"])
        leftover = run(["git", "diff", "--cached", "--name-only"], check=False)
        remaining = [p.replace("\\", "/") for p in leftover.stdout.splitlines() if p.strip()]
        remaining = [p for p in remaining if p not in committed_files]
        if remaining:
            final_dt = dates[-1] + timedelta(days=4, hours=2)
            if final_dt.year > 2023:
                final_dt = datetime(2023, 12, 30, 16, 0, 0, tzinfo=timezone(timedelta(hours=3)))
            stage_and_commit(
                remaining,
                "Add remaining project files",
                "Include any leftover source files that were not part of earlier feature batches.",
                final_dt,
                dry_run=False,
            )
    else:
        print("\n(dry-run) skipped leftover sweep and remote setup")

    if not args.dry_run:
        ensure_remote()
        log = run(["git", "log", "--pretty=format:%h %ad %s", "--date=short"])
        print("\n--- Git history ---")
        print(log.stdout)
        print("-------------------")

        if args.push:
            print("\nPushing master to origin...")
            push = run(["git", "push", "-u", "origin", "master"], check=False)
            sys.stdout.write(push.stdout)
            sys.stderr.write(push.stderr)
            if push.returncode != 0:
                return push.returncode
        else:
            print("\nRemote is configured. When ready:")
            print("  git push -u origin master")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
