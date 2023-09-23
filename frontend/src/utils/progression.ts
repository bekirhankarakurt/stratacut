// PDFCraft progression: XP, levels, ranks, perks and achievements.
// Everything is persisted to localStorage so a user's progress lives on their
// machine. Components read the live snapshot via `useProgression()` and can
// subscribe to unlock/level-up events for popups.

import { PROGRESS_STORAGE_KEY, isSaveBootstrapped, scheduleDiskSave } from './diskSave';

const STORAGE_KEY = PROGRESS_STORAGE_KEY;

export type Stats = {
  sessions: number;
  pdfsOpened: number;
  splits: number;
  rangeSaves: number;
  basketSaves: number;
  pagesSaved: number;
  notFoundExports: number;
  skippedExports: number;
  restores: number;
  marks: number;
  firstPageSets: number;
  rotations: number;
  mirrors: number;
  contrastAdjusts: number;
  pagesViewed: number;
  tntBooms: number;
  maxSectionNo: number;
  sessionSplitsMax: number;
  streakDays: number;
  nightOwl: boolean;
  earlyBird: boolean;
  mobKills: number;
  bossKills: number;
  enrageKills: number;
  minecraftMs: number;
  classicMs: number;
  shopBuys: number;
  nightsLived: number;
  deadlyNights: number;
  coinsEarned: number;
  deaths: number;
  talismanUses: number;
  wroteBio: boolean;
  setPhoto: boolean;
  boughtNetheriteSword: boolean;
};

export type DailyWork = {
  splits: number;
  pages: number;
  pdfs: number;
};

export type Progress = {
  xp: number;
  stats: Stats;
  unlocked: string[];
  createdAt: number;
  lastActiveDay: string; // YYYY-MM-DD
  sessionSplits: number; // resets each session (not persisted meaningfully)
  daily: Record<string, DailyWork>;
};

const DEFAULT_STATS: Stats = {
  sessions: 0,
  pdfsOpened: 0,
  splits: 0,
  rangeSaves: 0,
  basketSaves: 0,
  pagesSaved: 0,
  notFoundExports: 0,
  skippedExports: 0,
  restores: 0,
  marks: 0,
  firstPageSets: 0,
  rotations: 0,
  mirrors: 0,
  contrastAdjusts: 0,
  pagesViewed: 0,
  tntBooms: 0,
  maxSectionNo: 0,
  sessionSplitsMax: 0,
  streakDays: 0,
  nightOwl: false,
  earlyBird: false,
  mobKills: 0,
  bossKills: 0,
  enrageKills: 0,
  minecraftMs: 0,
  classicMs: 0,
  shopBuys: 0,
  nightsLived: 0,
  deadlyNights: 0,
  coinsEarned: 0,
  deaths: 0,
  talismanUses: 0,
  wroteBio: false,
  setPhoto: false,
  boughtNetheriteSword: false,
};

const EMPTY_DAILY: DailyWork = { splits: 0, pages: 0, pdfs: 0 };
const DAILY_KEEP_DAYS = 90;

function parseDaily(raw: unknown): Record<string, DailyWork> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, DailyWork> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !val || typeof val !== 'object') continue;
    const row = val as Partial<DailyWork>;
    out[key] = {
      splits: Math.max(0, Math.floor(Number(row.splits) || 0)),
      pages: Math.max(0, Math.floor(Number(row.pages) || 0)),
      pdfs: Math.max(0, Math.floor(Number(row.pdfs) || 0)),
    };
  }
  return out;
}

function defaultProgress(): Progress {
  return {
    xp: 0,
    stats: { ...DEFAULT_STATS },
    unlocked: [],
    createdAt: Date.now(),
    lastActiveDay: '',
    sessionSplits: 0,
    daily: {},
  };
}

// ── XP / Level math ──────────────────────────────────────────────
export function xpForLevel(level: number): number {
  return 60 + (level - 1) * 40;
}

export type LevelInfo = {
  level: number;
  intoLevel: number;
  neededForNext: number;
  progress: number; // 0..1
};

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  let rem = Math.max(0, Math.floor(xp));
  while (rem >= xpForLevel(level)) {
    rem -= xpForLevel(level);
    level += 1;
  }
  const need = xpForLevel(level);
  return { level, intoLevel: rem, neededForNext: need, progress: need > 0 ? rem / need : 0 };
}

