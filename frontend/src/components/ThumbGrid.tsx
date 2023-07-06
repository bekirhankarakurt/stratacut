import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { fetchImageBlobUrl } from '../api/client';
import { useTheme } from '../utils/useTheme';

function useGridMetrics(total: number, lite: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [cols, setCols] = useState(lite ? 3 : 4);
  const [range, setRange] = useState({ startRow: 0, endRow: 0 });
  const rowH = 118 + 8;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const updateCols = () => {
      const w = el.clientWidth;
      if (w < 360) setCols(2);
      else if (w < 520) setCols(3);
      else setCols(lite ? 3 : 4);
    };

    const compute = () => {
      const scrollTop = el.scrollTop;
      const height = el.clientHeight;
      const c = cols;
      const row = Math.max(0, Math.floor(scrollTop / rowH));
      const rowsVisible = Math.ceil(height / rowH) + (lite ? 1 : 2);
      const startRow = Math.max(0, row - 1);
      const totalRows = Math.ceil(total / c);
      const endRow = Math.min(totalRows, startRow + rowsVisible);
      setRange({ startRow, endRow });
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        compute();
      });
    };

    updateCols();
    compute();
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(() => {
      updateCols();
      compute();
    });
    ro.observe(el);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [total, cols, rowH, lite]);

  return { ref, range, cols, rowH };
}

const ThumbCell = memo(function ThumbCell({
  p,
  pdfId,
  active,
  done,
  inBasket,
  skipped,
  notFound,
  basketMode,
  onSelect,
  onBasketToggle,
}: {
  p: number;
  pdfId: string;
  active: boolean;
  done: boolean;
  inBasket: boolean;
  skipped: boolean;
  notFound: boolean;
  basketMode: boolean;
  onSelect: (page: number) => void;
  onBasketToggle: (page: number) => void;
}) {
  const src = `/api/pdf/${encodeURIComponent(pdfId)}/page/${p}/thumb?width=160`;
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    setStatus('loading');
    const ac = new AbortController();
    fetchImageBlobUrl(src, ac.signal)
      .then((u) => {
        if (ac.signal.aborted) {
          URL.revokeObjectURL(u);
          return;
        }
        if (blobRef.current) URL.revokeObjectURL(blobRef.current);
        blobRef.current = u;
        setBlobUrl(u);
        setStatus('ok');
      })
      .catch(() => {
        if (!ac.signal.aborted) setStatus('error');
      });
    return () => ac.abort();
  }, [src]);

  useEffect(() => {
    return () => {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (basketMode) onBasketToggle(p);
      onSelect(p);
    },
    [basketMode, onBasketToggle, onSelect, p],
  );

  const keepGridFocus = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const mc = useTheme() === 'minecraft';
  const showSkipped = !done && skipped && !notFound;
  const showNotFound = notFound;
  const idle = !active && !inBasket && !done && !skipped && !notFound;
  // Classic: solid slate-300 frames (old EXE). slate-200 looked washed-out / "transparent".
  const frame = active
    ? mc
      ? 'border-2 border-slate-900 ring-1 ring-slate-900'
      : 'border-2 border-slate-800'
    : inBasket && basketMode
      ? 'border-2 border-accent-500 ring-2 ring-accent-500/70'
      : showNotFound
        ? mc
          ? 'border border-rose-300'
          : 'border-2 border-rose-400'
        : showSkipped
          ? mc
            ? 'border border-violet-300'
            : 'border-2 border-violet-400'
          : mc
            ? 'border border-slate-200'
            : 'border border-slate-300';
  return (
    <button
      type="button"
      tabIndex={-1}
      id={`thumb-page-${p}`}
      data-page={p}
      onMouseDown={keepGridFocus}
      onClick={handleClick}
      className={[
        'group relative flex h-[110px] flex-col items-center justify-center overflow-hidden rounded-lg text-left',
        mc ? 'bg-slate-50 transition-colors duration-150 hover:bg-slate-100' : 'bg-white hover:bg-slate-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600/40 focus-visible:ring-offset-1',
        frame,
      ].join(' ')}
    >
      {status === 'loading' ? (
        <div className="absolute inset-0 animate-pulse bg-slate-200/80" aria-hidden />
      ) : null}
      {status === 'error' ? (
        <div className="px-2 text-center text-[10px] font-medium text-rose-700">Yüklenemedi</div>
      ) : blobUrl ? (
        <img
          src={blobUrl}
          alt={`Sayfa ${p}`}
          className={[
            'h-full w-full object-cover',
            status === 'loading' ? 'opacity-0' : idle ? (mc ? 'opacity-50' : 'opacity-70') : 'opacity-100',
          ].join(' ')}
        />
      ) : null}
      <div className="absolute bottom-1 left-1 z-10 min-w-[1.15rem] rounded-full bg-black/70 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
        {p}
      </div>
      {showNotFound ? (
        <div className="absolute right-1 top-1 z-10 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          Bulunamadı
        </div>
      ) : done ? (
        <div className="absolute right-1 top-1 z-10 rounded bg-accent-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          Yapıldı
        </div>
      ) : showSkipped ? (
        <div className="absolute right-1 top-1 z-10 rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          Atlanan
        </div>
      ) : null}
      {basketMode && !done ? (
        inBasket ? (
          <div className="absolute left-1 top-1 z-10 rounded bg-accent-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            ✓ Sepet
          </div>
        ) : (
          <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <span className="rounded-full bg-accent-600 px-2 py-0.5 text-xs font-bold text-white shadow">+ Ekle</span>
          </div>
        )
      ) : null}
    </button>
  );
});

