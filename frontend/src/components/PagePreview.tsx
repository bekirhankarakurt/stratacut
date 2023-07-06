import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import {
  CONTRAST_MAX,
  CONTRAST_MIN,
  CONTRAST_STEP,
  DEFAULT_PAGE_ADJUSTMENT,
  hasPageAdjustments,
  type PageAdjustment,
} from '../utils/pageAdjustments';
import { fetchImageBlobUrl } from '../api/client';
import { useTheme } from '../utils/useTheme';
import Button from './ui/Button';
import Card from './ui/Card';

const PdfFireLayer = lazy(() => import('./PdfFireLayer'));

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function PagePreview({
  pdfId,
  page,
  pageCount,
  adjustment,
  onAdjustmentChange,
  onPageChange,
  onSetFirstPage,
  canSetFirstPage = false,
  setFirstPageShortcut = 'B',
  onSetSecondPage,
  canSetSecondPage = false,
  setSecondPageShortcut = 'N',
  rotateShortcut = 'R',
  onMarkNotFound,
  isNotFound = false,
  markNotFoundShortcut = 'F',
}: {
  pdfId: string;
  page: number;
  pageCount: number;
  adjustment: PageAdjustment;
  onAdjustmentChange: (patch: Partial<PageAdjustment>) => void;
  onPageChange: (page: number) => void;
  onSetFirstPage?: () => void;
  canSetFirstPage?: boolean;
  setFirstPageShortcut?: string;
  onSetSecondPage?: () => void;
  canSetSecondPage?: boolean;
  setSecondPageShortcut?: string;
  rotateShortcut?: string;
  onMarkNotFound?: () => void;
  isNotFound?: boolean;
  markNotFoundShortcut?: string;
}) {
  const mc = useTheme() === 'minecraft';
  const [zoom, setZoom] = useState(1);
  const [imgStatus, setImgStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);
  const [jumpText, setJumpText] = useState(String(page));
  const [jumpInvalid, setJumpInvalid] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  }>({ active: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });
  const [, setDragTick] = useState(0);

  const src = useMemo(() => {
    const w = mc ? 900 : 720;
    const q = retry > 0 ? `&_r=${retry}` : '';
    const parts = [`width=${w}`, `rotate=${adjustment.rotate}`];
    if (adjustment.mirrorH) parts.push('mirrorH=1');
    if (adjustment.mirrorV) parts.push('mirrorV=1');
    if (Math.abs(adjustment.contrast - 1) > 0.01) {
      parts.push(`contrast=${adjustment.contrast.toFixed(2)}`);
    }
    return `/api/pdf/${encodeURIComponent(pdfId)}/page/${page}/image?${parts.join('&')}${q}`;
  }, [pdfId, page, adjustment, retry, mc]);

  useEffect(() => {
    setImgStatus('loading');
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
        setImgStatus('ok');
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        console.warn('page image load failed', err);
        setImgStatus('error');
      });
    return () => ac.abort();
  }, [src]);

  useEffect(() => {
    return () => {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    };
  }, []);

  useEffect(() => {
    setJumpText(String(page));
    setJumpInvalid(false);
  }, [page]);

  useEffect(() => {
    const onUp = () => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      setDragTick((n) => n + 1);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      // Touchpad pinch = Ctrl+wheel; deltaY can spike — scale down and cap per event.
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= 120;
      const step = clamp(-dy * 0.006, -0.3, 0.3);
      setZoom((z) => clamp(Number((z + step).toFixed(3)), 0.5, 3));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const scale = useMemo(() => clamp(zoom, 0.5, 3), [zoom]);
  const dragging = dragRef.current.active;
  const contrastPct = Math.round(adjustment.contrast * 100);
  const pageHasAdj = hasPageAdjustments(adjustment);

  const commitJump = () => {
    const n = Number(jumpText);
    if (!Number.isInteger(n) || n < 1 || n > pageCount) {
      setJumpInvalid(true);
      return;
    }
    setJumpInvalid(false);
    onPageChange(n);
  };

  const bumpContrast = (delta: number) => {
    const next = clamp(
      Number((adjustment.contrast + delta).toFixed(1)),
      CONTRAST_MIN,
      CONTRAST_MAX,
    );
    onAdjustmentChange({ contrast: next });
  };

  return (
    <Card padding="none" className="flex h-[min(56vh,520px)] min-h-0 flex-col lg:h-full">
      <div className="shrink-0 border-b border-slate-100 px-2.5 py-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span>Önizleme</span>
            {pageHasAdj ? (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                Ayarlı
              </span>
            ) : null}
            <label className="flex items-center gap-1 font-medium text-slate-600">
              Sayfa:
              <input
                type="text"
                inputMode="numeric"
                value={jumpText}
                onChange={(e) => {
                  setJumpText(e.target.value);
                  setJumpInvalid(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitJump();
                  }
                }}
                onBlur={commitJump}
                className={[
                  'w-14 rounded border px-1.5 py-0.5 text-center text-xs font-semibold outline-none',
                  jumpInvalid
                    ? 'border-rose-500 ring-2 ring-rose-500/40'
                    : 'border-slate-200 focus:ring-2 focus:ring-accent-600/20',
                ].join(' ')}
                title={`1–${pageCount}`}
              />
              <span className="text-slate-400">/ {pageCount}</span>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              onClick={() => setZoom((z) => clamp(Number((z - 0.05).toFixed(3)), 0.5, 3))}
            >
              -
            </Button>
            <div className="w-12 text-center text-xs text-slate-600" title="Ctrl + tekerlek veya touchpad pinch ile zoom">
              {Math.round(zoom * 100)}%
            </div>
            <Button
              size="sm"
              onClick={() => setZoom((z) => clamp(Number((z + 0.05).toFixed(3)), 0.5, 3))}
            >
              +
            </Button>
            <Button size="sm" onClick={() => setZoom(1)} title="Sadece yakınlaştırmayı sıfırla">
              Zoom sıfır
            </Button>
            {onSetFirstPage ? (
              <Button
                size="sm"
                variant="accent"
                disabled={!canSetFirstPage}
                onClick={onSetFirstPage}
                title={
                  canSetFirstPage
                    ? `Sayfa ${page} ilk sayfa olarak ayarlanır (${setFirstPageShortcut})`
                    : 'Bu sayfa şu an ilk sayfa olarak seçilemez'
                }
              >
                İlk sayfa ({setFirstPageShortcut})
              </Button>
            ) : null}
            {onSetSecondPage ? (
              <Button
                size="sm"
                variant="accent"
                disabled={!canSetSecondPage}
                onClick={onSetSecondPage}
                title={
                  canSetSecondPage
                    ? `Sayfa ${page} ikinci sayfa olarak ayarlanır (${setSecondPageShortcut})`
                    : 'Bu sayfa şu an ikinci sayfa olarak seçilemez'
                }
              >
                2. sayfa ({setSecondPageShortcut})
              </Button>
            ) : null}
            {onMarkNotFound ? (
              <Button
                size="sm"
                variant={isNotFound ? 'danger' : 'secondary'}
                className={isNotFound ? '!bg-rose-600 hover:!bg-rose-700' : ''}
                onClick={onMarkNotFound}
                title={
                  isNotFound
                    ? `Sayfa ${page} bulunamadı işaretini kaldır (${markNotFoundShortcut})`
                    : `Sayfayı bulunamadı olarak işaretle (${markNotFoundShortcut})`
                }
              >
                {isNotFound ? `Bulunamadı ✓ (${markNotFoundShortcut})` : `Bulunamadı (${markNotFoundShortcut})`}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => onAdjustmentChange({ rotate: (adjustment.rotate + 90) % 360 })}
            title={`Sayfayı 90° döndür (${rotateShortcut})`}
          >
            Döndür {adjustment.rotate > 0 ? `${adjustment.rotate}°` : ''} ({rotateShortcut})
          </Button>
          <Button
            size="sm"
            variant={adjustment.mirrorH ? 'accent' : 'secondary'}
            onClick={() => onAdjustmentChange({ mirrorH: !adjustment.mirrorH })}
            title="Yatay ayna"
          >
            ↔ Yatay
          </Button>
          <Button
            size="sm"
            variant={adjustment.mirrorV ? 'accent' : 'secondary'}
            onClick={() => onAdjustmentChange({ mirrorV: !adjustment.mirrorV })}
            title="Dikey ayna"
          >
            ↕ Dikey
          </Button>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              disabled={adjustment.contrast <= CONTRAST_MIN + 0.01}
              onClick={() => bumpContrast(-CONTRAST_STEP)}
            >
              Kontrast −
            </Button>
            <span className="min-w-[3.5rem] text-center text-xs font-semibold text-slate-600">
              {contrastPct}%
            </span>
            <Button
              size="sm"
              disabled={adjustment.contrast >= CONTRAST_MAX - 0.01}
              onClick={() => bumpContrast(CONTRAST_STEP)}
            >
              Kontrast +
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            disabled={!pageHasAdj}
            onClick={() => onAdjustmentChange({ ...DEFAULT_PAGE_ADJUSTMENT })}
            title="Bu sayfanın döndürme/ayna/kontrast ayarlarını sıfırla"
          >
            Sayfa sıfır
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          Ayarlar sayfaya özel saklanır. Sepete ekleyip kaydettiğinizde çıktıya uygulanır.
        </p>
      </div>

      <div
        ref={viewportRef}
        className={[
          'min-h-0 flex-1 overflow-auto p-2 select-none',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        ].join(' ')}
        onMouseDown={(e) => {
          const el = viewportRef.current;
          if (!el) return;
          dragRef.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            startLeft: el.scrollLeft,
            startTop: el.scrollTop,
          };
          setDragTick((n) => n + 1);
        }}
        onMouseMove={(e) => {
          if (!dragRef.current.active) return;
          const el = viewportRef.current;
          if (!el) return;
          const d = dragRef.current;
          el.scrollLeft = d.startLeft - (e.clientX - d.startX);
          el.scrollTop = d.startTop - (e.clientY - d.startY);
        }}
      >
        <div className="relative flex min-h-[8rem] w-full justify-center">
          {imgStatus === 'loading' ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-40 w-32 animate-pulse rounded-lg bg-slate-200" aria-hidden />
            </div>
          ) : null}
          {imgStatus === 'error' ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-rose-700">
              Sayfa görüntüsü yüklenemedi.
              <Button
                size="sm"
                onClick={() => {
                  setImgStatus('loading');
                  setRetry((n) => n + 1);
                }}
              >
                Yeniden dene
              </Button>
            </div>
          ) : blobUrl ? (
            <div
              className="inline-block animate-fade-in"
              style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
            >
              {(() => {
                const pageImg = (
                  <img
                    src={blobUrl}
                    alt={`Sayfa ${page}`}
                    className={[
                      'block rounded bg-white shadow-sm',
                      imgStatus === 'loading' ? 'opacity-0' : 'opacity-100',
                    ].join(' ')}
                    draggable={false}
                  />
                );
                return mc ? (
                  <Suspense fallback={pageImg}>
                    <PdfFireLayer resetKey={`${pdfId}-${page}`}>{pageImg}</PdfFireLayer>
                  </Suspense>
                ) : pageImg;
              })()}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
