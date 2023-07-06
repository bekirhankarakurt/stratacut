import { useEffect, useState } from 'react';
import {
  DEFAULT_SHORTCUTS,
  formatShortcutKey,
  loadShortcutBindings,
  saveShortcutBindings,
  SHORTCUT_ACTION_IDS,
  SHORTCUT_HINTS,
  SHORTCUT_LABELS,
  assignShortcut,
  type ShortcutActionId,
  type ShortcutBindings,
  captureShortcutKey,
} from '../utils/keyboardShortcuts';
import Button from './ui/Button';

export default function KeyboardShortcutsModal({
  open,
  onClose,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  onChange: (bindings: ShortcutBindings) => void;
}) {
  const [bindings, setBindings] = useState<ShortcutBindings>(() => loadShortcutBindings());
  const [recording, setRecording] = useState<ShortcutActionId | null>(null);

  useEffect(() => {
    if (open) setBindings(loadShortcutBindings());
  }, [open]);

  useEffect(() => {
    if (!open) setRecording(null);
  }, [open]);

  useEffect(() => {
    if (!open || !recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setRecording(null);
        return;
      }
      const captured = captureShortcutKey(e);
      if (!captured) return;
      setBindings((prev) => {
        const next = assignShortcut(prev, recording, captured);
        saveShortcutBindings(next);
        onChange(next);
        return next;
      });
      setRecording(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, recording, onChange]);

  if (!open) return null;

  const resetDefaults = () => {
    const next = { ...DEFAULT_SHORTCUTS };
    setBindings(next);
    saveShortcutBindings(next);
    onChange(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 id="shortcuts-title" className="text-base font-bold text-slate-900">
            Klavye Kısayolları
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Tuşa tıklayıp yeni bir kısayol atayın. Giriş alanlarındayken kısayollar devre dışıdır.
          </p>
        </div>

        <div className="max-h-[min(60vh,24rem)] overflow-auto px-4 py-3">
          <ul className="space-y-3">
            {SHORTCUT_ACTION_IDS.map((id) => (
              <li
                key={id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{SHORTCUT_LABELS[id]}</div>
                  <div className="mt-0.5 text-xs text-slate-600">{SHORTCUT_HINTS[id]}</div>
                </div>
                <button
                  type="button"
                  className={[
                    'shrink-0 rounded-lg border px-3 py-1.5 font-mono text-sm font-bold transition-colors',
                    recording === id
                      ? 'border-accent-500 bg-accent-50 text-accent-800 ring-2 ring-accent-500/30'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-accent-300 hover:bg-accent-50/50',
                  ].join(' ')}
                  onClick={() => setRecording(id)}
                >
                  {recording === id
                    ? 'Tuşa bas…'
                    : formatShortcutKey(bindings[id], id === 'deleteLastOutput')}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <div className="font-semibold text-slate-800">Diğer</div>
            <ul className="mt-1 space-y-1">
              <li>
                <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] shadow-sm">Ctrl+Z</kbd>{' '}
                — Sepet modunda geri al
              </li>
              <li>
                <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] shadow-sm">?</kbd>{' '}
                — Bu pencereyi aç/kapat
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <Button size="sm" variant="ghost" onClick={resetDefaults}>
            Varsayılana dön
          </Button>
          <Button size="sm" variant="primary" onClick={onClose}>
            Kapat
          </Button>
        </div>
      </div>
    </div>
  );
}
