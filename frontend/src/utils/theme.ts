export type UiTheme = 'minecraft' | 'classic';

const KEY = 'pdfsplitterpro-ui-theme-v1';
const listeners = new Set<() => void>();

let current: UiTheme = loadTheme();

export function loadTheme(): UiTheme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'classic' || v === 'minecraft') return v;
  } catch {
    /* ignore */
  }
  return 'classic';
}

export function getTheme(): UiTheme {
  return current;
}

export function persistTheme(theme: UiTheme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
}

/** Theme engines are loaded at boot. Switching requires a full UI reload. */
export function reloadWithTheme(theme: UiTheme) {
  persistTheme(theme);
  if (typeof window !== 'undefined') window.location.reload();
}

export function applyTheme(theme: UiTheme) {
  current = theme;
  persistTheme(theme);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('theme-classic', theme === 'classic');
    document.documentElement.classList.toggle('theme-minecraft', theme === 'minecraft');
  }
  listeners.forEach((l) => l());
}

export function subscribeTheme(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isMinecraft(): boolean {
  return current === 'minecraft';
}
