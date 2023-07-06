import { useEffect, useMemo, useState } from 'react';
import { folderLabel } from '../utils/appSettings';
import { captureShortcutKey, formatShortcutKey } from '../utils/keyboardShortcuts';
import Button from './ui/Button';
import Card from './ui/Card';

export type NotFoundExportRecord = {
  pages: number[];
  filename: string;
  outputDir: string;
  at: number;
};

export default function NotFoundPanel({
  markedPages,
  exportedRecords,
  selectedPages,
  notFoundOutputDir,
  notFoundSectionNo,
  busy,
  open,
  selectedPage,
  markNotFoundShortcut = 'f',
  onToggleOpen,
  onToggleSelect,
  onSelectPages,
  onClearSelection,
  onSelectPage,
  onMarkPage,
  onUnmarkPages,
  onExport,
  onRestore,
  onOpenSettings,
  onRebindShortcut,
}: {
  markedPages: Set<number>;
  exportedRecords: NotFoundExportRecord[];
  selectedPages: Set<number>;
  notFoundOutputDir: string;
  notFoundSectionNo: number;
  busy: boolean;
  open: boolean;
  selectedPage: number;
  markNotFoundShortcut?: string;
  onToggleOpen: () => void;
  onToggleSelect: (page: number) => void;
  onSelectPages: (pages: number[]) => void;
  onClearSelection: () => void;
  onSelectPage: (page: number) => void;
  onMarkPage: (page: number) => void;
  onUnmarkPages: (pages: number[]) => void;
  onExport: () => Promise<void>;
  onRestore: (pages: number[]) => Promise<void>;
  onOpenSettings: () => void;
  onRebindShortcut?: (key: string) => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [recordingShortcut, setRecordingShortcut] = useState(false);

  const exportedPageSet = useMemo(() => {
    const s = new Set<number>();
    for (const r of exportedRecords) for (const p of r.pages) s.add(p);
    return s;
  }, [exportedRecords]);

  const allNotFound = useMemo(() => {
    const s = new Set<number>(markedPages);
    for (const r of exportedRecords) for (const p of r.pages) s.add(p);
    return [...s].sort((a, b) => a - b);
  }, [markedPages, exportedRecords]);

  const pendingPages = useMemo(
    () => [...markedPages].filter((p) => !exportedPageSet.has(p)).sort((a, b) => a - b),
    [markedPages, exportedPageSet],
  );

  const selectedPending = useMemo(
    () => [...selectedPages].filter((p) => markedPages.has(p) && !exportedPageSet.has(p)),
    [selectedPages, markedPages, exportedPageSet],
  );

  const selectedExported = useMemo(
    () => [...selectedPages].filter((p) => exportedPageSet.has(p)),
    [selectedPages, exportedPageSet],
  );

  const exportCount = selectedPending.length > 0 ? selectedPending.length : pendingPages.length;
  const hasFolder = notFoundOutputDir.trim().length > 0;
  const canExport = exportCount > 0;
  const shortcutLabel = formatShortcutKey(markNotFoundShortcut);

  useEffect(() => {
    if (!open) setRecordingShortcut(false);
  }, [open]);

  useEffect(() => {
    if (!recordingShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setRecordingShortcut(false);
        return;
      }
      const captured = captureShortcutKey(e);
      if (!captured) return;
      onRebindShortcut?.(captured);
      setRecordingShortcut(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recordingShortcut, onRebindShortcut]);

  return (
    <Card padding="none" className="overflow-hidden border-rose-200/50 shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 bg-gradient-to-r from-rose-50/90 via-white to-rose-50/40 px-3 py-2.5 text-left transition-colors hover:from-rose-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30"
        onClick={onToggleOpen}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-rose-950">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-[11px] font-bold text-white shadow-sm">
            ?
          </span>
          Bulunamadı
          {pendingPages.length > 0 ? (
            <span className="rounded-full bg-rose-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
              {pendingPages.length} bekliyor
            </span>
          ) : null}
        </span>
        <span className="text-xs text-rose-600">{open ? '▲ Gizle' : '▼ Göster'}</span>
      </button>

      {open ? (
        <div className="animate-panel-in space-y-3 border-t border-rose-100/80 px-3 pb-3 pt-3">
          <p className="text-[11px] leading-relaxed text-slate-600">
            Bulunamayan sayfaları sepet gibi işaretleyin. Seçtikleriniz (veya tüm bekleyenler){' '}
            <strong className="font-semibold text-rose-800">Kes ve Kaydet</strong> ile bulunamadı
            klasörüne yazılır. Gönderilenler <strong className="font-semibold text-rose-800">Geri al</strong>{' '}
            ile listeye döner.
          </p>

          {!hasFolder ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
              Bulunamadı klasörü henüz seçilmedi. Kaydetmeden önce konum seçin.{' '}
              <Button size="sm" variant="secondary" onClick={onOpenSettings}>
                Konum seç
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50/40 px-3 py-2 text-[11px]">
              <span className="min-w-0 truncate text-rose-900" title={notFoundOutputDir}>
                📂 {folderLabel(notFoundOutputDir)}
              </span>
              <span className="shrink-0 font-mono text-rose-700">Bölüm {String(notFoundSectionNo).padStart(3, '0')}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || exportedPageSet.has(selectedPage)}
              onClick={() => onMarkPage(selectedPage)}
              title={`Seçili sayfayı bulunamadı yap (${shortcutLabel})`}
            >
              Sayfa {selectedPage} → Bulunamadı ({shortcutLabel})
            </Button>
            <button
              type="button"
              onClick={() => setRecordingShortcut(true)}
              className={[
                'rounded-lg border px-2.5 py-1.5 font-mono text-xs font-bold transition-colors',
                recordingShortcut
                  ? 'border-rose-500 bg-rose-50 text-rose-800 ring-2 ring-rose-500/30'
                  : 'border-rose-200 bg-white text-rose-800 hover:border-rose-400 hover:bg-rose-50',
              ].join(' ')}
              title="Tıklayıp yeni bir kısayol tuşu atayın"
            >
              {recordingShortcut ? 'Tuşa bas…' : `Kısayol: ${shortcutLabel}`}
            </button>
            <Button
              size="sm"
              variant="danger"
              disabled={busy || !canExport || exporting}
              loading={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await onExport();
                } finally {
                  setExporting(false);
                }
              }}
            >
              Kes ve Kaydet ({exportCount})
            </Button>
          </div>
          <p className="text-[10px] text-slate-500">
            Kısayol tuşuna tıklayıp istediğiniz harfi atayın. {shortcutLabel} ile seçili sayfa işaretlenir / kaldırılır.
          </p>

          {allNotFound.length === 0 ? (
            <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/20 px-3 py-5 text-center text-xs text-rose-800/70">
              Önizlemedeki <strong>Bulunamadı</strong> butonunu veya <strong>{shortcutLabel}</strong> kısayolunu kullanın.
            </div>
          ) : (
            <>
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Liste — tıklayarak seçin, gönderin veya geri alın
              </div>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => onSelectPages(allNotFound)}>
                  Tümü
                </Button>
                <Button size="sm" variant="ghost" disabled={selectedPages.size === 0} onClick={onClearSelection}>
                  Temizle
                </Button>
                {selectedPages.size > 0 &&
                [...selectedPages].some((p) => markedPages.has(p) && !exportedPageSet.has(p)) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onUnmarkPages([...selectedPages].filter((p) => markedPages.has(p) && !exportedPageSet.has(p)))
                    }
                  >
                    İşareti kaldır
                  </Button>
                ) : null}
                {selectedExported.length > 0 ? (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy || restoring}
                    loading={restoring}
                    onClick={async () => {
                      setRestoring(true);
                      try {
                        await onRestore(selectedExported);
                      } finally {
                        setRestoring(false);
                      }
                    }}
                  >
                    Geri al ({selectedExported.length})
                  </Button>
                ) : null}
              </div>

              <div className="max-h-32 overflow-auto rounded-xl border border-rose-100/80 bg-white p-2 shadow-inner">
                <div className="flex flex-wrap gap-1.5">
                  {allNotFound.map((p) => {
                    const exported = exportedPageSet.has(p);
                    const selected = selectedPages.has(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          onSelectPage(p);
                          onToggleSelect(p);
                        }}
                        className={[
                          'animate-chip-in rounded-full px-2.5 py-1 text-xs font-bold transition-all duration-150',
                          'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]',
                          selected ? 'ring-2 ring-rose-500/45 ring-offset-1' : '',
                          exported
                            ? 'bg-rose-200/80 text-rose-950'
                            : 'bg-rose-100/90 text-rose-800',
                        ].join(' ')}
                        title={exported ? 'Gönderildi — Geri al ile döndürülür' : 'Henüz gönderilmedi'}
                      >
                        {p}
                        {exported ? ' ✓' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </Card>
  );
}