// ── Ranks (prestige for heavy users) ─────────────────────────────
export function rankForLevel(level: number): string {
  if (level >= 100) return 'PDFCraft Efsanesi';
  if (level >= 90) return 'Titan';
  if (level >= 80) return 'End Şampiyonu';
  if (level >= 70) return 'Nether Kralı';
  if (level >= 60) return 'Wither Lord';
  if (level >= 50) return 'Ender Ejderha';
  if (level >= 40) return 'Efsane';
  if (level >= 30) return 'Mimar';
  if (level >= 20) return 'Şef Usta';
  if (level >= 15) return 'Usta';
  if (level >= 10) return 'Zanaatkâr';
  if (level >= 5) return 'Kalfa';
  if (level >= 3) return 'Çırak';
  return 'Yeni Madenci';
}

export type NameStyle = {
  nameClass: string;
  badgeClass: string;
  titleClass: string;
  tier: string;
};

export function nameStyleForLevel(level: number): NameStyle {
  if (level >= 100) {
    return { nameClass: 'mc-name-god', badgeClass: 'mc-badge-god', titleClass: 'mc-name-god', tier: 'efsane' };
  }
  if (level >= 90) {
    return { nameClass: 'mc-name-mythic', badgeClass: 'mc-badge-mythic', titleClass: 'mc-name-mythic', tier: 'titan' };
  }
  if (level >= 80) {
    return { nameClass: 'mc-name-champion', badgeClass: 'mc-badge-champion', titleClass: 'mc-name-champion', tier: 'sampiyon' };
  }
  if (level >= 70) {
    return { nameClass: 'mc-name-dragon', badgeClass: 'mc-badge-dragon', titleClass: 'mc-name-dragon', tier: 'kral' };
  }
  if (level >= 60) {
    return { nameClass: 'mc-name-wither', badgeClass: 'mc-badge-wither', titleClass: 'mc-name-wither', tier: 'wither' };
  }
  if (level >= 50) {
    return { nameClass: 'mc-name-ender', badgeClass: 'mc-badge-ender', titleClass: 'mc-name-ender', tier: 'ejderha' };
  }
  if (level >= 40) {
    return { nameClass: 'mc-name-blaze', badgeClass: 'mc-badge-blaze', titleClass: 'mc-name-blaze', tier: 'efsane' };
  }
  if (level >= 30) {
    return { nameClass: 'mc-name-netherite', badgeClass: 'mc-badge-netherite', titleClass: 'mc-name-netherite', tier: 'mimar' };
  }
  if (level >= 20) {
    return { nameClass: 'mc-name-enchant', badgeClass: 'mc-badge-enchant', titleClass: 'mc-name-enchant', tier: 'sef' };
  }
  if (level >= 15) {
    return { nameClass: 'mc-name-emerald', badgeClass: 'mc-badge-emerald', titleClass: 'mc-name-emerald', tier: 'usta' };
  }
  if (level >= 10) {
    return { nameClass: 'mc-name-diamond', badgeClass: 'mc-badge-diamond', titleClass: 'mc-name-diamond', tier: 'zanaat' };
  }
  if (level >= 5) {
    return { nameClass: 'mc-name-gold', badgeClass: 'mc-badge-gold', titleClass: 'mc-name-gold', tier: 'kalfa' };
  }
  return { nameClass: 'mc-name-plain', badgeClass: 'mc-badge-plain', titleClass: 'mc-name-plain', tier: 'yeni' };
}

export function isGoldName(level: number): boolean {
  return level >= 5;
}

