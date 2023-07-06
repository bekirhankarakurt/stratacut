/** Durable save next to the EXE (via backend). localStorage is a cache. */

export const GAME_STORAGE_KEY = 'pdfcraft.game.v1';
export const PROGRESS_STORAGE_KEY = 'pdfcraft.progress.v1';
export const PROFILE_STORAGE_KEY = 'pdfcraft.profile.v1';

type DiskSave = {
  v: 1;
  progress?: unknown;
  game?: unknown;
  profile?: unknown;
};

let putTimer = 0;
let skipDisk = false;
/** Block disk writes until hydrate+reload finished so an empty boot cannot wipe the save. */
let bootReady = false;

export function markSaveBootstrapped() {
  bootReady = true;
}

export function isSaveBootstrapped(): boolean {
  return bootReady;
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function snapshot(): DiskSave {
  return {
    v: 1,
    progress: parseJson(localStorage.getItem(PROGRESS_STORAGE_KEY)),
    game: parseJson(localStorage.getItem(GAME_STORAGE_KEY)),
    profile: parseJson(localStorage.getItem(PROFILE_STORAGE_KEY)),
  };
}

export async function hydrateFromDisk(): Promise<void> {
  try {
    const res = await fetch('/api/system/save');
    if (!res.ok) return;
    const body = (await res.json()) as { data?: DiskSave | null };
    const data = body?.data;
    if (data && typeof data === 'object' && (data.progress != null || data.game != null || data.profile != null)) {
      if (data.progress != null) {
        localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(data.progress));
      }
      if (data.game != null) {
        localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(data.game));
      }
      if (data.profile != null) {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(data.profile));
      }
      return;
    }
    await flushDiskSave();
  } catch {
    /* Vite without backend, or first run */
  }
}

export function scheduleDiskSave() {
  if (skipDisk || !bootReady || typeof window === 'undefined') return;
  window.clearTimeout(putTimer);
  putTimer = window.setTimeout(() => {
    putTimer = 0;
    void flushDiskSave();
  }, 2500);
}

export async function flushDiskSave() {
  if (skipDisk || !bootReady) return;
  try {
    await fetch('/api/system/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: snapshot() }),
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}

export async function deleteDiskSave() {
  skipDisk = true;
  window.clearTimeout(putTimer);
  putTimer = 0;
  try {
    await fetch('/api/system/save', { method: 'DELETE' });
  } catch {
    /* ignore */
  }
  window.setTimeout(() => {
    skipDisk = false;
  }, 4000);
}