export default function ThumbGrid({
  pdfId,
  pageCount,
  selectedPage,
  donePages,
  splitMode,
  basketPages,
  skippedPages,
  notFoundPages,
  onSelect,
  onBasketToggle,
}: {
  pdfId: string;
  pageCount: number;
  selectedPage: number;
  donePages: Set<number>;
  splitMode: 'range' | 'basket';
  basketPages: number[];
  skippedPages: Set<number>;
  notFoundPages: Set<number>;
  onSelect: (page: number) => void;
  onBasketToggle: (page: number) => void;
}) {
  const mc = useTheme() === 'minecraft';
  const basketSet = useMemo(() => new Set(basketPages), [basketPages]);
  const basketMode = splitMode === 'basket';
  const { ref, range, cols, rowH } = useGridMetrics(pageCount, !mc);
  const totalRows = Math.ceil(pageCount / cols);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const visiblePages = useMemo(() => {
    const start = range.startRow * cols + 1;
    const end = Math.min(pageCount, range.endRow * cols);
    const out: number[] = [];
    for (let p = start; p <= end; p++) out.push(p);
    return out;
  }, [range.startRow, range.endRow, pageCount, cols]);

  const gridClass =
    cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-4';

  const focusGrid = useCallback(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  const selectPage = useCallback(
    (page: number) => {
      onSelect(page);
      focusGrid();
    },
    [onSelect, focusGrid],
  );

  useEffect(() => {
    const scroller = ref.current;
    if (!scroller) return;
    const row = Math.floor((selectedPage - 1) / cols);
    const top = row * rowH;
    const bottom = top + rowH;
    const viewTop = scroller.scrollTop;
    const viewBottom = viewTop + scroller.clientHeight;
    if (top < viewTop) scroller.scrollTop = top;
    else if (bottom > viewBottom) scroller.scrollTop = bottom - scroller.clientHeight;
  }, [selectedPage, cols, rowH, ref]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      let next = selectedPage;
      if (e.key === 'ArrowRight') next = Math.min(pageCount, selectedPage + 1);
      else if (e.key === 'ArrowLeft') next = Math.max(1, selectedPage - 1);
      else if (e.key === 'ArrowDown') next = Math.min(pageCount, selectedPage + cols);
      else if (e.key === 'ArrowUp') next = Math.max(1, selectedPage - cols);
      else if (e.key === 'Home') next = 1;
      else if (e.key === 'End') next = pageCount;
      else if (e.key === 'PageDown') next = Math.min(pageCount, selectedPage + cols * 4);
      else if (e.key === 'PageUp') next = Math.max(1, selectedPage - cols * 4);
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (basketMode) onBasketToggle(selectedPage);
        return;
      } else return;
      e.preventDefault();
      e.stopPropagation();
      if (next !== selectedPage) onSelect(next);
    },
    [selectedPage, pageCount, cols, basketMode, onBasketToggle, onSelect],
  );

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      role="grid"
      aria-label="Sayfa küçük resimleri"
      aria-activedescendant={selectedPage ? `thumb-page-${selectedPage}` : undefined}
      onKeyDown={onKeyDown}
      className={[
        'flex h-[min(56vh,520px)] min-h-0 flex-col rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent-600/30 lg:h-full lg:min-h-0',
        mc ? 'mc-panel border border-slate-200 bg-white shadow-sm' : 'border border-slate-300 bg-white shadow-sm',
      ].join(' ')}
    >
      <div className={['shrink-0 px-2.5 py-1.5 text-xs text-slate-600', mc ? 'border-b border-slate-100' : 'border-b border-slate-200'].join(' ')}>
        {basketMode ? (
          <span className="font-medium text-accent-700">
            Sepet — tıkla / Enter: ekle-çıkar · ok tuşları: gezin
          </span>
        ) : (
          <span>Thumbnail&apos;lar · ok tuşları ile gezinin</span>
        )}
      </div>
      <div ref={ref} className="flex-1 overflow-auto p-2">
        <div style={{ height: totalRows * rowH }}>
          <div style={{ transform: `translateY(${range.startRow * rowH}px)` }}>
            <div className={`grid gap-2 ${gridClass}`}>
              {visiblePages.map((p) => (
                <ThumbCell
                  key={p}
                  p={p}
                  pdfId={pdfId}
                  active={p === selectedPage}
                  done={donePages.has(p)}
                  inBasket={basketSet.has(p)}
                  skipped={skippedPages.has(p)}
                  notFound={notFoundPages.has(p)}
                  basketMode={basketMode}
                  onSelect={selectPage}
                  onBasketToggle={onBasketToggle}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