// ── Perks unlocked by level ──────────────────────────────────────
export type Perk = { level: number; name: string; desc: string; icon: string };
export const PERKS: Perk[] = [
  { level: 1, name: 'Temel Aletler', desc: 'Kesme, döndürme ve önizleme araçları.', icon: '🪓' },
  { level: 2, name: 'Splash Paketi I', desc: 'Ana menüde yeni rastgele yazılar.', icon: '💬' },
  { level: 3, name: 'Deri Zırh', desc: 'Profil kozmetiği: deri zırh rozeti.', icon: '🟫' },
  { level: 5, name: 'Altın İsim', desc: 'İsmin artık altın renkte parlar.', icon: '✨' },
  { level: 7, name: 'Splash Paketi II', desc: 'Daha fazla rastgele menü yazısı.', icon: '💬' },
  { level: 10, name: 'Elmas Rozet', desc: 'Profilinde elmas rozeti görünür.', icon: '💎' },
  { level: 15, name: 'Elmas Zırh', desc: 'Kozmetik: elmas zırh çerçevesi.', icon: '🛡️' },
  { level: 20, name: 'Efsane Çerçeve', desc: 'XP çubuğun etrafında parlayan çerçeve.', icon: '🌟' },
  { level: 30, name: 'Netherite Ünvanı', desc: 'Ünvanın Netherite ile mühürlenir.', icon: '⬛' },
  { level: 40, name: 'Ejderha Nefesi', desc: 'TNT patlamaların daha görkemli.', icon: '🐲' },
  { level: 50, name: 'Ejderha Tacı', desc: 'İsim Ender mor-cyan parıltısına döner.', icon: '👑' },
  { level: 60, name: 'Wither Mührü', desc: 'Wither Lord ünvanı ve siyah-altın isim.', icon: '💀' },
  { level: 70, name: 'Nether Tacı', desc: 'Lav kırmızısı kraliyet ismi.', icon: '🔥' },
  { level: 80, name: 'End Şampiyonu', desc: 'Altın-eflatun şampiyon ışıltısı.', icon: '🏆' },
  { level: 90, name: 'Titan Aurası', desc: 'Gökkuşağı mitos ismi.', icon: '⚡' },
  { level: 100, name: 'PDFCraft Efsanesi', desc: 'En üst: canlı efsane ismi.', icon: '✦' },
];

export function perksUpTo(level: number): Perk[] {
  return PERKS.filter((p) => p.level <= level);
}

export function nextPerk(level: number): Perk | null {
  return PERKS.find((p) => p.level > level) ?? null;
}

// ── Splash texts (Minecraft style) ───────────────────────────────
const SPLASHES = [
  'Sayfaları böl!',
  'Voxel gücü!',
  'TNT hazır!',
  'PDF madenciliği!',
  'Kes ve kaydet!',
  'Bloklar kadar sağlam!',
  'Craft the docs!',
  'Elmas kadar keskin!',
  'Creeper yok burada!',
  'Sayfa sayfa kazı!',
  'Redstone ile çalışır!',
  '100% offline!',
  'Ender değil, kolay!',
  'Bugsuz, %100!',
  'Emerald toplama zamanı!',
  'Bir sonraki bölüm senden!',
  'Piksel mükemmelliği!',
  'Bölüm 001 seni bekliyor!',
];

