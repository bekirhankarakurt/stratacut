import { deadlyModeEnabled, loadAppSettings, subscribeAppSettings } from './appSettings';
import { getGame } from './game';
import {
  ACHIEVEMENTS,
  addThemeMs,
  flushThemeStats,
  getSnapshot,
  levelFromXp,
  rankForLevel,
  subscribe as subscribeProgress,
} from './progression';
import { getTheme, subscribeTheme } from './theme';
import { getPlayerProfile, subscribePlayerProfile } from './playerProfile';
import { useSyncExternalStore } from 'react';

export type LanTheme = 'minecraft' | 'classic' | '';
export type LanActivity = 'idle' | 'pdf' | '';

export type LanPlayer = {
  place: number;
  id: string;
  name: string;
  host: string;
  level: number;
  xp: number;
  achievements: number;
  coins: number;
  aliveDays: number;
  splits: number;
  deaths: number;
  rank: string;
  theme: LanTheme;
  activity: LanActivity;
  deadly: boolean;
  minecraftMs: number;
  classicMs: number;
  mobKills: number;
  bossKills: number;
  pdfsOpened: number;
  pagesSaved: number;
  bio: string;
  unlocked: string[];
  hasAvatar: boolean;
  avatarAt: number;
  ip: string;
  online: boolean;
  self: boolean;
};

export type LanBoard = {
  selfId: string;
  username: string;
  hostname: string;
  players: LanPlayer[];
};

let cachedName = '';
let activity: LanActivity = 'idle';
const nameListeners = new Set<() => void>();

function emitName() {
  nameListeners.forEach((l) => l());
}

export function subscribePlayerName(cb: () => void): () => void {
  nameListeners.add(cb);
  const offSettings = subscribeAppSettings(cb);
  return () => {
    nameListeners.delete(cb);
    offSettings();
  };
}

export function displayPlayerName(fallback = 'Oyuncu'): string {
  const custom = loadAppSettings().playerName.trim();
  if (custom) return custom.slice(0, 24);
  if (cachedName) return cachedName;
  return fallback;
}

export function usePlayerName(): string {
  return useSyncExternalStore(subscribePlayerName, displayPlayerName, displayPlayerName);
}

export async function loadIdentityName(): Promise<string> {
  try {
    const res = await fetch('/api/system/identity');
    if (!res.ok) return displayPlayerName();
    const body = (await res.json()) as { username?: string };
    if (typeof body.username === 'string' && body.username.trim()) {
      cachedName = body.username.trim().slice(0, 24);
      emitName();
    }
  } catch {
    /* vite without backend */
  }
  return displayPlayerName();
}

export function setLanActivity(next: LanActivity) {
  const v = next === 'pdf' ? 'pdf' : 'idle';
  if (activity === v) return;
  activity = v;
  void publishLanProfile();
}

export function themePlaceLabel(theme: LanTheme): string {
  if (theme === 'classic') return 'Classic';
  if (theme === 'minecraft') return 'Madende';
  return '';
}

export function statusLabel(p: Pick<LanPlayer, 'online' | 'theme' | 'activity' | 'deadly'>): string {
  if (!p.online) return 'Çevrimdışı';
  const place = themePlaceLabel(p.theme) || 'Çevrimiçi';
  const bits = [place];
  if (p.activity === 'pdf') bits.push('PDF düzenliyor');
  if (p.theme === 'minecraft' && p.deadly) bits.push('ölümcül');
  return bits.join(' · ');
}

