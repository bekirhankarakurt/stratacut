export type GraphicsQuality = 'high' | 'medium' | 'low';

export type AppSettings = {
  targetOutputDir: string;
  notFoundOutputDir: string;
  recentFolders: string[];
  notFoundSectionNo: number;
  panelOpacity: number;
  graphicsQuality: GraphicsQuality;
  nightMobs: boolean;
  deadlyMode: boolean;
  playerName: string;
};

export const APP_SETTINGS_KEY = 'pdfsplitterpro-app-settings-v1';
const MAX_RECENT = 8;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  targetOutputDir: '',
  notFoundOutputDir: '',
  recentFolders: [],
  notFoundSectionNo: 1,
  panelOpacity: 0.82,
  graphicsQuality: 'high',
  nightMobs: true,
  deadlyMode: false,
  playerName: '',
};

const graphicsListeners = new Set<() => void>();
const settingsListeners = new Set<() => void>();
let currentGraphics: GraphicsQuality = DEFAULT_APP_SETTINGS.graphicsQuality;

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      targetOutputDir: parsed.targetOutputDir ?? '',
      notFoundOutputDir: parsed.notFoundOutputDir ?? '',
      recentFolders: Array.isArray(parsed.recentFolders)
        ? parsed.recentFolders.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).slice(0, MAX_RECENT)
        : [],
      notFoundSectionNo:
        typeof parsed.notFoundSectionNo === 'number' && parsed.notFoundSectionNo >= 1
          ? parsed.notFoundSectionNo
          : 1,
      panelOpacity: clampOpacity(parsed.panelOpacity),
      graphicsQuality: clampGraphics(parsed.graphicsQuality),
      nightMobs: parsed.nightMobs !== false,
      deadlyMode: parsed.deadlyMode === true,
      playerName: typeof parsed.playerName === 'string' ? parsed.playerName.trim().slice(0, 24) : '',
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export function saveAppSettings(patch: Partial<AppSettings>) {
  const current = loadAppSettings();
  const next: AppSettings = {
    targetOutputDir: patch.targetOutputDir ?? current.targetOutputDir,
    notFoundOutputDir: patch.notFoundOutputDir ?? current.notFoundOutputDir,
    recentFolders: patch.recentFolders ?? current.recentFolders,
    notFoundSectionNo: patch.notFoundSectionNo ?? current.notFoundSectionNo,
    panelOpacity: clampOpacity(patch.panelOpacity ?? current.panelOpacity),
    graphicsQuality: clampGraphics(patch.graphicsQuality ?? current.graphicsQuality),
    nightMobs: patch.nightMobs ?? current.nightMobs,
    deadlyMode: patch.deadlyMode ?? current.deadlyMode,
    playerName: typeof patch.playerName === 'string' ? patch.playerName.trim().slice(0, 24) : current.playerName,
  };
  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(next));
  applyPanelOpacity(next.panelOpacity);
  applyGraphicsQuality(next.graphicsQuality);
  settingsListeners.forEach((l) => l());
  return next;
}

function clampOpacity(v: unknown): number {
  const n = typeof v === 'number' ? v : DEFAULT_APP_SETTINGS.panelOpacity;
  return Math.min(1, Math.max(0.35, n));
}

export function applyPanelOpacity(value: number) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--panel-alpha', String(clampOpacity(value)));
}

function clampGraphics(v: unknown): GraphicsQuality {
  return v === 'medium' || v === 'low' || v === 'high' ? v : DEFAULT_APP_SETTINGS.graphicsQuality;
}

export function getGraphicsQuality(): GraphicsQuality {
  return currentGraphics;
}

export function applyGraphicsQuality(value: GraphicsQuality) {
  currentGraphics = clampGraphics(value);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.graphics = currentGraphics;
  }
  graphicsListeners.forEach((l) => l());
}

export function subscribeGraphics(cb: () => void): () => void {
  graphicsListeners.add(cb);
  return () => graphicsListeners.delete(cb);
}

export function nightMobsEnabled(): boolean {
  return loadAppSettings().nightMobs;
}

export function deadlyModeEnabled(): boolean {
  return loadAppSettings().deadlyMode === true;
}

export function subscribeAppSettings(cb: () => void): () => void {
  settingsListeners.add(cb);
  return () => settingsListeners.delete(cb);
}

export function rememberRecentFolder(path: string): AppSettings {
  const trimmed = path.trim();
  if (!trimmed) return loadAppSettings();
  const current = loadAppSettings();
  const recentFolders = [trimmed, ...current.recentFolders.filter((p) => p !== trimmed)].slice(0, MAX_RECENT);
  return saveAppSettings({ recentFolders });
}

export function folderLabel(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 2) return path;
  return `…/${parts.slice(-2).join('/')}`;
}
