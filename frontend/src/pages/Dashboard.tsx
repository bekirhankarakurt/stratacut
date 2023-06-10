import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { apiPostEmpty, apiPostFile, apiPostJson } from '../api/client';
import KeyboardShortcutsModal from '../components/KeyboardShortcutsModal';
import NotFoundPanel, { type NotFoundExportRecord } from '../components/NotFoundPanel';
import SettingsModal from '../components/SettingsModal';
import {
  loadAppSettings,
  rememberRecentFolder,
  saveAppSettings,
  type AppSettings,
} from '../utils/appSettings';
import {
  assignShortcut,
  formatShortcutKey,
  loadShortcutBindings,
  matchesShortcut,
  saveShortcutBindings,
  type ShortcutBindings,
} from '../utils/keyboardShortcuts';
import {
  buildAdjustmentsPayload,
  DEFAULT_PAGE_ADJUSTMENT,
  getPageAdjustment,
  type PageAdjustment,
} from '../utils/pageAdjustments';
import { exportedPagesAfterExclude } from '../utils/pageSpec';
import PagePreview from '../components/PagePreview';
import SkippedPagesPanel from '../components/SkippedPagesPanel';
import SplitForm, { SplitFormHandle, SplitMode, SplitValues } from '../components/SplitForm';
import ThumbGrid from '../components/ThumbGrid';
import Toasts, { Toast } from '../components/Toasts';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import DailyStatsModal from '../components/DailyStatsModal';
import { useTheme } from '../utils/useTheme';

import {
  recordAdjustment,
  recordExport,
  recordFirstPage,
  recordMark,
  recordPdfOpen,
  recordRestore,
  recordSession,
  recordSplit,
} from '../utils/progression';

const TitleScreen = lazy(() => import('../components/TitleScreen'));
const AchievementsModal = lazy(() => import('../components/AchievementsModal'));
const AchievementPopup = lazy(() => import('../components/AchievementPopup'));
const XpBar = lazy(() => import('../components/XpBar'));
const GameHud = lazy(() => import('../components/GameHud'));
const ShopModal = lazy(() => import('../components/ShopModal'));
const AvatarPanel = lazy(() => import('../components/AvatarPanel'));
const LanRanksModal = lazy(() => import('../components/LanRanksModal'));
const GameOverlays = lazy(() => import('../components/GameOverlays'));