export function splashFor(level: number): string {
  // higher level = access to more splash lines (Perk: Splash Paketi)
  const cap = level >= 7 ? SPLASHES.length : level >= 2 ? 12 : 6;
  const pool = SPLASHES.slice(0, cap);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Achievements ─────────────────────────────────────────────────
export type AchCategory =
  | 'kesim'
  | 'sayfa'
  | 'dosya'
  | 'oturum'
  | 'bulunamadi'
  | 'atlanan'
  | 'donusum'
  | 'sepet'
  | 'aralik'
  | 'ilksayfa'
  | 'geri'
  | 'seviye'
  | 'tnt'
  | 'savas'
  | 'magaza'
  | 'hayatta'
  | 'coin'
  | 'meta'
  | 'ozel';

export type AchCtx = Stats & { level: number; unlockedCount: number };

export type Achievement = {
  id: string;
  name: string;
  desc: string;
  icon: string;
  category: AchCategory;
  xp: number; // bonus xp awarded on unlock
  goal?: number;
  metric?: (c: AchCtx) => number;
  check: (c: AchCtx) => boolean;
};

function tierXp(goal: number): number {
  if (goal >= 1000) return 1600;
  if (goal >= 500) return 1000;
  if (goal >= 250) return 600;
  if (goal >= 100) return 400;
  if (goal >= 50) return 240;
  if (goal >= 25) return 160;
  if (goal >= 10) return 100;
  if (goal >= 5) return 60;
  return 40;
}

function threshold(
  prefix: string,
  category: AchCategory,
  metricKey: keyof AchCtx,
  goals: number[],
  namer: (g: number) => string,
  desc: (g: number) => string,
  icon: string,
): Achievement[] {
  return goals.map((g) => ({
    id: `${prefix}_${g}`,
    name: namer(g),
    desc: desc(g),
    icon,
    category,
    xp: tierXp(g),
    goal: g,
    metric: (c) => Number(c[metricKey] ?? 0),
    check: (c) => Number(c[metricKey] ?? 0) >= g,
  }));
}

export const ACHIEVEMENTS: Achievement[] = [
  ...threshold('split', 'kesim', 'splits', [1, 5, 10, 25, 50, 100, 200, 350, 500, 750, 1000, 1500, 2000, 3000, 5000],
    (g) => (g === 1 ? 'İlk Kesim' : `${g} Kesim`),
    (g) => `${g} kez kes ve kaydet yap.`, '✂️'),
  ...threshold('pages', 'sayfa', 'pagesSaved', [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    (g) => `${g} Sayfa`,
    (g) => `Toplam ${g} sayfa kaydet.`, '📄'),
  ...threshold('pdf', 'dosya', 'pdfsOpened', [1, 3, 5, 10, 20, 35, 50, 100],
    (g) => (g === 1 ? 'Hoş Geldin' : `${g} PDF`),
    (g) => `${g} PDF aç.`, '📚'),
  ...threshold('session', 'oturum', 'sessions', [1, 5, 10, 25, 50, 100],
    (g) => (g === 1 ? 'İlk Giriş' : `${g} Oturum`),
    (g) => `Uygulamayı ${g} kez aç.`, '🚪'),
  ...threshold('nf', 'bulunamadi', 'notFoundExports', [1, 5, 10, 25, 50, 100],
    (g) => (g === 1 ? 'Kayıp Bulundu' : `${g} Bulunamadı`),
    (g) => `Bulunamadı klasörüne ${g} kez gönder.`, '🔍'),
  ...threshold('skip', 'atlanan', 'skippedExports', [1, 5, 10, 25, 50],
    (g) => (g === 1 ? 'Atlandı' : `${g} Atlanan`),
    (g) => `Atlanan sayfaları ${g} kez dışa aktar.`, '⏭️'),
  ...threshold('rot', 'donusum', 'rotations', [1, 10, 50, 100, 500],
    (g) => (g === 1 ? 'İlk Dönüş' : `${g} Döndürme`),
    (g) => `Sayfayı ${g} kez döndür.`, '🔄'),
  ...threshold('mir', 'donusum', 'mirrors', [1, 10, 50, 100],
    (g) => (g === 1 ? 'Ayna Ayna' : `${g} Ayna`),
    (g) => `${g} kez ayna uygula.`, '🪞'),
  ...threshold('con', 'donusum', 'contrastAdjusts', [1, 10, 50, 100],
    (g) => (g === 1 ? 'Kontrast' : `${g} Kontrast`),
    (g) => `Kontrastı ${g} kez ayarla.`, '🌗'),
  ...threshold('basket', 'sepet', 'basketSaves', [1, 10, 50, 100, 250],
    (g) => (g === 1 ? 'İlk Sepet' : `${g} Sepet`),
    (g) => `Sepet modunda ${g} kez kaydet.`, '🧺'),
  ...threshold('range', 'aralik', 'rangeSaves', [1, 10, 50, 100, 250],
    (g) => (g === 1 ? 'İlk Aralık' : `${g} Aralık`),
    (g) => `Aralık modunda ${g} kez kaydet.`, '📐'),
  ...threshold('fp', 'ilksayfa', 'firstPageSets', [1, 10, 50],
    (g) => (g === 1 ? 'İlk Sayfa' : `${g} İlk Sayfa`),
    (g) => `${g} kez ilk sayfa ayarla.`, '🚩'),
  ...threshold('restore', 'geri', 'restores', [1, 10, 50],
    (g) => (g === 1 ? 'Geri Al' : `${g} Geri Alma`),
    (g) => `${g} kez geri alma yap.`, '↩️'),
  ...threshold('lvl', 'seviye', 'level', [1, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 75, 80, 90, 100],
    (g) => (g === 1 ? 'Çırak' : `Seviye ${g}`),
    (g) => (g === 1 ? '1. seviyeye ulaş (oyuna başla).' : `${g}. seviyeye ulaş.`), '⭐'),
  ...threshold('tnt', 'tnt', 'tntBooms', [1, 10, 50, 100],
    (g) => (g === 1 ? 'BUM!' : `${g} TNT`),
    (g) => `TNT'yi ${g} kez patlat.`, '🧨'),
  ...threshold('mob', 'savas', 'mobKills', [1, 10, 25, 50, 100, 250, 500, 1000],
    (g) => (g === 1 ? 'İlk Av' : `${g} Yaratık`),
    (g) => `${g} yaratık öldür.`, '⚔️'),
  ...threshold('boss', 'savas', 'bossKills', [1, 5, 10, 25, 50],
    (g) => (g === 1 ? 'Boss Avcısı' : `${g} Boss`),
    (g) => `${g} boss öldür.`, '☠️'),
  ...threshold('enrage', 'savas', 'enrageKills', [1, 5, 10],
    (g) => (g === 1 ? 'Öfke Avı' : `${g} Öfkeli`),
    (g) => `${g} öfkeli boss öldür.`, '🔥'),
  ...threshold('shop', 'magaza', 'shopBuys', [1, 5, 10, 25, 50, 100],
    (g) => (g === 1 ? 'İlk Alışveriş' : `${g} Alışveriş`),
    (g) => `Mağazadan ${g} kez satın al.`, '🛒'),
  ...threshold('night', 'hayatta', 'nightsLived', [1, 7, 14, 30, 60, 100],
    (g) => (g === 1 ? 'Gün Doğumu' : `${g} Gece`),
    (g) => `${g} gece hayatta kal.`, '☀️'),
  ...threshold('deadly', 'hayatta', 'deadlyNights', [1, 5, 10],
    (g) => (g === 1 ? 'Ölümcül' : `${g} Ölümcül`),
    (g) => `Ölümcül modda ${g} gece geçir.`, '🩸'),
  ...threshold('coin', 'coin', 'coinsEarned', [100, 250, 500, 1000, 5000, 10000],
    (g) => `${g} Coin`,
    (g) => `Toplam ${g} coin kazan.`, '💰'),
  ...threshold('death', 'hayatta', 'deaths', [1, 10, 25],
    (g) => (g === 1 ? 'İlk Ölüm' : `${g} Ölüm`),
    (g) => `${g} kez öl.`, '💀'),
  ...threshold('tali', 'magaza', 'talismanUses', [1, 10, 25, 50, 100],
    (g) => (g === 1 ? 'Tılsım' : `${g} Tılsım`),
    (g) => `${g} tılsım kullan.`, '✨'),
  ...threshold('minehr', 'hayatta', 'minecraftMs', [3_600_000, 7_200_000, 28_800_000],
    (g) => `${Math.round(g / 3_600_000)} Saat Maden`,
    (g) => `Madende ${Math.round(g / 3_600_000)} saat geçir.`, '⛏️'),
  ...threshold('meta', 'meta', 'unlockedCount', [10, 25, 50, 75, 100, 125, 150],
    (g) => `Koleksiyoncu ${g}`,
    (g) => `${g} başarım aç.`, '🏆'),
  // specials
  {
    id: 'sp_night', name: 'Gece Kuşu', desc: 'Gece yarısından sonra çalış (00:00–05:00).',
    icon: '🌙', category: 'ozel', xp: 150, check: (c) => c.nightOwl,
  },
  {
    id: 'sp_early', name: 'Erkenci Kuş', desc: 'Sabah erken çalış (05:00–07:00).',
    icon: '🌅', category: 'ozel', xp: 150, check: (c) => c.earlyBird,
  },
  {
    id: 'sp_streak', name: 'Sadık Madenci', desc: '7 gün üst üste giriş yap.',
    icon: '📅', category: 'ozel', xp: 500, goal: 7, metric: (c) => c.streakDays,
    check: (c) => c.streakDays >= 7,
  },
  {
    id: 'sp_marathon', name: 'Maraton', desc: 'Tek oturumda 25 kesim yap.',
    icon: '🏃', category: 'ozel', xp: 400, goal: 25, metric: (c) => c.sessionSplitsMax,
    check: (c) => c.sessionSplitsMax >= 25,
  },
  {
    id: 'sp_section100', name: 'Bölüm 100', desc: '100. bölüm numarasına ulaş.',
    icon: '💯', category: 'ozel', xp: 500, goal: 100, metric: (c) => c.maxSectionNo,
    check: (c) => c.maxSectionNo >= 100,
  },
  {
    id: 'sp_photo', name: 'Portre', desc: 'Profil fotoğrafı ekle.',
    icon: '🖼️', category: 'ozel', xp: 80, check: (c) => c.setPhoto,
  },
  {
    id: 'sp_bio', name: 'İmza', desc: 'Profil notu yaz.',
    icon: '✍️', category: 'ozel', xp: 80, check: (c) => c.wroteBio,
  },
  {
    id: 'sp_netherite', name: 'Netherite', desc: 'Netherite kılıç satın al.',
    icon: '🗡️', category: 'magaza', xp: 250, check: (c) => c.boughtNetheriteSword,
  },
];

export function achievementProgress(a: Achievement, ctx: AchCtx): { cur: number; goal: number } | null {
  if (!a.goal || !a.metric) return null;
  return { cur: Math.min(a.metric(ctx), a.goal), goal: a.goal };
}

// ── State store ──────────────────────────────────────────────────
let current: Progress = load();
const listeners = new Set<() => void>();

export type UnlockEvent =
  | { kind: 'achievement'; achievement: Achievement }
  | { kind: 'level'; level: number };
const unlockListeners = new Set<(e: UnlockEvent) => void>();

function load(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      ...defaultProgress(),
      ...parsed,
      stats: { ...DEFAULT_STATS, ...(parsed.stats ?? {}) },
      unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : [],
      daily: parseDaily(parsed.daily),
    };
  } catch {
    return defaultProgress();
  }
}

