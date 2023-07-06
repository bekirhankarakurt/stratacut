export type ShortcutActionId =
  | 'setFirstPage'
  | 'setSecondPage'
  | 'markNotFound'
  | 'splitSave'
  | 'deleteLastOutput'
  | 'rotatePage';

export type ShortcutBindings = Record<ShortcutActionId, string>;

export const SHORTCUT_STORAGE_KEY = 'pdfsplitterpro-shortcuts-v1';

export const SHORTCUT_ACTION_IDS: ShortcutActionId[] = [
  'setFirstPage',
  'setSecondPage',
  'markNotFound',
  'splitSave',
  'rotatePage',
  'deleteLastOutput',
];

export const DEFAULT_SHORTCUTS: ShortcutBindings = {
  setFirstPage: 'b',
  setSecondPage: 'n',
  markNotFound: 'f',
  splitSave: 's',
  deleteLastOutput: 'Backspace',
  rotatePage: 'r',
};

export const SHORTCUT_LABELS: Record<ShortcutActionId, string> = {
  setFirstPage: 'Seçili sayfayı ilk sayfa yap',
  setSecondPage: 'Seçili sayfayı ikinci sayfa yap',
  markNotFound: 'Seçili sayfayı bulunamadı yap',
  splitSave: 'Kes ve kaydet',
  deleteLastOutput: 'Son kesilen PDF’i sil',
  rotatePage: 'Seçili sayfayı 90° döndür',
};

export const SHORTCUT_HINTS: Record<ShortcutActionId, string> = {
  setFirstPage: 'Önizlemedeki sayfayı ilk sayfa alanına yazar.',
  setSecondPage: 'Önizlemedeki sayfayı ikinci sayfa alanına yazar.',
  markNotFound: 'Önizlemedeki sayfayı bulunamadı sepetine ekler veya çıkarır.',
  splitSave: 'Parçalama formunu gönderir (Kes ve Kaydet). Bulunamadı sepetini de kaydeder.',
  deleteLastOutput: 'İlk basışta onay ister, ikinci basışta son kaydı siler.',
  rotatePage: 'Önizlemedeki sayfayı saat yönünde 90° döndürür.',
};

export function loadShortcutBindings(): ShortcutBindings {
  try {
    const raw = localStorage.getItem(SHORTCUT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SHORTCUTS };
    const parsed = JSON.parse(raw) as Partial<ShortcutBindings>;
    return {
      setFirstPage: parsed.setFirstPage || DEFAULT_SHORTCUTS.setFirstPage,
      setSecondPage: parsed.setSecondPage || DEFAULT_SHORTCUTS.setSecondPage,
      markNotFound: parsed.markNotFound || DEFAULT_SHORTCUTS.markNotFound,
      splitSave: parsed.splitSave || DEFAULT_SHORTCUTS.splitSave,
      deleteLastOutput: parsed.deleteLastOutput || DEFAULT_SHORTCUTS.deleteLastOutput,
      rotatePage: parsed.rotatePage || DEFAULT_SHORTCUTS.rotatePage,
    };
  } catch {
    return { ...DEFAULT_SHORTCUTS };
  }
}

export function assignShortcut(
  current: ShortcutBindings,
  action: ShortcutActionId,
  key: string,
): ShortcutBindings {
  const next = { ...current, [action]: key };
  for (const other of SHORTCUT_ACTION_IDS) {
    if (other !== action && next[other] === key) {
      next[other] = current[action];
    }
  }
  return next;
}

export function saveShortcutBindings(bindings: ShortcutBindings) {
  localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(bindings));
}

export function formatShortcutKey(key: string, doublePress = false): string {
  if (key === 'Backspace') return doublePress ? 'Backspace ×2' : 'Backspace';
  if (key === ' ') return 'Space';
  if (key === 'Enter') return 'Enter';
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return !!el.isContentEditable;
}

export function matchesShortcut(e: KeyboardEvent, key: string): boolean {
  if (isTypingTarget(e.target)) return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (key.length === 1 && /[a-z0-9]/i.test(key)) {
    return e.key.toLowerCase() === key.toLowerCase() && !e.shiftKey;
  }
  return e.key === key && !e.shiftKey;
}

export function captureShortcutKey(e: KeyboardEvent): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (['Tab', 'Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(e.key)) {
    return null;
  }
  if (e.key.length === 1) return e.key.toLowerCase();
  return e.key;
}