type PdfOpenResponse = { id: string; filename: string; pageCount: number };
type SplitResponse = { outputPath: string; filename: string; sectionNo: number; startPage: number; endPage: number };
type PickFolderResponse = { path: string | null };
type OutputScanFile = { filename: string; pages: number[] };
type OutputScanResponse = {
  coveredPages: number[];
  ranges: [number, number][];
  maxSectionNo: number;
  notFoundPages?: number[];
  notFoundMaxSectionNo?: number;
  notFoundFiles?: OutputScanFile[];
};
type SplitHistoryItem = SplitResponse & {
  at: number;
  outputDir: string;
  firstPage: number | null;
  secondPage: number | null;
  splitMode?: SplitMode;
  basketPages?: number[] | null;
  excludedPages?: number[] | null;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function mergeNotFoundRecords(
  prev: NotFoundExportRecord[],
  files: OutputScanFile[],
  nfDir: string,
): NotFoundExportRecord[] {
  if (!nfDir.trim()) return prev;
  const now = Date.now();
  const fromDisk: NotFoundExportRecord[] = files.map((f) => {
    const old = prev.find((r) => r.filename === f.filename && r.outputDir === nfDir);
    return { pages: f.pages, filename: f.filename, outputDir: nfDir, at: old?.at ?? now };
  });
  const diskKeys = new Set(fromDisk.map((r) => `${r.outputDir}::${r.filename}`));
  const extraSameDir = prev.filter(
    (r) => r.outputDir === nfDir && !diskKeys.has(`${r.outputDir}::${r.filename}`) && now - r.at < 12_000,
  );
  const otherDirs = prev.filter((r) => r.outputDir !== nfDir);
  return [...fromDisk, ...extraSameDir, ...otherDirs];
}

function DeleteHistoryButton({
  item,
  busy,
  onDeleted,
  onError,
}: {
  item: SplitHistoryItem;
  busy: boolean;
  onDeleted: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const reset = () => {
    setConfirming(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  return (
    <Button
      size="sm"
      variant="danger"
      className="ml-1"
      disabled={busy || deleting}
      loading={deleting}
      onClick={async () => {
        if (!confirming) {
          setConfirming(true);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setConfirming(false), 3000);
          return;
        }
        reset();
        setDeleting(true);
        try {
          await apiPostJson<{ ok: boolean }>('/api/system/delete-output', {
            outputDir: item.outputDir,
            filename: item.filename,
          });
          await onDeleted();
        } catch (e) {
          onError((e as Error).message);
        } finally {
          setDeleting(false);
        }
      }}
    >
      {confirming ? 'Emin misin?' : 'Sil'}
    </Button>
  );
}

export default function Dashboard() {
  const theme = useTheme();
  const mc = theme === 'minecraft';
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<PdfOpenResponse | null>(null);

  useEffect(() => {
    if (!mc) return;
    let cancelled = false;
    void import('../utils/lanBoard').then(({ setLanActivity }) => {
      if (cancelled) return;
      setLanActivity(pdf ? 'pdf' : 'idle');
    });
    return () => {
      cancelled = true;
      void import('../utils/lanBoard').then(({ setLanActivity }) => setLanActivity('idle'));
    };
  }, [mc, pdf]);
  const [selectedPage, setSelectedPage] = useState(1);
  const [sectionNo, setSectionNo] = useState(1);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState<number | null>(null);
  const [firstPage, setFirstPage] = useState<number | null>(null);
  const [secondPage, setSecondPage] = useState<number | null>(null);
  const [excludedPages, setExcludedPages] = useState<number[] | null>(null);
  const [pageAdjustments, setPageAdjustments] = useState<Record<number, PageAdjustment>>({});
  const [outputDir, setOutputDir] = useState(() => loadAppSettings().targetOutputDir);
  const [notFoundOutputDir, setNotFoundOutputDir] = useState(() => loadAppSettings().notFoundOutputDir);
  const [recentFolders, setRecentFolders] = useState<string[]>(() => loadAppSettings().recentFolders);
  const [editMode, setEditMode] = useState(false);
  const [formKey, setFormKey] = useState(1);
  const [history, setHistory] = useState<SplitHistoryItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [donePages, setDonePages] = useState<Set<number>>(() => new Set());
  const [splitMode, setSplitMode] = useState<SplitMode>('range');
  const [basketPages, setBasketPages] = useState<number[]>([]);
  const [basketUndoStack, setBasketUndoStack] = useState<number[][]>([]);
  const [undoPulse, setUndoPulse] = useState(false);
  const undoPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [skippedOutputDir, setSkippedOutputDir] = useState(() => loadAppSettings().notFoundOutputDir);
  const [skippedSectionNo, setSkippedSectionNo] = useState(1);
  const [selectedSkippedPages, setSelectedSkippedPages] = useState<Set<number>>(() => new Set());
  const [skippedPanelOpen, setSkippedPanelOpen] = useState(false);
  const [markedNotFoundPages, setMarkedNotFoundPages] = useState<Set<number>>(() => new Set());
  const [exportedNotFoundRecords, setExportedNotFoundRecords] = useState<NotFoundExportRecord[]>([]);
  const [selectedNotFoundPages, setSelectedNotFoundPages] = useState<Set<number>>(() => new Set());
  const [notFoundPanelOpen, setNotFoundPanelOpen] = useState(false);
  const [notFoundSectionNo, setNotFoundSectionNo] = useState(() => loadAppSettings().notFoundSectionNo);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const splitFormRef = useRef<SplitFormHandle | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [ranksOpen, setRanksOpen] = useState(false);
  const [shortcutBindings, setShortcutBindings] = useState<ShortcutBindings>(() => loadShortcutBindings());
  const [deleteLastConfirm, setDeleteLastConfirm] = useState(false);
  const deleteLastConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deletingLast, setDeletingLast] = useState(false);
  const scanInFlightRef = useRef(false);

  const currentPageAdjustment = useMemo(
    () => getPageAdjustment(pageAdjustments, selectedPage),
    [pageAdjustments, selectedPage],
  );

  const updateCurrentPageAdjustment = useCallback(
    (patch: Partial<PageAdjustment>) => {
      setPageAdjustments((prev) => ({
        ...prev,
        [selectedPage]: { ...DEFAULT_PAGE_ADJUSTMENT, ...prev[selectedPage], ...patch },
      }));
      // Track single-tool tweaks for achievements (skip multi-key resets).
      const keys = Object.keys(patch);
      if (keys.length === 1) {
        if ('rotate' in patch) recordAdjustment('rotate');
        else if ('mirrorH' in patch || 'mirrorV' in patch) recordAdjustment('mirror');
        else if ('contrast' in patch) recordAdjustment('contrast');
      }
    },
    [selectedPage],
  );

  useEffect(() => {
    recordSession();
  }, []);

  const pushBasketUndo = useCallback((prev: number[]) => {
    setBasketUndoStack((s) => [...s.slice(-19), [...prev]]);
  }, []);

  const setBasketPagesWithUndo = useCallback(
    (next: number[] | ((prev: number[]) => number[]), opts?: { pulse?: boolean }) => {
      setBasketPages((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        if (resolved === prev) return prev;
        const same =
          resolved.length === prev.length && resolved.every((v, i) => v === prev[i]);
        if (same) return prev;
        pushBasketUndo(prev);
        return resolved;
      });
      if (opts?.pulse) {
        setUndoPulse(true);
        if (undoPulseTimer.current) clearTimeout(undoPulseTimer.current);
        undoPulseTimer.current = setTimeout(() => setUndoPulse(false), 5000);
      }
    },
    [pushBasketUndo],
  );

  const undoBasket = useCallback(() => {
    setBasketUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1]!;
      setBasketPages(prev);
      setUndoPulse(false);
      return stack.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      if (splitMode !== 'basket') return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) return;
      e.preventDefault();
      undoBasket();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [splitMode, undoBasket]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scanDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScanErrorRef = useRef<string | null>(null);
  const donePagesRef = useRef<Set<number>>(donePages);
  donePagesRef.current = donePages;

  const setsEqual = useCallback((a: Set<number>, b: Set<number>) => {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
  }, []);

  const pushToast = useCallback((type: Toast['type'], message: string) => {
    setToasts((t) => [...t, { id: uid(), type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const scanOutputQuiet = useCallback(
    async (dir: string, nfDir: string) => {
      if (!dir.trim()) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (scanInFlightRef.current) return;
      scanInFlightRef.current = true;
      try {
        const res = await apiPostJson<OutputScanResponse>('/api/system/scan-output', {
          outputDir: dir,
          notFoundDir: nfDir.trim() || null,
        });
        const nfPageSet = new Set(res.notFoundPages ?? []);
        const next = new Set((res.coveredPages ?? []).filter((p) => !nfPageSet.has(p)));
        if (!setsEqual(donePagesRef.current, next)) {
          setDonePages(next);
        }
        if (nfDir.trim()) {
          setExportedNotFoundRecords((prev) => mergeNotFoundRecords(prev, res.notFoundFiles ?? [], nfDir.trim()));
        }
        lastScanErrorRef.current = null;
      } catch (e) {
        const raw = (e as Error).message || '';
        if (/failed to fetch|networkerror|load failed/i.test(raw)) return;
        const msg = `Çıktı klasörü taranamadı: ${raw}`;
        if (lastScanErrorRef.current !== msg) {
          lastScanErrorRef.current = msg;
          pushToast('error', msg);
        }
      } finally {
        scanInFlightRef.current = false;
      }
    },
    [pushToast, setsEqual],
  );

  const computeNextStartFromRanges = useCallback((pageCount: number, ranges: [number, number][]) => {
    if (pageCount <= 0) return 1;
    const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let p = 1;
    for (const [a0, b0] of sorted) {
      const a = Math.max(1, a0);
      const b = Math.max(1, b0);
      if (b < p) continue;
      if (a > p) break;
      p = b + 1;
      if (p > pageCount) break;
    }
    return Math.min(p, pageCount);
  }, []);

  const scanOutputAndMaybeSuggest = useCallback(
    async (dir: string, nfDir?: string, opts?: { forceSuggest?: boolean; pageCount?: number }) => {
      const notFoundDir = (nfDir ?? notFoundOutputDir).trim();
      if (!dir.trim()) {
        setDonePages(new Set());
        return;
      }
      try {
        const res = await apiPostJson<OutputScanResponse>('/api/system/scan-output', {
          outputDir: dir,
          notFoundDir: notFoundDir || null,
        });
        const nfPageSet = new Set(res.notFoundPages ?? []);
        setDonePages(new Set((res.coveredPages ?? []).filter((p) => !nfPageSet.has(p))));
        if (notFoundDir) {
          setExportedNotFoundRecords((prev) => mergeNotFoundRecords(prev, res.notFoundFiles ?? [], notFoundDir));
          const nfMax = res.notFoundMaxSectionNo ?? 0;
          if (nfMax >= 1) {
            setNotFoundSectionNo((n) => {
              const next = Math.max(n, nfMax + 1);
              if (next !== n) saveAppSettings({ notFoundSectionNo: next });
              return next;
            });
          }
        }

        const pageCount = opts?.pageCount ?? pdf?.pageCount ?? 0;
        const allowSuggest =
          pageCount > 0 &&
          (opts?.forceSuggest ||
            (!!pdf &&
              !editMode &&
              history.length === 0 &&
              splitMode === 'range' &&
              endPage == null &&
              firstPage == null &&
              secondPage == null));
        if (allowSuggest) {
          const nextStart = computeNextStartFromRanges(pageCount, res.ranges);
          if (nextStart >= 1 && nextStart <= pageCount) {
            setStartPage(nextStart);
            setSelectedPage(nextStart);
            setFormKey((k) => k + 1);
          }
          const nextSection = (res.maxSectionNo ?? 0) + 1;
          if (nextSection >= 1) {
            setSectionNo(nextSection);
            setFormKey((k) => k + 1);
          }
        }
      } catch (e) {
        setDonePages(new Set());
        pushToast('error', `Çıktı klasörü taranamadı: ${(e as Error).message}`);
      }
    },
    [
      computeNextStartFromRanges,
      endPage,
      editMode,
      firstPage,
      secondPage,
      history.length,
      notFoundOutputDir,
      pdf,
      pushToast,
      sectionNo,
      splitMode,
      startPage,
    ],
  );

  const scheduleScanOutput = useCallback(
    (dir: string, nfDir?: string) => {
      if (scanDebounceTimer.current) clearTimeout(scanDebounceTimer.current);
      scanDebounceTimer.current = setTimeout(() => {
        scanDebounceTimer.current = null;
        void scanOutputAndMaybeSuggest(dir, nfDir);
      }, 400);
    },
    [scanOutputAndMaybeSuggest],
  );

  useEffect(
    () => () => {
      if (scanDebounceTimer.current) clearTimeout(scanDebounceTimer.current);
    },
    [],
  );

  // Çıktı klasörünü arka planda tara; önceki tarama bitmeden yenisini başlatma.
  useEffect(() => {
    if (!outputDir.trim()) return;
    const tick = () => void scanOutputQuiet(outputDir, notFoundOutputDir);
    const id = setInterval(tick, 10000);
    const onVis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [outputDir, notFoundOutputDir, scanOutputQuiet]);

  useEffect(() => {
    const saved = loadAppSettings();
    if (saved.targetOutputDir.trim()) scheduleScanOutput(saved.targetOutputDir);
  }, [scheduleScanOutput]);

  const header = useMemo(() => (pdf ? `${pdf.filename} • ${pdf.pageCount} sayfa` : 'PDF seçin'), [pdf]);

  const openPdfFromUpload = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        const res = await apiPostFile<PdfOpenResponse>('/api/pdf/open', file);
        setPdf(res);
        setSelectedPage(1);
        setSectionNo(1);
        setStartPage(1);
        setEndPage(null);
        setFirstPage(null);
        setSecondPage(null);
        setExcludedPages(null);
        const saved = loadAppSettings();
        setOutputDir(saved.targetOutputDir);
        setNotFoundOutputDir(saved.notFoundOutputDir);
        setSkippedOutputDir(saved.notFoundOutputDir);
        setRecentFolders(saved.recentFolders);
        setNotFoundSectionNo(saved.notFoundSectionNo);
        setDonePages(new Set());
        setEditMode(false);
        setFormKey((k) => k + 1);
        setHistory([]);
        setSplitMode('range');
        setBasketPages([]);
        setBasketUndoStack([]);
        setUndoPulse(false);
        setSelectedSkippedPages(new Set());
        setSkippedPanelOpen(false);
        setMarkedNotFoundPages(new Set());
        setExportedNotFoundRecords([]);
        setSelectedNotFoundPages(new Set());
        setNotFoundPanelOpen(false);
        setPageAdjustments({});
        pushToast('success', 'PDF açıldı.');
        recordPdfOpen();
        if (saved.targetOutputDir.trim()) {
          await scanOutputAndMaybeSuggest(saved.targetOutputDir, saved.notFoundOutputDir, {
            forceSuggest: true,
            pageCount: res.pageCount,
          });
        }
      } catch (e) {
        pushToast('error', (e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [pushToast, scanOutputAndMaybeSuggest],
  );

  const pickPdfBrowser = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const pickFolder = useCallback(async () => {
    try {
      const res = await apiPostEmpty<PickFolderResponse>('/api/system/pick-folder');
      return res.path;
    } catch (e) {
      pushToast('error', (e as Error).message);
      return null;
    }
  }, [pushToast]);

  const maxDonePage = useMemo(
    () => (donePages.size === 0 ? 0 : Math.max(...donePages)),
    [donePages],
  );

  const skippedPages = useMemo(() => {
    if (!pdf) return new Set<number>();
    const nf = new Set(markedNotFoundPages);
    for (const r of exportedNotFoundRecords) for (const p of r.pages) nf.add(p);
    const out = new Set<number>();
    const bs = new Set(basketPages);
    if (splitMode === 'basket' && basketPages.length > 0) {
      const lo = Math.min(...basketPages);
      const hi = Math.max(...basketPages);
      for (let p = lo; p <= hi; p++) {
        if (!bs.has(p) && !donePages.has(p) && !nf.has(p)) out.add(p);
      }
    }
    const n = pdf.pageCount;
    if (maxDonePage > 0) {
      for (let p = 1; p <= n; p++) {
        if (donePages.has(p) || nf.has(p)) continue;
        if (maxDonePage > p) {
          if (bs.has(p)) continue;
          out.add(p);
        }
      }
    }
    return out;
  }, [pdf, splitMode, basketPages, donePages, maxDonePage, markedNotFoundPages, exportedNotFoundRecords]);

  useEffect(() => {
    setSelectedSkippedPages((prev) => {
      const next = new Set([...prev].filter((p) => skippedPages.has(p)));
      if (next.size === prev.size && [...next].every((p) => prev.has(p))) return prev;
      return next;
    });
  }, [skippedPages]);

  const toggleSkippedSelection = useCallback((p: number) => {
    setSelectedSkippedPages((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }, []);

  const selectSkippedPages = useCallback(
    (pages: number[]) => {
      setSelectedSkippedPages(new Set(pages.filter((p) => skippedPages.has(p))));
    },
    [skippedPages],
  );

  const clearSkippedSelection = useCallback(() => {
    setSelectedSkippedPages(new Set());
  }, []);

  const onExportSkippedToFolder = useCallback(async () => {
    if (!pdf) return;
    const pages = [...selectedSkippedPages].filter((p) => skippedPages.has(p)).sort((a, b) => a - b);
    if (pages.length === 0) {
      pushToast('error', 'En az bir atlanan sayfa seçin.');
      return;
    }
    if (!skippedOutputDir.trim()) {
      pushToast('error', 'Atlanan klasörü boş olamaz.');
      return;
    }
    if (!Number.isFinite(skippedSectionNo) || skippedSectionNo < 1) {
      pushToast('error', 'Atlanan bölüm numarası geçerli olmalı (en az 1).');
      return;
    }
    setBusy(true);
    try {
      const lo = Math.min(...pages);
      const hi = Math.max(...pages);
      const res = await apiPostJson<SplitResponse>(`/api/pdf/${encodeURIComponent(pdf.id)}/split`, {
        splitMode: 'basket',
        startPage: lo,
        endPage: hi,
        sectionNo: skippedSectionNo,
        outputDir: skippedOutputDir,
        firstPage: null,
        secondPage: null,
        rotate: 0,
        allowOverwrite: false,
        basketPages: pages,
        excludedPages: null,
        pageAdjustments: buildAdjustmentsPayload(pages, pageAdjustments),
      });
      pushToast('success', `Atlanan klasöre kaydedildi: ${res.filename}`);
      recordExport('skipped');
      setSkippedSectionNo((n) => Math.max(n, skippedSectionNo) + 1);
      setHistory((h) => [
        {
          ...res,
          at: Date.now(),
          outputDir: skippedOutputDir,
          firstPage: null,
          secondPage: null,
          splitMode: 'basket' as SplitMode,
          basketPages: pages,
          excludedPages: null,
        },
        ...h,
      ]);
      setSelectedSkippedPages(new Set());
    } catch (e) {
      pushToast('error', (e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [
    pdf,
    selectedSkippedPages,
    skippedPages,
    skippedOutputDir,
    skippedSectionNo,
    pageAdjustments,
    pushToast,
  ]);

  const onAddSkippedToBasket = useCallback(() => {
    const pages = [...selectedSkippedPages].filter((p) => skippedPages.has(p)).sort((a, b) => a - b);
    if (pages.length === 0) {
      pushToast('error', 'En az bir atlanan sayfa seçin.');
      return;
    }
    setSplitMode('basket');
    setBasketPagesWithUndo((prev) => {
      const merged = new Set([...prev, ...pages]);
      return [...merged].sort((a, b) => a - b);
    });
    pushToast('success', `${pages.length} sayfa normal sepete eklendi.`);
  }, [selectedSkippedPages, skippedPages, setBasketPagesWithUndo, pushToast]);

  const exportedNotFoundPageSet = useMemo(() => {
    const s = new Set<number>();
    for (const r of exportedNotFoundRecords) for (const p of r.pages) s.add(p);
    return s;
  }, [exportedNotFoundRecords]);

  const notFoundPages = useMemo(() => {
    const s = new Set(markedNotFoundPages);
    for (const r of exportedNotFoundRecords) for (const p of r.pages) s.add(p);
    return s;
  }, [markedNotFoundPages, exportedNotFoundRecords]);

  const handleSettingsSaved = useCallback((settings: AppSettings) => {
    setRecentFolders(settings.recentFolders);
    if (settings.targetOutputDir) {
      setOutputDir(settings.targetOutputDir);
      scheduleScanOutput(settings.targetOutputDir, settings.notFoundOutputDir);
    }
    setNotFoundOutputDir(settings.notFoundOutputDir);
    setSkippedOutputDir(settings.notFoundOutputDir);
    setNotFoundSectionNo(settings.notFoundSectionNo);
    setFormKey((k) => k + 1);
    pushToast('success', 'Ayarlar kaydedildi.');
  }, [pushToast, scheduleScanOutput]);

  const markNotFoundPage = useCallback((page: number) => {
    if (exportedNotFoundPageSet.has(page)) return;
    setMarkedNotFoundPages((prev) => new Set(prev).add(page));
    setSelectedNotFoundPages((prev) => new Set(prev).add(page));
    setNotFoundPanelOpen(true);
    recordMark();
  }, [exportedNotFoundPageSet]);

  const unmarkNotFoundPages = useCallback((pages: number[]) => {
    setMarkedNotFoundPages((prev) => {
      const next = new Set(prev);
      for (const p of pages) next.delete(p);
      return next;
    });
    setSelectedNotFoundPages((prev) => {
      const next = new Set(prev);
      for (const p of pages) next.delete(p);
      return next;
    });
  }, []);

  const forgetNotFoundPages = useCallback((pages: number[]) => {
    if (pages.length === 0) return;
    const drop = new Set(pages);
    setExportedNotFoundRecords((prev) =>
      prev
        .map((r) => ({ ...r, pages: r.pages.filter((p) => !drop.has(p)) }))
        .filter((r) => r.pages.length > 0),
    );
    setMarkedNotFoundPages((prev) => {
      const next = new Set(prev);
      for (const p of drop) next.delete(p);
      return next;
    });
    setSelectedNotFoundPages((prev) => {
      const next = new Set(prev);
      for (const p of drop) next.delete(p);
      return next;
    });
    setDonePages((prev) => {
      const next = new Set(prev);
      for (const p of drop) next.delete(p);
      return next;
    });
  }, []);

  const forgetNotFoundForHistoryItem = useCallback(
    (item: SplitHistoryItem) => {
      const rec = exportedNotFoundRecords.find(
        (r) => r.filename === item.filename && r.outputDir === item.outputDir,
      );
      const pages = rec?.pages.length
        ? rec.pages
        : notFoundOutputDir.trim() && item.outputDir === notFoundOutputDir
          ? (item.basketPages ?? [])
          : [];
      forgetNotFoundPages(pages);
    },
    [exportedNotFoundRecords, notFoundOutputDir, forgetNotFoundPages],
  );

  const toggleNotFoundSelection = useCallback((page: number) => {
    setSelectedNotFoundPages((prev) => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  }, []);

  const onExportNotFound = useCallback(async (opts?: { silentIfEmpty?: boolean }) => {
    if (!pdf) return 'empty' as const;
    const pendingMarked = [...markedNotFoundPages].filter((p) => !exportedNotFoundPageSet.has(p));
    const selectedPending = [...selectedNotFoundPages].filter(
      (p) => markedNotFoundPages.has(p) && !exportedNotFoundPageSet.has(p),
    );
    const pages = (selectedPending.length > 0 ? selectedPending : pendingMarked).sort((a, b) => a - b);
    if (pages.length === 0) {
      if (!opts?.silentIfEmpty) pushToast('error', 'Gönderilecek işaretli sayfa yok.');
      return 'empty' as const;
    }
    if (!notFoundOutputDir.trim()) {
      pushToast('error', 'Bulunamadı klasörü henüz seçilmedi. Ayarlardan konum seçin.');
      setSettingsOpen(true);
      setNotFoundPanelOpen(true);
      return 'blocked' as const;
    }
    setBusy(true);
    try {
      const lo = Math.min(...pages);
      const hi = Math.max(...pages);
      const res = await apiPostJson<SplitResponse>(`/api/pdf/${encodeURIComponent(pdf.id)}/split`, {
        splitMode: 'basket',
        startPage: lo,
        endPage: hi,
        sectionNo: notFoundSectionNo,
        outputDir: notFoundOutputDir,
        firstPage: null,
        secondPage: null,
        rotate: 0,
        allowOverwrite: false,
        basketPages: pages,
        excludedPages: null,
        pageAdjustments: buildAdjustmentsPayload(pages, pageAdjustments),
      });
      const at = Date.now();
      setExportedNotFoundRecords((prev) => [
        { pages, filename: res.filename, outputDir: notFoundOutputDir, at },
        ...prev,
      ]);
      setSelectedNotFoundPages(new Set());
      const nextSection = notFoundSectionNo + 1;
      setNotFoundSectionNo(nextSection);
      saveAppSettings({ notFoundSectionNo: nextSection });
      rememberRecentFolder(notFoundOutputDir);
      setRecentFolders(loadAppSettings().recentFolders);
      pushToast('success', `Bulunamadı klasörüne kaydedildi: ${res.filename}`);
      recordExport('notFound');
      setHistory((h) => [
        {
          ...res,
          at,
          outputDir: notFoundOutputDir,
          firstPage: null,
          secondPage: null,
          splitMode: 'basket' as SplitMode,
          basketPages: pages,
          excludedPages: null,
        },
        ...h,
      ]);
      return 'exported' as const;
    } catch (e) {
      pushToast('error', (e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [
    pdf,
    notFoundOutputDir,
    markedNotFoundPages,
    exportedNotFoundPageSet,
    selectedNotFoundPages,
    notFoundSectionNo,
    pageAdjustments,
    pushToast,
  ]);

  const onRestoreNotFound = useCallback(
    async (pages: number[]) => {
      if (pages.length === 0) return;
      setBusy(true);
      try {
        const batches = exportedNotFoundRecords.filter((r) => r.pages.some((p) => pages.includes(p)));
        const deletedKeys = new Set<string>();
        const restoredPages = new Set<number>();

        for (const batch of batches) {
          const key = `${batch.outputDir}::${batch.filename}`;
          if (!deletedKeys.has(key)) {
            await apiPostJson<{ ok: boolean }>('/api/system/delete-output', {
              outputDir: batch.outputDir,
              filename: batch.filename,
            });
            deletedKeys.add(key);
          }
          for (const p of batch.pages) restoredPages.add(p);
        }

        const restored = [...restoredPages];
        forgetNotFoundPages(restored);
        setHistory((arr) => arr.filter((h) => !deletedKeys.has(`${h.outputDir}::${h.filename}`)));
        pushToast('success', `${restored.length} sayfa bulunamadı listesinden geri alındı.`);
        recordRestore(restored.length);
        if (outputDir.trim()) await scanOutputAndMaybeSuggest(outputDir);
      } catch (e) {
        pushToast('error', (e as Error).message);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [exportedNotFoundRecords, forgetNotFoundPages, outputDir, pushToast, scanOutputAndMaybeSuggest],
  );

  const toggleBasketPage = useCallback(
    (p: number) => {
      setBasketPagesWithUndo((arr) => {
        const i = arr.indexOf(p);
        if (i >= 0) return arr.filter((x) => x !== p);
        return [...arr, p];
      });
    },
    [setBasketPagesWithUndo],
  );

  const toggleSelectedInBasket = useCallback(() => {
    setBasketPagesWithUndo((arr) => {
      const i = arr.indexOf(selectedPage);
      if (i >= 0) return arr.filter((x) => x !== selectedPage);
      return [...arr, selectedPage];
    });
  }, [selectedPage, setBasketPagesWithUndo]);

  const onSplitModeChange = useCallback((m: SplitMode) => {
    setSplitMode(m);
    if (m === 'range') {
      setBasketPages([]);
      setBasketUndoStack([]);
      setUndoPulse(false);
    }
  }, []);

  const canSetFirstPage = useMemo(() => {
    if (!pdf) return false;
    if (splitMode === 'range') {
      if (endPage == null) return false;
      if (selectedPage < startPage || selectedPage > endPage) return false;
      const exported = exportedPagesAfterExclude(startPage, endPage, excludedPages ?? []);
      return exported.includes(selectedPage);
    }
    return basketPages.includes(selectedPage);
  }, [pdf, splitMode, endPage, startPage, selectedPage, excludedPages, basketPages]);

  const canSetSecondPage = canSetFirstPage && selectedPage !== firstPage;

  const toggleNotFoundFromSelected = useCallback(() => {
    if (exportedNotFoundPageSet.has(selectedPage)) return;
    if (markedNotFoundPages.has(selectedPage)) {
      unmarkNotFoundPages([selectedPage]);
      pushToast('success', `Sayfa ${selectedPage} işareti kaldırıldı.`);
    } else {
      markNotFoundPage(selectedPage);
      pushToast('success', `Sayfa ${selectedPage} bulunamadı olarak işaretlendi.`);
    }
  }, [
    exportedNotFoundPageSet,
    selectedPage,
    markedNotFoundPages,
    unmarkNotFoundPages,
    markNotFoundPage,
    pushToast,
  ]);

  const setFirstPageFromSelected = useCallback(() => {
    if (splitFormRef.current?.setFirstPageFromSelected()) {
      pushToast('success', `İlk sayfa: ${selectedPage}`);
      recordFirstPage();
    }
  }, [pushToast, selectedPage]);

  const setSecondPageFromSelected = useCallback(() => {
    if (splitFormRef.current?.setSecondPageFromSelected()) {
      pushToast('success', `İkinci sayfa: ${selectedPage}`);
    }
  }, [pushToast, selectedPage]);

  const rotateCurrentPage = useCallback(() => {
    updateCurrentPageAdjustment({
      rotate: (currentPageAdjustment.rotate + 90) % 360,
    });
  }, [updateCurrentPageAdjustment, currentPageAdjustment.rotate]);

  const deleteLastHistoryItem = useCallback(async () => {
    const item = history[0];
    if (!item || deletingLast) return;
    setDeletingLast(true);
    try {
      await apiPostJson<{ ok: boolean }>('/api/system/delete-output', {
        outputDir: item.outputDir,
        filename: item.filename,
      });
      setHistory((arr) => arr.filter((x) => !(x.at === item.at && x.outputPath === item.outputPath)));
      forgetNotFoundForHistoryItem(item);
      pushToast('success', `Silindi: ${item.filename}`);
      const scanDir =
        item.outputDir === notFoundOutputDir && outputDir.trim() ? outputDir : item.outputDir;
      if (scanDir.trim()) await scanOutputAndMaybeSuggest(scanDir);
    } catch (e) {
      pushToast('error', (e as Error).message);
    } finally {
      setDeletingLast(false);
      setDeleteLastConfirm(false);
      if (deleteLastConfirmTimer.current) {
        clearTimeout(deleteLastConfirmTimer.current);
        deleteLastConfirmTimer.current = null;
      }
    }
  }, [
    history,
    deletingLast,
    pushToast,
    scanOutputAndMaybeSuggest,
    forgetNotFoundForHistoryItem,
    notFoundOutputDir,
    outputDir,
  ]);

  const handleDeleteLastShortcut = useCallback(() => {
    if (!history.length || deletingLast) return;
    if (!deleteLastConfirm) {
      setDeleteLastConfirm(true);
      setHistoryOpen(true);
      pushToast('info', `Son kayıt silinsin mi? ${formatShortcutKey(shortcutBindings.deleteLastOutput, true)} ile onaylayın.`);
      if (deleteLastConfirmTimer.current) clearTimeout(deleteLastConfirmTimer.current);
      deleteLastConfirmTimer.current = setTimeout(() => setDeleteLastConfirm(false), 3000);
      return;
    }
    if (deleteLastConfirmTimer.current) {
      clearTimeout(deleteLastConfirmTimer.current);
      deleteLastConfirmTimer.current = null;
    }
    void deleteLastHistoryItem();
  }, [history.length, deletingLast, deleteLastConfirm, pushToast, shortcutBindings.deleteLastOutput, deleteLastHistoryItem]);

  useEffect(
    () => () => {
      if (deleteLastConfirmTimer.current) clearTimeout(deleteLastConfirmTimer.current);
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && !t?.isContentEditable) {
          e.preventDefault();
          setShortcutsOpen((o) => !o);
          return;
        }
      }
      if (!pdf || shortcutsOpen) return;
      if (matchesShortcut(e, shortcutBindings.setFirstPage)) {
        e.preventDefault();
        setFirstPageFromSelected();
        return;
      }
      if (matchesShortcut(e, shortcutBindings.setSecondPage)) {
        e.preventDefault();
        setSecondPageFromSelected();
        return;
      }
      if (matchesShortcut(e, shortcutBindings.markNotFound)) {
        e.preventDefault();
        toggleNotFoundFromSelected();
        return;
      }
      if (matchesShortcut(e, shortcutBindings.splitSave)) {
        e.preventDefault();
        splitFormRef.current?.submit();
        return;
      }
      if (matchesShortcut(e, shortcutBindings.rotatePage)) {
        e.preventDefault();
        rotateCurrentPage();
        return;
      }
      if (matchesShortcut(e, shortcutBindings.deleteLastOutput)) {
        e.preventDefault();
        handleDeleteLastShortcut();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pdf, shortcutsOpen, shortcutBindings, setFirstPageFromSelected, setSecondPageFromSelected, toggleNotFoundFromSelected, rotateCurrentPage, handleDeleteLastShortcut]);

  const setFirstPageKeyLabel = formatShortcutKey(shortcutBindings.setFirstPage);
  const setSecondPageKeyLabel = formatShortcutKey(shortcutBindings.setSecondPage);
  const markNotFoundKeyLabel = formatShortcutKey(shortcutBindings.markNotFound);
  const rotateKeyLabel = formatShortcutKey(shortcutBindings.rotatePage);

  const onSplit = useCallback(
    async (v: SplitValues) => {
      if (!pdf) return;
      setBusy(true);
      try {
        const exportedPages =
          v.splitMode === 'basket'
            ? [...new Set(v.basketPages ?? [])].sort((a, b) => a - b)
            : exportedPagesAfterExclude(v.startPage, v.endPage, v.excludedPages ?? []);
        const body: Record<string, unknown> = {
          splitMode: v.splitMode,
          startPage: v.startPage,
          endPage: v.endPage,
          sectionNo: v.sectionNo,
          outputDir: v.outputDir,
          firstPage: v.firstPage,
          secondPage: v.secondPage,
          rotate: 0,
          allowOverwrite: v.allowOverwrite,
          pageAdjustments: buildAdjustmentsPayload(exportedPages, pageAdjustments),
        };
        if (v.splitMode === 'basket') {
          body.basketPages = v.basketPages ?? [];
          body.excludedPages = null;
        } else {
          body.excludedPages = v.excludedPages;
        }
        const res = await apiPostJson<SplitResponse>(`/api/pdf/${encodeURIComponent(pdf.id)}/split`, body);
        pushToast('success', `Başarılı: ${res.filename}`);
        recordSplit({ pages: exportedPages.length, mode: v.splitMode, sectionNo: v.sectionNo });
        setSectionNo((n) => Math.max(n, v.sectionNo) + 1);
        setHistory((h) => [
          {
            ...res,
            at: Date.now(),
            outputDir: v.outputDir,
            firstPage: v.firstPage,
            secondPage: v.secondPage,
            splitMode: v.splitMode,
            basketPages: v.splitMode === 'basket' ? (v.basketPages ?? []) : undefined,
            excludedPages: v.splitMode === 'range' ? (v.excludedPages ?? null) : null,
          },
          ...h,
        ]);
        setEditMode(false);
        setExcludedPages(null);
        setOutputDir(v.outputDir);
        if (scanDebounceTimer.current) clearTimeout(scanDebounceTimer.current);
        scanDebounceTimer.current = null;
        void scanOutputAndMaybeSuggest(v.outputDir);
        if (v.splitMode === 'basket' && (v.basketPages?.length ?? 0) > 0) {
          setBasketPages([]);
          setBasketUndoStack([]);
          setUndoPulse(false);
        }
        const next = Math.min(pdf.pageCount, res.endPage + 1);
        if (next <= pdf.pageCount) {
          setStartPage(next);
          setEndPage(null);
          setFirstPage(null);
          setSecondPage(null);
          setFormKey((k) => k + 1);
        }
      } catch (e) {
        pushToast('error', (e as Error).message);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [pdf, pushToast, scanOutputAndMaybeSuggest, pageAdjustments],
  );

  const isPdfFile = useCallback((file: File) => {
    const name = file.name.toLowerCase();
    return file.type === 'application/pdf' || name.endsWith('.pdf');
  }, []);

  const handleDroppedFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0]!;
      if (!isPdfFile(file)) {
        pushToast('error', 'Sadece PDF dosyaları desteklenir.');
        return;
      }
      await openPdfFromUpload(file);
    },
    [isPdfFile, openPdfFromUpload, pushToast],
  );

  const onDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    if (e.dataTransfer.types.includes('Files')) setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  }, []);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current = 0;
      setDragOver(false);
      await handleDroppedFiles(e.dataTransfer.files);
    },
    [handleDroppedFiles],
  );

  return (
    <div
      className="relative flex h-full min-h-screen flex-col lg:h-screen lg:min-h-0 lg:overflow-hidden"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      <KeyboardShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        onChange={setShortcutBindings}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={handleSettingsSaved}
        onPickFolder={pickFolder}
      />
      <DailyStatsModal open={statsOpen} onClose={() => setStatsOpen(false)} />
      {mc ? (
        <Suspense fallback={null}>
          <AchievementsModal open={achievementsOpen} onClose={() => setAchievementsOpen(false)} />
          <ShopModal open={shopOpen} onClose={() => setShopOpen(false)} />
          <AvatarPanel open={avatarOpen} onClose={() => setAvatarOpen(false)} />
          <LanRanksModal open={ranksOpen} onClose={() => setRanksOpen(false)} />
          <GameOverlays onOpenShop={() => setShopOpen(true)} />
          <AchievementPopup />
        </Suspense>
      ) : null}

      {pdf && dragOver ? (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-accent-600/15">
          <div className="rounded-2xl border-2 border-dashed border-accent-600 bg-white/95 px-8 py-6 text-center shadow-lg">
            <div className="text-base font-semibold text-accent-800">Bırak → yeni PDF açılır</div>
            <div className="mt-1 text-xs text-slate-600">Mevcut oturumun yerine geçer</div>
          </div>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (!isPdfFile(f)) {
            pushToast('error', 'Sadece PDF dosyaları desteklenir.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }
          await openPdfFromUpload(f);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />

      {pdf || !mc ? (
        mc ? (
        <header className="relative z-20 flex h-16 shrink-0 items-center gap-3 border-b-4 border-black mc-panel bg-white/95 px-3 sm:px-4">
          <div className="flex shrink-0 items-center gap-2">
            <span className="mc-block flex h-8 w-8 items-center justify-center bg-accent-600 text-sm font-black text-[#12250a] shadow-sm">
              ⛏
            </span>
            <span className="mc-title hidden shrink-0 text-[11px] text-accent-500 xl:block xl:text-[13px]">
              PDF&nbsp;Craft
            </span>
          </div>
          {pdf ? (
            <Suspense fallback={null}>
              <GameHud onOpenShop={() => setShopOpen(true)} onOpenAvatar={() => setAvatarOpen(true)} onOpenRanks={() => setRanksOpen(true)} />
            </Suspense>
          ) : null}
          <div className="hidden min-w-0 flex-1 truncate text-center font-mono text-[11px] text-slate-600 lg:block lg:text-xs">
            {header}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Suspense fallback={null}>
              <XpBar onOpen={() => setAchievementsOpen(true)} />
            </Suspense>
            <Button size="sm" variant="secondary" onClick={() => setStatsOpen(true)} title="Günlük PDF istatistiği">
              İstatistik
            </Button>
            {mc ? (
              <Button size="sm" variant="secondary" onClick={() => setRanksOpen(true)} title="LAN sıralama">
                Sıralama
              </Button>
            ) : null}
            <Button variant="primary" size="sm" disabled={busy} loading={busy && !pdf} onClick={pickPdfBrowser}>
              PDF Seç
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setSettingsOpen(true)} title="Klasör ve tema ayarları">
              Ayarlar
            </Button>
            {pdf ? (
              <Button size="sm" variant="secondary" onClick={() => setShortcutsOpen(true)} title="Klavye kısayolları (?)">
                Kısayollar
              </Button>
            ) : null}
          </div>
        </header>
        ) : (
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-4">
          <div className="shrink-0 text-sm font-bold tracking-tight text-slate-900 sm:text-base">
            PDF Splitter Pro
          </div>
          <div className="min-w-0 flex-1 truncate text-center text-xs text-slate-600 sm:text-sm">
            {header}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setStatsOpen(true)} title="Günlük PDF istatistiği">
              İstatistik
            </Button>
            <Button variant="primary" size="sm" disabled={busy} loading={busy && !pdf} onClick={pickPdfBrowser}>
              PDF Seç
            </Button>
            {pdf ? (
              <Button size="sm" variant="ghost" onClick={() => setShortcutsOpen(true)} title="Klavye kısayolları (?)">
                Kısayollar
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(true)} title="Klasör ve tema ayarları">
              Ayarlar
            </Button>
          </div>
        </header>
        )
      ) : null}

      <main className={mc ? 'relative z-20 min-h-0 flex-1 p-2 sm:p-3 lg:overflow-hidden' : 'min-h-0 flex-1 p-2 sm:p-3 lg:overflow-hidden'}>
        {!pdf ? (
          mc ? (
          <Suspense fallback={null}>
          <TitleScreen
            busy={busy}
            onStart={pickPdfBrowser}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenAchievements={() => setAchievementsOpen(true)}
            onOpenStats={() => setStatsOpen(true)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onOpenShop={() => setShopOpen(true)}
            onOpenAvatar={() => setAvatarOpen(true)}
            onOpenRanks={() => setRanksOpen(true)}
          />
          </Suspense>
          ) : (
          <button
            type="button"
            disabled={busy}
            onClick={pickPdfBrowser}
            className={[
              'flex h-full min-h-[20rem] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-6 py-10 text-center',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600/40',
              'disabled:cursor-wait disabled:opacity-80',
              dragOver
                ? 'border-accent-600 bg-accent-50'
                : 'border-slate-300 hover:border-accent-400 hover:bg-accent-50',
            ].join(' ')}
          >
            {busy ? (
              <>
                <span className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-2 border-accent-600 border-r-transparent" />
                <div className="text-base font-semibold text-slate-900">Açılıyor…</div>
                <div className="mt-1 text-sm text-slate-600">Büyük dosyalarda bu biraz sürebilir</div>
              </>
            ) : (
              <>
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-100 text-2xl font-bold text-accent-700">
                  PDF
                </div>
                <div className="text-base font-semibold text-slate-900">PDF&apos;i buraya sürükleyip bırakın</div>
                <div className="mt-1 text-sm text-slate-600">veya tıklayıp seçin</div>
                <ol className="mt-6 max-w-sm space-y-1.5 text-left text-xs text-slate-600">
                  <li>1. PDF açın</li>
                  <li>2. Sayfa seçin / sepete ekleyin</li>
                  <li>3. Hedef klasöre kesip kaydedin</li>
                </ol>
              </>
            )}
          </button>
          )
        ) : (
          <div className="grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto lg:grid-cols-10 lg:gap-3 lg:overflow-hidden">
            <div className="min-h-0 animate-panel-in lg:col-span-3 lg:h-full">
              <ThumbGrid
                pdfId={pdf.id}
                pageCount={pdf.pageCount}
                selectedPage={selectedPage}
                donePages={donePages}
                splitMode={splitMode}
                basketPages={basketPages}
                skippedPages={skippedPages}
                notFoundPages={notFoundPages}
                onSelect={setSelectedPage}
                onBasketToggle={toggleBasketPage}
              />
            </div>
            <div className="min-h-0 animate-panel-in-delay-1 lg:col-span-4 lg:h-full">
              <PagePreview
                pdfId={pdf.id}
                page={selectedPage}
                pageCount={pdf.pageCount}
                adjustment={currentPageAdjustment}
                onAdjustmentChange={updateCurrentPageAdjustment}
                onPageChange={setSelectedPage}
                onSetFirstPage={setFirstPageFromSelected}
                canSetFirstPage={canSetFirstPage}
                setFirstPageShortcut={setFirstPageKeyLabel}
                onSetSecondPage={setSecondPageFromSelected}
                canSetSecondPage={canSetSecondPage}
                setSecondPageShortcut={setSecondPageKeyLabel}
                rotateShortcut={rotateKeyLabel}
                onMarkNotFound={toggleNotFoundFromSelected}
                isNotFound={notFoundPages.has(selectedPage)}
                markNotFoundShortcut={markNotFoundKeyLabel}
              />
            </div>
            <div className="relative flex min-h-0 animate-panel-in-delay-2 flex-col gap-2 overflow-y-auto lg:col-span-3 lg:h-full">
              {busy ? (
                <div className="busy-progress rounded-t-lg" aria-hidden>
                  <span />
                </div>
              ) : null}
              <SplitForm
                ref={splitFormRef}
                key={formKey}
                pdfSessionId={pdf.id}
                pageCount={pdf.pageCount}
                initialSectionNo={sectionNo}
                initialStartPage={startPage}
                initialEndPage={endPage}
                selectedPage={selectedPage}
                initialFirstPage={firstPage}
                initialSecondPage={secondPage}
                initialOutputDir={outputDir}
                initialExcludedPages={excludedPages}
                editMode={editMode}
                splitMode={splitMode}
                basketPages={basketPages}
                pageAdjustments={pageAdjustments}
                setFirstPageShortcut={shortcutBindings.setFirstPage}
                setSecondPageShortcut={shortcutBindings.setSecondPage}
                splitSaveShortcut={shortcutBindings.splitSave}
                onOpenSettings={() => setSettingsOpen(true)}
                onPickFolder={pickFolder}
                onOutputDirChange={(dir: string) => {
                  setOutputDir(dir);
                  saveAppSettings({ targetOutputDir: dir.trim() });
                  if (dir.trim()) rememberRecentFolder(dir.trim());
                }}
                onSplitModeChange={onSplitModeChange}
                onBasketPagesChange={(pages) => {
                  const emptying = pages.length === 0 && basketPages.length > 0;
                  setBasketPagesWithUndo(pages, { pulse: emptying });
                }}
                onBasketUndo={undoBasket}
                canBasketUndo={basketUndoStack.length > 0}
                basketUndoPulse={undoPulse}
                onToggleSelectedInBasket={toggleSelectedInBasket}
                onSectionNoChange={(n) => setSectionNo(n)}
                onFirstPageChange={setFirstPage}
                onSecondPageChange={setSecondPage}
                onPagesChange={(s, e) => {
                  setStartPage(s);
                  setEndPage(e);
                  setFirstPage((fp) => {
                    if (fp == null) return null;
                    if (e == null || fp < s || fp > e) return null;
                    return fp;
                  });
                  setSecondPage((sp) => {
                    if (sp == null) return null;
                    if (e == null || sp < s || sp > e) return null;
                    return sp;
                  });
                }}
                onSubmit={onSplit}
                onExportPendingNotFound={() => onExportNotFound({ silentIfEmpty: true })}
                busy={busy}
              />

              <NotFoundPanel
                markedPages={markedNotFoundPages}
                exportedRecords={exportedNotFoundRecords}
                selectedPages={selectedNotFoundPages}
                notFoundOutputDir={notFoundOutputDir}
                notFoundSectionNo={notFoundSectionNo}
                busy={busy}
                open={notFoundPanelOpen}
                selectedPage={selectedPage}
                onToggleOpen={() => setNotFoundPanelOpen((o) => !o)}
                onToggleSelect={toggleNotFoundSelection}
                onSelectPages={(pages) => setSelectedNotFoundPages(new Set(pages))}
                onClearSelection={() => setSelectedNotFoundPages(new Set())}
                onSelectPage={setSelectedPage}
                onMarkPage={(page) => {
                  markNotFoundPage(page);
                  pushToast('success', `Sayfa ${page} bulunamadı olarak işaretlendi.`);
                }}
                onUnmarkPages={unmarkNotFoundPages}
                onExport={async () => {
                  await onExportNotFound();
                }}
                onRestore={onRestoreNotFound}
                onOpenSettings={() => setSettingsOpen(true)}
                markNotFoundShortcut={shortcutBindings.markNotFound}
                onRebindShortcut={(key) => {
                  const next = assignShortcut(shortcutBindings, 'markNotFound', key);
                  saveShortcutBindings(next);
                  setShortcutBindings(next);
                }}
              />

              <SkippedPagesPanel
                skippedPages={skippedPages}
                selectedSkipped={selectedSkippedPages}
                skippedOutputDir={skippedOutputDir}
                skippedSectionNo={skippedSectionNo}
                busy={busy}
                open={skippedPanelOpen}
                onToggleOpen={() => setSkippedPanelOpen((o) => !o)}
                onToggleSkipped={toggleSkippedSelection}
                onSelectPages={selectSkippedPages}
                onClearSelection={clearSkippedSelection}
                onSelectPage={setSelectedPage}
                onSkippedOutputDirChange={setSkippedOutputDir}
                onSkippedSectionNoChange={setSkippedSectionNo}
                onPickFolder={pickFolder}
                onExportToSkippedFolder={onExportSkippedToFolder}
                onAddToBasket={onAddSkippedToBasket}
              />

              <Card padding="none">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600/30"
                  onClick={() => setHistoryOpen((o) => !o)}
                >
                  <span>
                    İşlem Geçmişi
                    {history.length > 0 ? (
                      <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                        {history.length}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs font-normal text-slate-500">{historyOpen ? 'Gizle' : 'Göster'}</span>
                </button>
                {historyOpen ? (
                  <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                    <div className="mb-2 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setHistory([])}
                        disabled={history.length === 0}
                      >
                        Temizle
                      </Button>
                    </div>
                    {history.length === 0 ? (
                      <div className="text-xs text-slate-500">Henüz kayıt yok.</div>
                    ) : (
                      <div className="max-h-48 overflow-auto rounded-lg border border-slate-100">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-slate-50 text-slate-600">
                            <tr>
                              <th className="px-2 py-1.5 font-semibold">Bölüm</th>
                              <th className="px-2 py-1.5 font-semibold">Aralık</th>
                              <th className="px-2 py-1.5 font-semibold">Dosya</th>
                              <th className="px-2 py-1.5" />
                            </tr>
                          </thead>
                          <tbody>
                            {history.map((h, idx) => (
                              <tr
                                key={`${h.outputPath}-${h.at}-${idx}`}
                                className={[
                                  'border-t border-slate-100',
                                  idx === 0 && deleteLastConfirm ? 'bg-rose-50' : '',
                                ].join(' ')}
                              >
                                <td className="px-2 py-1.5 font-mono text-[11px]">
                                  {String(h.sectionNo).padStart(3, '0')}
                                </td>
                                <td className="px-2 py-1.5 font-mono text-[11px]">
                                  {h.splitMode === 'basket'
                                    ? `sepet (${h.startPage}–${h.endPage})`
                                    : `${h.startPage}-${h.endPage}`}
                                </td>
                                <td className="max-w-[6rem] truncate px-2 py-1.5 font-mono text-[11px] text-slate-700">
                                  {h.filename}
                                  {idx === 0 && deleteLastConfirm ? (
                                    <span className="ml-1 font-sans text-[10px] font-bold text-rose-700">
                                      Emin misin?
                                    </span>
                                  ) : null}
                                </td>
                                <td className="whitespace-nowrap px-2 py-1.5">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      const next = Math.min(pdf.pageCount, h.endPage + 1);
                                      setStartPage(next);
                                      setEndPage(null);
                                      setSelectedPage(next);
                                      setFirstPage(null);
                                      setSecondPage(null);
                                      setExcludedPages(null);
                                      setEditMode(false);
                                      setFormKey((k) => k + 1);
                                    }}
                                  >
                                    Devam
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="ml-1"
                                    onClick={() => {
                                      setSectionNo(h.sectionNo);
                                      setStartPage(h.startPage);
                                      setEndPage(h.endPage);
                                      setFirstPage(h.firstPage);
                                      setSecondPage(h.secondPage ?? null);
                                      setExcludedPages(h.excludedPages ?? null);
                                      setOutputDir(h.outputDir);
                                      setEditMode(true);
                                      setSelectedPage(h.firstPage ?? h.startPage);
                                      if (h.splitMode === 'basket' && h.basketPages?.length) {
                                        setSplitMode('basket');
                                        setBasketPages([...h.basketPages]);
                                        setBasketUndoStack([]);
                                        setUndoPulse(false);
                                      } else {
                                        setSplitMode('range');
                                        setBasketPages([]);
                                        setBasketUndoStack([]);
                                        setUndoPulse(false);
                                      }
                                      setFormKey((k) => k + 1);
                                    }}
                                  >
                                    Düzenle
                                  </Button>
                                  <DeleteHistoryButton
                                    item={h}
                                    busy={busy}
                                    onDeleted={async () => {
                                      setHistory((arr) =>
                                        arr.filter((x) => !(x.at === h.at && x.outputPath === h.outputPath)),
                                      );
                                      forgetNotFoundForHistoryItem(h);
                                      pushToast('success', `Silindi: ${h.filename}`);
                                      const scanDir =
                                        h.outputDir === notFoundOutputDir && outputDir.trim()
                                          ? outputDir
                                          : h.outputDir;
                                      if (scanDir.trim()) await scanOutputAndMaybeSuggest(scanDir);
                                    }}
                                    onError={(msg) => pushToast('error', msg)}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : null}
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