function persist(opts?: { disk?: boolean }) {
  if (!isSaveBootstrapped()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* ignore quota / private mode */
  }
  if (opts?.disk !== false) scheduleDiskSave();
}

export function reloadProgressFromStorage() {
  current = load();
  emitChange();
}

/** Re-evaluate all achievements (picks up newly added ones for existing saves). */
export function recheckAchievements() {
  commit(() => 0);
}

/** Fill counters from the live game/profile so old saves unlock new achievements. */
export function syncLegacyStats(opts: {
  deaths?: number;
  coins?: number;
  nights?: number;
  owned?: string[];
  hasPhoto?: boolean;
  hasBio?: boolean;
}) {
  commit((d) => {
    if (opts.deaths != null) d.stats.deaths = Math.max(d.stats.deaths ?? 0, opts.deaths);
    if (opts.coins != null) d.stats.coinsEarned = Math.max(d.stats.coinsEarned ?? 0, opts.coins);
    if (opts.nights != null) d.stats.nightsLived = Math.max(d.stats.nightsLived ?? 0, opts.nights);
    if (opts.owned?.includes('sword-netherite')) d.stats.boughtNetheriteSword = true;
    if (opts.hasPhoto) d.stats.setPhoto = true;
    if (opts.hasBio) d.stats.wroteBio = true;
    return 0;
  });
}

