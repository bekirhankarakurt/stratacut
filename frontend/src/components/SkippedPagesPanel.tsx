import { useMemo, useState } from 'react';
import Button from './ui/Button';
import Card from './ui/Card';
import Input from './ui/Input';

export default function SkippedPagesPanel({
  skippedPages,
  selectedSkipped,
  skippedOutputDir,
  skippedSectionNo,
  busy,
  open,
  onToggleOpen,
  onToggleSkipped,
  onSelectPages,
  onClearSelection,
  onSelectPage,
  onSkippedOutputDirChange,
  onSkippedSectionNoChange,
  onPickFolder,
  onExportToSkippedFolder,
  onAddToBasket,
}: {
  skippedPages: Set<number>;
  selectedSkipped: Set<number>;
  skippedOutputDir: string;
  skippedSectionNo: number;
  busy: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onToggleSkipped: (page: number) => void;
  onSelectPages: (pages: number[]) => void;
  onClearSelection: () => void;
  onSelectPage: (page: number) => void;
  onSkippedOutputDirChange: (dir: string) => void;
  onSkippedSectionNoChange: (n: number) => void;
  onPickFolder: () => Promise<string | null>;
  onExportToSkippedFolder: () => Promise<void>;
  onAddToBasket: () => void;
}) {
  const [filter, setFilter] = useState('');
  const [exporting, setExporting] = useState(false);

  const skippedSorted = useMemo(() => [...skippedPages].sort((a, b) => a - b), [skippedPages]);

  const filteredPages = useMemo(() => {
    const q = filter.trim();
    if (!q) return skippedSorted;
    const parts = q.split(/[\s,]+/).filter(Boolean);
    if (parts.length === 0) return skippedSorted;
    const out = new Set<number>();
    for (const part of parts) {
      if (part.includes('-')) {
        const [aRaw, bRaw] = part.split('-');
        const a = Number(aRaw);
        const b = Number(bRaw);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          for (let p = lo; p <= hi; p++) {
            if (skippedPages.has(p)) out.add(p);
          }
        }
      } else {
        const n = Number(part);
        if (Number.isFinite(n) && skippedPages.has(n)) out.add(n);
      }
    }
    return [...out].sort((a, b) => a - b);
  }, [filter, skippedPages, skippedSorted]);

  const selectedCount = selectedSkipped.size;
  const canExport = selectedCount > 0 && skippedOutputDir.trim().length > 0;

  return (
    <Card padding="none" className="overflow-hidden border-violet-200/50">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 bg-gradient-to-r from-violet-50/90 via-white to-violet-50/40 px-3 py-2 text-left text-sm font-semibold text-violet-950 hover:from-violet-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30"
        onClick={onToggleOpen}
      >
        <span className="flex items-center gap-1.5">
          Atlanan Sayfalar
          {skippedSorted.length > 0 ? (
            <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800">
              {skippedSorted.length}
            </span>
          ) : null}
          {selectedCount > 0 ? (
            <span className="rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-bold text-accent-800">
              {selectedCount} seçili
            </span>
          ) : null}
        </span>
        <span className="text-xs font-normal text-slate-500">{open ? 'Gizle' : 'Göster'}</span>
      </button>

      {open ? (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2">
          {skippedSorted.length === 0 ? (
            <p className="text-xs text-slate-500">Atlanan sayfa yok.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-slate-600">
                İşlenmemiş veya sepet aralığında atlanmış sayfalar. Seçip atlanan klasöre kaydedebilir veya normal
                sepete ekleyebilirsiniz.
              </p>

              {skippedSorted.length > 15 ? (
                <div className="mb-2">
                  <Input
                    label="Filtre (sayfa veya aralık)"
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Örn: 12 veya 40-50"
                  />
                </div>
              ) : null}

              <div className="mb-2 flex flex-wrap gap-1">
                <Button
                  size="sm"
                  disabled={busy || filteredPages.length === 0}
                  onClick={() => onSelectPages(filteredPages)}
                >
                  {filter.trim() ? 'Filtreyi seç' : 'Tümünü seç'}
                </Button>
                <Button size="sm" disabled={busy || selectedCount === 0} onClick={onClearSelection}>
                  Seçimi temizle
                </Button>
              </div>

              <div className="mb-3 max-h-36 overflow-auto rounded-lg border border-violet-100 bg-violet-50/50 p-2">
                <div className="flex flex-wrap gap-1">
                  {filteredPages.length === 0 ? (
                    <span className="text-xs text-slate-500">Filtreye uyan sayfa yok.</span>
                  ) : (
                    filteredPages.map((p) => {
                      const sel = selectedSkipped.has(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            onSelectPage(p);
                            onToggleSkipped(p);
                          }}
                          title={sel ? `Sayfa ${p} — seçili, tıkla kaldır` : `Sayfa ${p} — seç`}
                          className={[
                            'animate-chip-in rounded-full px-2 py-0.5 text-xs font-semibold transition-transform duration-150',
                            'hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30',
                            'disabled:opacity-50',
                            sel
                              ? 'bg-violet-600 text-white ring-2 ring-violet-400/60'
                              : 'bg-white text-violet-900 ring-1 ring-violet-200 hover:bg-violet-100',
                          ].join(' ')}
                        >
                          {p}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  label="Atlanan bölüm no"
                  type="number"
                  min={1}
                  step={1}
                  value={skippedSectionNo}
                  onChange={(e) => onSkippedSectionNoChange(Number(e.target.value))}
                />
                <div className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
                  <span>Atlanan Klasörü</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Atlanan PDF'ler için klasör…"
                      value={skippedOutputDir}
                      onChange={(e) => onSkippedOutputDirChange(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-violet-500/20"
                    />
                    <Button
                      disabled={busy}
                      onClick={async () => {
                        const p = await onPickFolder();
                        if (p) onSkippedOutputDirChange(p);
                      }}
                    >
                      Seç…
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="accent"
                  disabled={busy || !canExport}
                  loading={exporting}
                  className="w-full"
                  onClick={async () => {
                    setExporting(true);
                    try {
                      await onExportToSkippedFolder();
                    } finally {
                      setExporting(false);
                    }
                  }}
                >
                  Atlanan Klasöre Kaydet ({selectedCount || 0} sayfa)
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy || selectedCount === 0}
                  className="w-full"
                  onClick={onAddToBasket}
                >
                  Normal Sepete Ekle ({selectedCount || 0} sayfa)
                </Button>
              </div>

              {!skippedOutputDir.trim() && selectedCount > 0 ? (
                <p className="mt-2 text-xs text-violet-700">Atlanan klasörü seçmeden dışa aktarılamaz.</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </Card>
  );
}