export function formatPlayMs(ms: number): string {
  const totalMin = Math.max(0, Math.floor((ms || 0) / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}g ${h % 24}sa`;
  }
  if (h > 0) return `${h} sa ${m} dk`;
  if (m > 0) return `${m} dk`;
  return 'yeni';
}

export function lanAvatarUrl(p: Pick<LanPlayer, 'self' | 'ip' | 'hasAvatar' | 'avatarAt'>): string | undefined {
  if (!p.hasAvatar || !p.ip) return undefined;
  return `/api/system/lan-peer-avatar?ip=${encodeURIComponent(p.ip)}&v=${p.avatarAt || 0}`;
}

export function currentLanProfile() {
  const p = getSnapshot();
  const g = getGame();
  const info = levelFromXp(p.xp);
  const theme = getTheme();
  const prof = getPlayerProfile();
  return {
    name: displayPlayerName(),
    level: info.level,
    xp: p.xp,
    achievements: p.unlocked.length,
    coins: g.coins,
    aliveDays: g.aliveDays + g.potionBonusDays,
    splits: p.stats.splits,
    deaths: g.deaths,
    rank: rankForLevel(info.level),
    theme,
    activity,
    deadly: theme === 'minecraft' && deadlyModeEnabled(),
    minecraftMs: p.stats.minecraftMs ?? 0,
    classicMs: p.stats.classicMs ?? 0,
    mobKills: p.stats.mobKills ?? 0,
    bossKills: p.stats.bossKills ?? 0,
    pdfsOpened: p.stats.pdfsOpened ?? 0,
    pagesSaved: p.stats.pagesSaved ?? 0,
    bio: prof.bio,
    unlocked: p.unlocked.slice(0, ACHIEVEMENTS.length),
    hasAvatar: !!prof.avatar,
    avatarAt: prof.avatarAt || 0,
  };
}

export async function publishLanProfile(): Promise<LanBoard | null> {
  try {
    const res = await fetch('/api/system/lan-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentLanProfile()),
    });
    if (!res.ok) return null;
    return (await res.json()) as LanBoard;
  } catch {
    return null;
  }
}

export async function fetchLanBoard(): Promise<LanBoard | null> {
  try {
    const res = await fetch('/api/system/lan-board');
    if (!res.ok) return null;
    return (await res.json()) as LanBoard;
  } catch {
    return null;
  }
}

function maxNum(a: number | undefined, b: number | undefined): number {
  return Math.max(Number(a) || 0, Number(b) || 0);
}

function unionIds(a: string[] | undefined, b: string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of [...(a ?? []), ...(b ?? [])]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Keep richer peer stats when a restart beacon would otherwise flash zeros. */
export function mergeLanBoard(prev: LanBoard | null, next: LanBoard): LanBoard {
  if (!prev) return next;
  const oldById = new Map(prev.players.map((p) => [p.id, p]));
  return {
    ...next,
    players: next.players.map((p) => {
      const old = oldById.get(p.id);
      if (!old || p.self) return p;
      const unlocked = unionIds(p.unlocked, old.unlocked);
      return {
        ...p,
        xp: maxNum(p.xp, old.xp),
        level: maxNum(p.level, old.level),
        achievements: Math.max(maxNum(p.achievements, old.achievements), unlocked.length),
        coins: maxNum(p.coins, old.coins),
        aliveDays: maxNum(p.aliveDays, old.aliveDays),
        splits: maxNum(p.splits, old.splits),
        deaths: maxNum(p.deaths, old.deaths),
        minecraftMs: maxNum(p.minecraftMs, old.minecraftMs),
        classicMs: maxNum(p.classicMs, old.classicMs),
        mobKills: maxNum(p.mobKills, old.mobKills),
        bossKills: maxNum(p.bossKills, old.bossKills),
        pdfsOpened: maxNum(p.pdfsOpened, old.pdfsOpened),
        pagesSaved: maxNum(p.pagesSaved, old.pagesSaved),
        unlocked,
        bio: p.bio || old.bio,
        hasAvatar: p.hasAvatar || old.hasAvatar,
        avatarAt: maxNum(p.avatarAt, old.avatarAt),
        ip: p.ip || old.ip,
      };
    }),
  };
}

let syncStarted = false;

export function startLanSync() {
  if (syncStarted || typeof window === 'undefined') return;
  syncStarted = true;
  void loadIdentityName().then(() => {
    void publishLanProfile();
  });
  window.setInterval(() => {
    void publishLanProfile();
  }, 8000);
  subscribeProgress(() => {
    void publishLanProfile();
  });
  subscribeAppSettings(() => {
    emitName();
    void publishLanProfile();
  });
  subscribeTheme(() => {
    void publishLanProfile();
  });
  subscribePlayerProfile(() => {
    void publishLanProfile();
  });

  let lastTick = Date.now();
  window.setInterval(() => {
    const now = Date.now();
    const dt = Math.min(now - lastTick, 4000);
    lastTick = now;
    if (typeof document !== 'undefined' && document.hidden) return;
    addThemeMs(getTheme(), dt);
  }, 1000);
  window.addEventListener('beforeunload', () => {
    flushThemeStats();
  });
}
