import { PROFILE_STORAGE_KEY, isSaveBootstrapped, scheduleDiskSave } from './diskSave';

export type PlayerProfile = {
  bio: string;
  avatar: string;
  avatarAt: number;
};

const BIO_MAX = 140;
const listeners = new Set<() => void>();

function empty(): PlayerProfile {
  return { bio: '', avatar: '', avatarAt: 0 };
}

function load(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw) as Partial<PlayerProfile>;
    return {
      bio: typeof p.bio === 'string' ? p.bio.trim().slice(0, BIO_MAX) : '',
      avatar: typeof p.avatar === 'string' && p.avatar.startsWith('data:image/') ? p.avatar : '',
      avatarAt: typeof p.avatarAt === 'number' ? p.avatarAt : 0,
    };
  } catch {
    return empty();
  }
}

let current: PlayerProfile = load();

function persist() {
  if (!isSaveBootstrapped()) return;
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* quota */
  }
  scheduleDiskSave();
}

function emit() {
  listeners.forEach((l) => l());
}

export function getPlayerProfile(): PlayerProfile {
  return current;
}

export function subscribePlayerProfile(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function reloadPlayerProfileFromStorage() {
  current = load();
  emit();
}

export function savePlayerProfile(patch: Partial<PlayerProfile>) {
  current = {
    bio: typeof patch.bio === 'string' ? patch.bio.trim().slice(0, BIO_MAX) : current.bio,
    avatar: typeof patch.avatar === 'string' ? patch.avatar : current.avatar,
    avatarAt: typeof patch.avatarAt === 'number' ? patch.avatarAt : current.avatarAt,
  };
  persist();
  emit();
}

export function clearPlayerAvatar() {
  current = { ...current, avatar: '', avatarAt: Date.now() };
  persist();
  emit();
}

export const PLAYER_BIO_MAX = BIO_MAX;

export function resizeAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas'));
          return;
        }
        const side = Math.min(img.width, img.height) || 1;
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, 128, 128);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image'));
    };
    img.src = url;
  });
}

export async function publishLanAvatar(dataUrl: string): Promise<number> {
  try {
    const res = await fetch('/api/system/lan-avatar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl }),
    });
    if (!res.ok) return Date.now();
    const body = (await res.json()) as { avatarAt?: number };
    return typeof body.avatarAt === 'number' && body.avatarAt > 0 ? body.avatarAt : Date.now();
  } catch {
    return Date.now();
  }
}
