import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { exportedPagesAfterExclude, parseExcludedPagesSpec } from '../utils/pageSpec';
import { folderLabel } from '../utils/appSettings';
import { formatShortcutKey } from '../utils/keyboardShortcuts';
import { hasPageAdjustments, type PageAdjustment } from '../utils/pageAdjustments';
import { makeHashToken, sha256First8OfCsv, tokenPreviewForSortedUnique } from '../utils/basketToken';
import Button from './ui/Button';
import Card from './ui/Card';
import Input from './ui/Input';
import { useTheme } from '../utils/useTheme';

export type SplitMode = 'range' | 'basket';

export type SplitValues = {
  splitMode: SplitMode;
  startPage: number;
  endPage: number;
  sectionNo: number;
  outputDir: string;
  firstPage: number | null;
  secondPage: number | null;
  allowOverwrite: boolean;
  excludedPages: number[] | null;
  basketPages: number[] | null;
};

function isPositiveInt(n: number): boolean {
  return Number.isFinite(n) && Number.isInteger(n) && n >= 1;
}

function formatExcluded(pages: number[] | null | undefined): string {
  if (!pages || pages.length === 0) return '';
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const segs: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j += 1;
    if (j > i) segs.push(`${sorted[i]}-${sorted[j]}`);
    else segs.push(String(sorted[i]));
    i = j + 1;
  }
  return segs.join(', ');
}

export type SplitFormHandle = {
  submit: () => void;
  setFirstPageFromSelected: () => boolean;
  setSecondPageFromSelected: () => boolean;
};

export type SplitFormProps = {
  pdfSessionId: string;
  pageCount: number;
  initialSectionNo: number;
  initialStartPage: number;
  initialEndPage: number | null;
  selectedPage: number;
  initialFirstPage: number | null;
  initialSecondPage: number | null;
  initialOutputDir: string;
  initialExcludedPages?: number[] | null;
  editMode: boolean;
  splitMode: SplitMode;
  basketPages: number[];
  pageAdjustments?: Record<number, PageAdjustment>;
  onSplitModeChange: (m: SplitMode) => void;
  onBasketPagesChange: (pages: number[]) => void;
  onToggleSelectedInBasket: () => void;
  onBasketUndo?: () => void;
  canBasketUndo?: boolean;
  basketUndoPulse?: boolean;
  onSectionNoChange: (n: number) => void;
  onPagesChange: (start: number, end: number | null) => void;
  onFirstPageChange: (n: number | null) => void;
  onSecondPageChange: (n: number | null) => void;
  onOpenSettings: () => void;
  onPickFolder: () => Promise<string | null>;
  onOutputDirChange: (dir: string) => void;
  onSubmit: (v: SplitValues) => Promise<void>;
  onExportPendingNotFound?: () => Promise<'exported' | 'empty' | 'blocked'>;
  busy: boolean;
  setFirstPageShortcut?: string;
  setSecondPageShortcut?: string;
  splitSaveShortcut?: string;
};