function emitChange() {
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getSnapshot(): Progress {
  return current;
}

export function subscribeUnlocks(cb: (e: UnlockEvent) => void): () => void {
  unlockListeners.add(cb);
  return () => unlockListeners.delete(cb);
}

export function ctxOf(p: Progress): AchCtx {
  return { ...p.stats, level: levelFromXp(p.xp).level, unlockedCount: p.unlocked.length };
}

// Core mutation: apply a stats patch + base xp, then re-evaluate achievements.
let xpMultiplierFn: () => number = () => 1;

export function setXpMultiplier(fn: () => number) {
  xpMultiplierFn = fn;
}

function commit(mutate: (draft: Progress) => number, opts?: { raw?: boolean }) {
  const draft: Progress = {
    ...current,
    stats: { ...current.stats },
    unlocked: [...current.unlocked],
    daily: { ...(current.daily ?? {}) },
  };
  const beforeLevel = levelFromXp(draft.xp).level;
  const baseXp = mutate(draft) || 0;
  const mult = opts?.raw ? 1 : Math.max(1, xpMultiplierFn());
  draft.xp += Math.max(0, Math.floor(baseXp * mult));

  // Evaluate achievements (loop because unlocking meta-achievements changes count)
  const newlyUnlocked: Achievement[] = [];
  for (let pass = 0; pass < 3; pass++) {
    const ctx = ctxOf(draft);
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (draft.unlocked.includes(a.id)) continue;
      if (a.check(ctx)) {
        draft.unlocked.push(a.id);
        draft.xp += a.xp;
        newlyUnlocked.push(a);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const afterLevel = levelFromXp(draft.xp).level;
  current = draft;
  persist();
  emitChange();

  newlyUnlocked.forEach((a) =>
    unlockListeners.forEach((l) => l({ kind: 'achievement', achievement: a })),
  );
  if (afterLevel > beforeLevel) {
    for (let lv = beforeLevel + 1; lv <= afterLevel; lv++) {
      unlockListeners.forEach((l) => l({ kind: 'level', level: lv }));
    }
  }
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function markTimeFlags(s: Stats) {
  const h = new Date().getHours();
  if (h >= 0 && h < 5) s.nightOwl = true;
  if (h >= 5 && h < 7) s.earlyBird = true;
}

// ── Public event API ─────────────────────────────────────────────
export function recordSession() {
  commit((d) => {
    d.sessionSplits = 0;
    const t = today();
    let xp = 100;
    if (d.lastActiveDay !== t) {
      // streak: consecutive calendar days
      const prev = new Date(d.lastActiveDay || t);
      const now = new Date(t);
      const diffDays = Math.round((now.getTime() - prev.getTime()) / 86400000);
      if (d.lastActiveDay && diffDays === 1) d.stats.streakDays += 1;
      else d.stats.streakDays = 1;
      d.lastActiveDay = t;
      xp += 500;
    }
    d.stats.sessions += 1;
    markTimeFlags(d.stats);
    return xp;
  });
}

function bumpDaily(d: Progress, patch: Partial<DailyWork>) {
  const t = today();
  const cur = (d.daily ?? {})[t] ?? { ...EMPTY_DAILY };
  d.daily = d.daily ?? {};
  d.daily[t] = {
    splits: cur.splits + Math.max(0, patch.splits ?? 0),
    pages: cur.pages + Math.max(0, patch.pages ?? 0),
    pdfs: cur.pdfs + Math.max(0, patch.pdfs ?? 0),
  };
  const keys = Object.keys(d.daily).sort();
  if (keys.length > DAILY_KEEP_DAYS) {
    for (const key of keys.slice(0, keys.length - DAILY_KEEP_DAYS)) delete d.daily[key];
  }
}

const MONTH_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export function shiftDayKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function formatDayLabel(key: string, todayKey = today()): string {
  if (key === todayKey) return 'Bugün';
  if (key === shiftDayKey(todayKey, -1)) return 'Dün';
  const [, m, d] = key.split('-');
  return `${Number(d)} ${MONTH_TR[Number(m) - 1] ?? ''}`.trim();
}

export function dailyOf(p: Progress, key: string): DailyWork {
  return (p.daily ?? {})[key] ?? EMPTY_DAILY;
}

export function dailySeries(p: Progress, days = 14): { key: string; label: string; splits: number; pages: number; pdfs: number }[] {
  const end = today();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = shiftDayKey(end, -i);
    const row = dailyOf(p, key);
    out.push({ key, label: formatDayLabel(key, end), ...row });
  }
  return out;
}

export function sumDaily(rows: Pick<DailyWork, 'splits' | 'pages' | 'pdfs'>[]): DailyWork {
  return rows.reduce(
    (acc, row) => ({
      splits: acc.splits + row.splits,
      pages: acc.pages + row.pages,
      pdfs: acc.pdfs + row.pdfs,
    }),
    { ...EMPTY_DAILY },
  );
}

export function recordPdfOpen() {
  commit((d) => {
    d.stats.pdfsOpened += 1;
    bumpDaily(d, { pdfs: 1 });
    markTimeFlags(d.stats);
    return 60;
  });
}

export function recordSplit(opts: { pages: number; mode: 'range' | 'basket'; sectionNo: number }) {
  commit((d) => {
    d.stats.splits += 1;
    d.stats.pagesSaved += Math.max(0, opts.pages);
    if (opts.mode === 'basket') d.stats.basketSaves += 1;
    else d.stats.rangeSaves += 1;
    d.stats.maxSectionNo = Math.max(d.stats.maxSectionNo, opts.sectionNo);
    d.sessionSplits += 1;
    d.stats.sessionSplitsMax = Math.max(d.stats.sessionSplitsMax, d.sessionSplits);
    bumpDaily(d, { splits: 1, pages: Math.max(0, opts.pages) });
    markTimeFlags(d.stats);
    return 100 + Math.max(0, opts.pages) * 18;
  });
}

export function recordExport(kind: 'notFound' | 'skipped') {
  commit((d) => {
    if (kind === 'notFound') d.stats.notFoundExports += 1;
    else d.stats.skippedExports += 1;
    return 50;
  });
}

export function recordRestore(n: number) {
  commit((d) => {
    d.stats.restores += 1;
    return 25 + Math.max(0, n) * 8;
  });
}

export function recordMark() {
  commit((d) => {
    d.stats.marks += 1;
    return 10;
  });
}

export function recordFirstPage() {
  commit((d) => {
    d.stats.firstPageSets += 1;
    return 20;
  });
}

export function recordAdjustment(kind: 'rotate' | 'mirror' | 'contrast') {
  commit((d) => {
    if (kind === 'rotate') d.stats.rotations += 1;
    else if (kind === 'mirror') d.stats.mirrors += 1;
    else d.stats.contrastAdjusts += 1;
    return 8;
  });
}

export function recordPageView() {
  commit((d) => {
    d.stats.pagesViewed += 1;
    return 0;
  });
}

export function recordTnt() {
  commit((d) => {
    d.stats.tntBooms += 1;
    return 20;
  });
}

export function grantXp(amount: number) {
  commit(() => Math.max(0, Math.floor(amount)), { raw: true });
}

export function recordMobKill(boss = false, enraged = false) {
  commit((d) => {
    d.stats.mobKills = (d.stats.mobKills ?? 0) + 1;
    if (boss) d.stats.bossKills = (d.stats.bossKills ?? 0) + 1;
    if (enraged) d.stats.enrageKills = (d.stats.enrageKills ?? 0) + 1;
    return 0;
  });
}

export function recordShopBuy(itemId?: string) {
  commit((d) => {
    d.stats.shopBuys = (d.stats.shopBuys ?? 0) + 1;
    if (itemId === 'sword-netherite') d.stats.boughtNetheriteSword = true;
    return 30;
  });
}

export function recordNight(deadly = false) {
  commit((d) => {
    d.stats.nightsLived = (d.stats.nightsLived ?? 0) + 1;
    if (deadly) d.stats.deadlyNights = (d.stats.deadlyNights ?? 0) + 1;
    return 80;
  });
}

export function recordCoins(n: number) {
  const amt = Math.max(0, Math.floor(n));
  if (amt <= 0) return;
  commit((d) => {
    d.stats.coinsEarned = (d.stats.coinsEarned ?? 0) + amt;
    return 0;
  });
}

export function recordDeath() {
  commit((d) => {
    d.stats.deaths = (d.stats.deaths ?? 0) + 1;
    return 0;
  });
}

export function recordTalisman() {
  commit((d) => {
    d.stats.talismanUses = (d.stats.talismanUses ?? 0) + 1;
    return 40;
  });
}

export function recordProfilePhoto() {
  commit((d) => {
    if (d.stats.setPhoto) return 0;
    d.stats.setPhoto = true;
    return 0;
  });
}

export function recordProfileBio() {
  commit((d) => {
    if (d.stats.wroteBio) return 0;
    d.stats.wroteBio = true;
    return 0;
  });
}

let themeAcc = 0;

/** Accumulate theme playtime without firing level/achievement popups. */
export function addThemeMs(theme: 'minecraft' | 'classic', dt: number) {
  const ms = Math.max(0, Math.floor(dt));
  if (ms <= 0) return;
  const key = theme === 'classic' ? 'classicMs' : 'minecraftMs';
  current = {
    ...current,
    stats: { ...current.stats, [key]: Math.max(0, (current.stats[key] ?? 0) + ms) },
  };
  themeAcc += ms;
  if (themeAcc >= 15_000) {
    themeAcc = 0;
    persist();
  }
}

export function flushThemeStats() {
  if (themeAcc <= 0) return;
  themeAcc = 0;
  persist();
}

function cumulativeXpAtLevelStart(target: number): number {
  let sum = 0;
  for (let l = 1; l < target; l++) sum += xpForLevel(l);
  return sum;
}

/** Death penalty: lose half of the XP earned in the current level. Level itself stays. */
export function loseHalfCurrentLevelXp() {
  const info = levelFromXp(current.xp);
  const loss = Math.floor(info.intoLevel * 0.5);
  if (loss <= 0) return;
  const floorXp = cumulativeXpAtLevelStart(info.level);
  current = { ...current, xp: Math.max(floorXp, current.xp - loss) };
  persist();
  emitChange();
}

// Legacy: drop to the start of the previous level (min level 1).
export function demoteOneLevel() {
  const lvl = levelFromXp(current.xp).level;
  const target = Math.max(1, lvl - 1);
  current = { ...current, xp: cumulativeXpAtLevelStart(target) };
  persist();
  emitChange();
}

/** Wipe XP, achievements and stats. Starts at level 1. */
export function resetProgress() {
  current = defaultProgress();
  persist({ disk: false });
  emitChange();
}