export default forwardRef<SplitFormHandle, SplitFormProps>(function SplitForm({
  pdfSessionId,
  pageCount,
  initialSectionNo,
  initialStartPage,
  initialEndPage,
  selectedPage,
  initialFirstPage,
  initialSecondPage,
  initialOutputDir,
  initialExcludedPages,
  editMode,
  splitMode,
  basketPages,
  pageAdjustments,
  onSplitModeChange,
  onBasketPagesChange,
  onToggleSelectedInBasket,
  onBasketUndo,
  canBasketUndo,
  basketUndoPulse,
  onSectionNoChange,
  onPagesChange,
  onFirstPageChange,
  onSecondPageChange,
  onOpenSettings,
  onPickFolder,
  onOutputDirChange,
  onSubmit,
  onExportPendingNotFound,
  busy,
  setFirstPageShortcut = 'b',
  setSecondPageShortcut = 'n',
  splitSaveShortcut = 's',
}, ref) {
  const [startPage, setStartPage] = useState(initialStartPage);
  const [endPageText, setEndPageText] = useState(initialEndPage == null ? '' : String(initialEndPage));
  const [sectionNo, setSectionNo] = useState(initialSectionNo);
  const [outputDir, setOutputDir] = useState(initialOutputDir);
  const [firstPage, setFirstPage] = useState<number | null>(initialFirstPage);
  const [secondPage, setSecondPage] = useState<number | null>(initialSecondPage);
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [excludedPagesText, setExcludedPagesText] = useState(() => formatExcluded(initialExcludedPages));
  const [hashToken, setHashToken] = useState<string | null>(null);
  const [submitSuccessFlash, setSubmitSuccessFlash] = useState(false);
  const [settingsPulse, setSettingsPulse] = useState(false);
  const [folderPulse, setFolderPulse] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const mc = useTheme() === 'minecraft';

  useEffect(() => setSectionNo(initialSectionNo), [initialSectionNo]);
  useEffect(() => setStartPage(initialStartPage), [initialStartPage]);
  useEffect(() => setEndPageText(initialEndPage == null ? '' : String(initialEndPage)), [initialEndPage]);
  useEffect(() => setFirstPage(initialFirstPage), [initialFirstPage]);
  useEffect(() => setSecondPage(initialSecondPage), [initialSecondPage]);
  useEffect(() => setOutputDir(initialOutputDir), [initialOutputDir]);
  useEffect(() => setAllowOverwrite(false), [editMode]);
  useEffect(() => setSubmitAttempted(false), [initialSectionNo, initialStartPage, initialEndPage, editMode]);
  useEffect(() => {
    setExcludedPagesText(formatExcluded(initialExcludedPages));
  }, [pdfSessionId, editMode, initialExcludedPages]);

  useEffect(() => {
    if (splitMode !== 'basket') {
      setHashToken(null);
      return;
    }
    const uniq = [...new Set(basketPages)].filter((n) => n >= 1 && n <= pageCount);
    uniq.sort((a, b) => a - b);
    const { needHash } = tokenPreviewForSortedUnique(uniq);
    if (!needHash) {
      setHashToken(null);
      return;
    }
    let cancelled = false;
    void sha256First8OfCsv(uniq).then((h) => {
      if (!cancelled) setHashToken(makeHashToken(h));
    });
    return () => {
      cancelled = true;
    };
  }, [splitMode, basketPages, pageCount]);

  const endPage = useMemo(() => {
    const t = endPageText.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }, [endPageText]);

  const parsedExcluded = useMemo(() => {
    if (endPage == null) return { ok: true as const, pages: [] as number[] };
    return parseExcludedPagesSpec(excludedPagesText, startPage, endPage, pageCount);
  }, [excludedPagesText, startPage, endPage, pageCount]);

  const exportedPages = useMemo(() => {
    if (endPage == null || !parsedExcluded.ok) return [] as number[];
    return exportedPagesAfterExclude(startPage, endPage, parsedExcluded.pages);
  }, [endPage, parsedExcluded, startPage]);

  const excludedPagesPayload = useMemo((): number[] | null => {
    if (!parsedExcluded.ok || parsedExcluded.pages.length === 0) return null;
    return parsedExcluded.pages;
  }, [parsedExcluded]);

  const basketSet = useMemo(() => new Set(basketPages), [basketPages]);
  const basketSortedUnique = useMemo(() => {
    const u = [...basketSet].filter((n) => n >= 1 && n <= pageCount);
    u.sort((a, b) => a - b);
    return u;
  }, [basketSet, pageCount]);

  const basketMin = basketSortedUnique.length ? basketSortedUnique[0]! : null;
  const basketMax = basketSortedUnique.length ? basketSortedUnique[basketSortedUnique.length - 1]! : null;

  const filename = useMemo(() => {
    const sec = String(sectionNo).padStart(3, '0');
    if (splitMode === 'basket') {
      if (basketSortedUnique.length === 0) return `bolum_${sec}_sayfa_(sepet boş).pdf`;
      const { token, needHash } = tokenPreviewForSortedUnique(basketSortedUnique);
      const t = needHash ? hashToken ?? 'H••••••••' : token;
      return `bolum_${sec}_sayfa_${t}.pdf`;
    }
    if (endPage == null) return `bolum_${sec}_sayfa_${startPage}-?.pdf`;
    const expected = endPage - startPage + 1;
    if (parsedExcluded.ok && exportedPages.length > 0 && exportedPages.length !== expected) {
      const { token, needHash } = tokenPreviewForSortedUnique(exportedPages);
      const t = needHash ? hashToken ?? 'H••••••••' : token;
      return `bolum_${sec}_sayfa_${t}.pdf`;
    }
    return `bolum_${sec}_sayfa_${startPage}-${endPage}.pdf`;
  }, [sectionNo, splitMode, basketSortedUnique, hashToken, startPage, endPage, parsedExcluded, exportedPages]);

  const validationError = useMemo(() => {
    if (!outputDir.trim()) return 'Çıktı klasörü boş olamaz.';
    if (!isPositiveInt(sectionNo)) return 'Bölüm numarası geçerli bir tam sayı olmalı (en az 1).';

    if (splitMode === 'range') {
      if (!isPositiveInt(startPage)) return 'Başlangıç sayfası geçerli bir tam sayı olmalı (en az 1).';
      if (startPage > pageCount) return `Başlangıç sayfası en fazla ${pageCount} olabilir.`;
      if (endPage == null) return 'Bitiş sayfası zorunlu.';
      if (!isPositiveInt(endPage)) return 'Bitiş sayfası geçerli bir tam sayı olmalı (en az 1).';
      if (startPage > endPage) return 'Başlangıç sayfası bitiş sayfasından büyük olamaz.';
      if (endPage > pageCount) return `Bitiş sayfası en fazla ${pageCount} olabilir.`;
      if (excludedPagesText.trim() && !parsedExcluded.ok) return parsedExcluded.message;
      if (parsedExcluded.ok && exportedPages.length === 0) {
        return 'En az bir sayfa dışa aktarılmalı; tüm sayfaları hariç tutamazsınız.';
      }
      if (firstPage != null) {
        if (!isPositiveInt(firstPage)) return 'İlk sayfa geçerli bir tam sayı olmalı.';
        if (firstPage < startPage || firstPage > endPage) {
          return 'İlk sayfa seçimi, seçilen aralığın içinde olmalı.';
        }
        if (parsedExcluded.ok && !exportedPages.includes(firstPage)) {
          return 'İlk sayfa hariç listesinde; dışa aktarılan sayfalar arasında olmalı.';
        }
      }
      if (secondPage != null) {
        if (!isPositiveInt(secondPage)) return 'İkinci sayfa geçerli bir tam sayı olmalı.';
        if (secondPage < startPage || secondPage > endPage) {
          return 'İkinci sayfa seçimi, seçilen aralığın içinde olmalı.';
        }
        if (parsedExcluded.ok && !exportedPages.includes(secondPage)) {
          return 'İkinci sayfa hariç listesinde; dışa aktarılan sayfalar arasında olmalı.';
        }
        if (firstPage != null && secondPage === firstPage) {
          return 'İkinci sayfa, ilk sayfa ile aynı olamaz.';
        }
      }
      return null;
    }

    if (basketPages.length === 0) return 'Sepette en az bir sayfa olmalı.';
    for (const p of basketPages) {
      if (!isPositiveInt(p) || p > pageCount) return `Sepette geçersiz sayfa: ${p}`;
    }
    if (firstPage != null) {
      if (!isPositiveInt(firstPage)) return 'İlk sayfa geçerli bir tam sayı olmalı.';
      if (!basketSet.has(firstPage)) return 'İlk sayfa, sepetteki sayfalardan biri olmalı.';
    }
    if (secondPage != null) {
      if (!isPositiveInt(secondPage)) return 'İkinci sayfa geçerli bir tam sayı olmalı.';
      if (!basketSet.has(secondPage)) return 'İkinci sayfa, sepetteki sayfalardan biri olmalı.';
      if (firstPage != null && secondPage === firstPage) {
        return 'İkinci sayfa, ilk sayfa ile aynı olamaz.';
      }
    }
    return null;
  }, [
    outputDir,
    splitMode,
    startPage,
    endPage,
    pageCount,
    sectionNo,
    firstPage,
    secondPage,
    excludedPagesText,
    parsedExcluded,
    exportedPages,
    basketPages,
    basketSet,
  ]);

  const firstPageSelectDisabledRange =
    endPage == null ||
    selectedPage < startPage ||
    selectedPage > endPage ||
    (parsedExcluded.ok && !exportedPages.includes(selectedPage));

  const firstPageSelectDisabledBasket = !basketSet.has(selectedPage);
  const firstPageSelectDisabled =
    splitMode === 'range' ? firstPageSelectDisabledRange : firstPageSelectDisabledBasket;
  const secondPageSelectDisabled = firstPageSelectDisabled || selectedPage === firstPage;

  const updateSecondPage = (n: number | null) => {
    setSecondPage(n);
    onSecondPageChange(n);
  };

  const updateFirstPage = (n: number | null) => {
    setFirstPage(n);
    onFirstPageChange(n);
    if (n != null && n === secondPage) {
      setSecondPage(null);
      onSecondPageChange(null);
    }
  };

  useImperativeHandle(ref, () => ({
    submit: () => {
      formRef.current?.requestSubmit();
    },
    setFirstPageFromSelected: () => {
      if (firstPageSelectDisabled) return false;
      updateFirstPage(selectedPage);
      return true;
    },
    setSecondPageFromSelected: () => {
      if (secondPageSelectDisabled) return false;
      updateSecondPage(selectedPage);
      return true;
    },
  }));

  const firstPageKeyLabel = formatShortcutKey(setFirstPageShortcut);
  const secondPageKeyLabel = formatShortcutKey(setSecondPageShortcut);
  const splitSaveKeyLabel = formatShortcutKey(splitSaveShortcut);

  return (
    <Card padding="none">
      <form
        ref={formRef}
        className="p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitAttempted(true);
          try {
            const notFoundResult = (await onExportPendingNotFound?.()) ?? 'empty';
            if (notFoundResult === 'blocked') return;
          } catch {
            return;
          }
          if (validationError) {
            if (!outputDir.trim()) {
              folderInputRef.current?.focus();
              setFolderPulse(true);
              setTimeout(() => setFolderPulse(false), 900);
              if (mc) {
                setSettingsPulse(true);
                setTimeout(() => setSettingsPulse(false), 900);
                onOpenSettings();
              }
            }
            return;
          }
          try {
            if (splitMode === 'range') {
              await onSubmit({
                splitMode: 'range',
                startPage,
                endPage: endPage!,
                sectionNo,
                outputDir,
                firstPage,
                secondPage,
                allowOverwrite,
                excludedPages: excludedPagesPayload,
                basketPages: null,
              });
            } else {
              const uniq = basketSortedUnique.length ? basketSortedUnique : [...basketPages];
              const lo = Math.min(...uniq);
              const hi = Math.max(...uniq);
              await onSubmit({
                splitMode: 'basket',
                startPage: lo,
                endPage: hi,
                sectionNo,
                outputDir,
                firstPage,
                secondPage,
                allowOverwrite,
                excludedPages: null,
                basketPages: [...uniq],
              });
            }
            setSubmitSuccessFlash(true);
            setTimeout(() => setSubmitSuccessFlash(false), 500);
          } catch {
            // parent toast handles error
          }
        }}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900">Parçalama</div>
          <div className="text-[11px] text-slate-500">
            {splitMode === 'range'
              ? 'bolum_XXX_sayfa_A-B.pdf'
              : 'bolum_XXX_sayfa_TOKEN.pdf'}
          </div>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5">
          <span className="text-xs font-semibold text-slate-600">Mod:</span>
          <Button
            size="sm"
            variant={splitMode === 'range' ? 'primary' : 'secondary'}
            disabled={busy}
            onClick={() => onSplitModeChange('range')}
          >
            Aralık
          </Button>
          <Button
            size="sm"
            variant={splitMode === 'basket' ? 'accent' : 'secondary'}
            disabled={busy}
            onClick={() => onSplitModeChange('basket')}
            className="gap-1.5"
          >
            Sepet
            {basketPages.length > 0 ? (
              <span
                className={[
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  splitMode === 'basket' ? 'bg-white text-accent-700' : 'bg-accent-600 text-white',
                ].join(' ')}
              >
                {basketPages.length}
              </span>
            ) : null}
          </Button>
        </div>

        {splitMode === 'range' ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              label="Başlangıç Sayfası"
              type="number"
              min={1}
              max={pageCount}
              step={1}
              value={startPage}
              onChange={(e) => {
                const v = Number(e.target.value);
                setStartPage(v);
                onPagesChange(v, endPage);
              }}
            />
            <Input
              label="Bitiş Sayfası"
              type="text"
              inputMode="numeric"
              value={endPageText}
              placeholder="(zorunlu)"
              onChange={(e) => {
                const t = e.target.value;
                setEndPageText(t);
                const v = t.trim() ? Number(t) : NaN;
                if (Number.isFinite(v) && Number.isInteger(v)) onPagesChange(startPage, v);
                else onPagesChange(startPage, null);
              }}
            />
            <div className="sm:col-span-2">
              <Input
                label="Hariç tutulacak sayfalar (opsiyonel)"
                type="text"
                value={excludedPagesText}
                onChange={(e) => setExcludedPagesText(e.target.value)}
                placeholder="Örn: 4, 7-8"
                disabled={endPage == null}
                hint="Sadece başlangıç–bitiş içindeki sayfalar yazılabilir."
              />
              <div className="mt-2">
                <Button
                  size="sm"
                  disabled={endPage == null || busy}
                  title={endPage == null ? 'Önce bitiş sayfası girin' : undefined}
                  onClick={() => setExcludedPagesText('')}
                >
                  Hariç listesini temizle
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-1 rounded-lg border border-accent-200 bg-accent-50 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-accent-900">Sepet</span>
                <span
                  className={[
                    'rounded-full px-2 py-0.5 text-xs font-bold',
                    basketPages.length > 0 ? 'bg-accent-600 text-white' : 'bg-slate-200 text-slate-500',
                  ].join(' ')}
                >
                  {basketPages.length} sayfa
                </span>
                {basketMin != null && basketMax != null ? (
                  <span className="text-xs text-slate-500">
                    ({basketMin}–{basketMax})
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || !canBasketUndo}
                  onClick={() => onBasketUndo?.()}
                  title={canBasketUndo ? 'Ctrl+Z' : 'Geri alınacak işlem yok'}
                  className={basketUndoPulse ? 'animate-pulse ring-2 ring-accent-500/50' : ''}
                >
                  ↩ Geri Al
                </Button>
                {basketPages.length > 0 ? (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() => onBasketPagesChange([])}
                  >
                    Sepeti Boşalt
                  </Button>
                ) : null}
              </div>
            </div>

            {basketPages.length === 0 ? (
              <p className="mb-3 text-xs text-accent-800">Thumbnail&apos;a tıklayarak sayfaları sepete ekleyin.</p>
            ) : (
              <div className="mb-3 flex max-h-20 flex-wrap gap-1 overflow-auto rounded-md border border-accent-100 bg-white p-2">
                {basketSortedUnique.map((pg) => (
                  <button
                    key={pg}
                    type="button"
                    disabled={busy}
                    onClick={() => onBasketPagesChange(basketPages.filter((x) => x !== pg))}
                    title={`Sayfa ${pg}'yi sepetten çıkar`}
                    className="animate-chip-in rounded-full bg-accent-100 px-2 py-0.5 text-xs font-semibold text-accent-900 transition-transform duration-150 hover:scale-105 hover:bg-rose-100 hover:text-rose-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600/30 disabled:opacity-50"
                  >
                    {pg}
                    {pageAdjustments && hasPageAdjustments(pageAdjustments[pg]) ? (
                      <span className="ml-0.5 text-[10px] text-amber-700">*</span>
                    ) : null}
                    {' ×'}
                  </button>
                ))}
              </div>
            )}

            <Button
              variant={basketSet.has(selectedPage) ? 'danger' : 'accent'}
              disabled={busy}
              onClick={onToggleSelectedInBasket}
              className="w-full"
            >
              {basketSet.has(selectedPage)
                ? `Sayfa ${selectedPage} — Sepetten Çıkar`
                : `Sayfa ${selectedPage} — Sepete Ekle`}
            </Button>
          </div>
        )}

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            label="Bölüm Numarası"
            type="number"
            min={1}
            step={1}
            value={sectionNo}
            onChange={(e) => {
              const n = Number(e.target.value);
              setSectionNo(n);
              onSectionNoChange(n);
            }}
          />

          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span>İlk Sayfa (opsiyonel)</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={pageCount}
                  step={1}
                  value={firstPage ?? ''}
                  placeholder={
                    splitMode === 'range'
                      ? `${startPage} (varsayılan)`
                      : basketMin != null
                        ? `${basketMin} (varsayılan)`
                        : '—'
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    updateFirstPage(raw === '' ? null : Number(raw));
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-accent-600/20"
                />
                <Button
                  size="sm"
                  disabled={firstPageSelectDisabled}
                  onClick={() => updateFirstPage(selectedPage)}
                  title={
                    firstPageSelectDisabled
                      ? splitMode === 'range'
                        ? 'Seçili sayfa aralıkta ve hariç listesinde olmamalı'
                        : 'Seçili sayfa sepette olmalı'
                      : `Seçili sayfayı ilk sayfa yap (${firstPageKeyLabel})`
                  }
                >
                  Seçili ({firstPageKeyLabel})
                </Button>
                <Button size="sm" disabled={firstPage == null} onClick={() => updateFirstPage(null)}>
                  Temizle
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span>İkinci Sayfa (opsiyonel)</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={pageCount}
                  step={1}
                  value={secondPage ?? ''}
                  placeholder="—"
                  onChange={(e) => {
                    const raw = e.target.value;
                    updateSecondPage(raw === '' ? null : Number(raw));
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-accent-600/20"
                />
                <Button
                  size="sm"
                  disabled={secondPageSelectDisabled}
                  onClick={() => updateSecondPage(selectedPage)}
                  title={
                    secondPageSelectDisabled
                      ? selectedPage === firstPage
                        ? 'İkinci sayfa, ilk sayfa ile aynı olamaz'
                        : splitMode === 'range'
                          ? 'Seçili sayfa aralıkta ve hariç listesinde olmamalı'
                          : 'Seçili sayfa sepette olmalı'
                      : `Seçili sayfayı ikinci sayfa yap (${secondPageKeyLabel})`
                  }
                >
                  Seçili ({secondPageKeyLabel})
                </Button>
                <Button size="sm" disabled={secondPage == null} onClick={() => updateSecondPage(null)}>
                  Temizle
                </Button>
              </div>
            </div>
          </div>

          {!mc ? (
            <div className="sm:col-span-2">
              <div className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                <span>Hedef Klasör</span>
                <div className="flex gap-2">
                  <input
                    ref={folderInputRef}
                    type="text"
                    placeholder="Klasör seçin…"
                    value={outputDir}
                    onChange={(e) => {
                      const v = e.target.value;
                      setOutputDir(v);
                      onOutputDirChange(v);
                    }}
                    className={[
                      'min-w-0 flex-1 rounded-lg border bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-accent-600/20',
                      folderPulse ? 'border-rose-400 ring-2 ring-rose-400/50' : 'border-slate-200',
                    ].join(' ')}
                  />
                  <Button
                    disabled={busy}
                    onClick={async () => {
                      const picked = await onPickFolder();
                      if (picked) {
                        setOutputDir(picked);
                        onOutputDirChange(picked);
                      }
                    }}
                  >
                    Seç…
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {mc ? (
        <div
          className={[
            'mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-all',
            outputDir.trim()
              ? 'border-accent-200/80 bg-accent-50/60 text-accent-900'
              : 'border-amber-200/80 bg-amber-50/80 text-amber-900',
            settingsPulse ? 'ring-2 ring-amber-400/60' : '',
          ].join(' ')}
        >
          <div className="min-w-0 flex-1">
            <span className="font-semibold">Kayıt klasörü: </span>
            {outputDir.trim() ? (
              <span className="font-mono text-[11px]" title={outputDir}>
                {folderLabel(outputDir)}
              </span>
            ) : (
              <span>Ayarlanmadı</span>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={onOpenSettings}>
            Ayarlar
          </Button>
        </div>
        ) : null}

        {editMode ? (
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={allowOverwrite}
              onChange={(e) => setAllowOverwrite(e.target.checked)}
              className="rounded border-slate-300 text-accent-600 focus:ring-accent-600/30"
            />
            Aynı isimli dosya varsa üzerine yaz (düzenleme modu)
          </label>
        ) : null}

        <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
          Kaydedilecek dosya adı: <span className="font-mono text-[11px]">{filename}</span>
        </div>

        {submitAttempted && validationError ? (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-900">
            {validationError}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="submit" variant="accent" loading={busy} disabled={busy}>
            {busy ? 'Kaydediliyor…' : submitSuccessFlash ? '✓ Kaydedildi' : `Kes ve Kaydet (${splitSaveKeyLabel})`}
          </Button>
          <div className="text-xs text-slate-500">
            {editMode
              ? allowOverwrite
                ? 'Üzerine yazma açık.'
                : 'Aynı isimde dosya varsa hata verilir (üstteki kutuyu işaretleyin).'
              : 'Aynı isimde dosya varsa üzerine yazılmaz.'}
          </div>
        </div>
      </form>
    </Card>
  );
});
