import Button from './ui/Button';
import { useProgression } from '../utils/useProgression';
import { dailySeries, sumDaily } from '../utils/progression';
import { useTheme } from '../utils/useTheme';

export default function DailyStatsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const mc = useTheme() === 'minecraft';
  const p = useProgression();
  const last14 = dailySeries(p, 14);
  const last7 = last14.slice(-7);
  const todayRow = last14[last14.length - 1];
  const week = sumDaily(last7);
  const maxSplit = Math.max(1, ...last14.map((d) => d.splits));

  if (!open) return null;

  return (
    <div
      className={
        mc
          ? 'fixed inset-0 z-[92] flex items-center justify-center bg-black/70 p-4'
          : 'fixed inset-0 z-[92] flex items-center justify-center bg-slate-900/40 p-4'
      }
      onClick={onClose}
      role="presentation"
    >
      <div
        className={
          mc
            ? 'mc-block flex max-h-[90vh] w-full max-w-2xl animate-modal-in flex-col overflow-hidden bg-[#10140c] shadow-xl'
            : 'flex max-h-[90vh] w-full max-w-2xl animate-modal-in flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl'
        }
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-stats-title"
      >
        <div
          className={
            mc
              ? 'flex shrink-0 items-center justify-between gap-3 border-b-4 border-black bg-[#20250f] px-4 py-3'
              : 'flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4'
          }
        >
          <div>
            <h2 id="daily-stats-title" className={mc ? 'mc-title text-[12px] text-accent-500' : 'text-base font-semibold text-slate-900'}>
              {mc ? 'Günlük istatistik' : 'Günlük istatistik'}
            </h2>
            <p className={mc ? 'mt-1 font-mono text-[11px] text-slate-500' : 'mt-0.5 text-sm text-slate-600'}>
              Her gün kaç PDF ayrıştırdığın
            </p>
          </div>
          <Button size="sm" variant={mc ? 'secondary' : 'ghost'} onClick={onClose}>
            Kapat
          </Button>
        </div>

        <div className={mc ? 'min-h-0 flex-1 space-y-4 overflow-y-auto p-3' : 'min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4'}>
          <div className={mc ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-3 gap-3'}>
            <Summary mc={mc} label="Bugün" splits={todayRow?.splits ?? 0} pages={todayRow?.pages ?? 0} pdfs={todayRow?.pdfs ?? 0} accent />
            <Summary mc={mc} label="7 gün" splits={week.splits} pages={week.pages} pdfs={week.pdfs} />
            <Summary mc={mc} label="Toplam" splits={p.stats.splits} pages={p.stats.pagesSaved} pdfs={p.stats.pdfsOpened} />
          </div>

          <div>
            <div className={mc ? 'mc-label mb-2 text-[9px] text-amber-300' : 'mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'}>
              Son 14 gün · ayrıştırma
            </div>
            <div className={mc ? 'mc-block bg-[#191d13] px-3 pb-2 pt-3' : 'rounded-xl border border-slate-200 bg-slate-50 px-3 pb-2 pt-3'}>
              <div className="flex h-28 items-end gap-1">
                {last14.map((d) => {
                  const h = Math.round((d.splits / maxSplit) * 100);
                  return (
                    <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${d.splits} ayrıştırma · ${d.pages} sayfa`}>
                      <span className={mc ? 'font-mono text-[8px] text-slate-400' : 'text-[10px] font-semibold text-slate-500'}>
                        {d.splits || ''}
                      </span>
                      <div
                        className={mc ? 'w-full bg-accent-500' : 'w-full rounded-t bg-slate-800'}
                        style={{ height: `${Math.max(d.splits > 0 ? 8 : 2, h)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex gap-1">
                {last14.map((d) => (
                  <div key={`${d.key}-l`} className={mc ? 'min-w-0 flex-1 truncate text-center font-mono text-[7px] text-slate-500' : 'min-w-0 flex-1 truncate text-center text-[10px] text-slate-500'}>
                    {d.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className={mc ? 'mc-label mb-2 text-[9px] text-amber-300' : 'mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'}>
              Gün gün
            </div>
            <div className={mc ? 'overflow-hidden' : 'overflow-hidden rounded-xl border border-slate-200'}>
              <table className="w-full text-left">
                <thead>
                  <tr className={mc ? 'bg-[#20250f] font-mono text-[10px] text-amber-200' : 'bg-slate-50 text-xs font-semibold text-slate-500'}>
                    <th className="px-3 py-2 font-semibold">Gün</th>
                    <th className="px-3 py-2 font-semibold">Ayrıştırma</th>
                    <th className="px-3 py-2 font-semibold">Sayfa</th>
                    <th className="px-3 py-2 font-semibold">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {[...last14].reverse().map((d) => (
                    <tr key={d.key} className={mc ? 'border-t-2 border-black/40 font-mono text-[11px] text-slate-200' : 'border-t border-slate-100 text-sm text-slate-800'}>
                      <td className="px-3 py-1.5">{d.label}</td>
                      <td className="px-3 py-1.5 font-semibold">{d.splits}</td>
                      <td className="px-3 py-1.5">{d.pages}</td>
                      <td className="px-3 py-1.5">{d.pdfs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={mc ? 'mt-2 font-mono text-[10px] text-slate-500' : 'mt-2 text-xs text-slate-500'}>
              Kayıt bu sürümden itibaren tutulur. Eski toplamlar üstte durur.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Summary({
  mc,
  label,
  splits,
  pages,
  pdfs,
  accent,
}: {
  mc: boolean;
  label: string;
  splits: number;
  pages: number;
  pdfs: number;
  accent?: boolean;
}) {
  return (
    <div
      className={
        mc
          ? 'mc-block mc-stat-tile px-2.5 py-2'
          : accent
            ? 'rounded-xl border border-slate-200 bg-slate-900 px-3 py-3 text-white'
            : 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-3'
      }
    >
      <div className={mc ? 'mc-label text-[8px] tracking-wide text-amber-200/85' : accent ? 'text-[11px] font-semibold text-slate-300' : 'text-[11px] font-semibold text-slate-500'}>
        {label}
      </div>
      <div className={mc ? 'mc-stat-val mt-1.5 font-mono leading-none' : 'mt-1 text-2xl font-bold tabular-nums tracking-tight'}>
        {splits}
      </div>
      <div className={mc ? 'mt-1 font-mono text-[9px] text-slate-400' : accent ? 'mt-1 text-[11px] text-slate-400' : 'mt-1 text-[11px] text-slate-500'}>
        {pages} sayfa · {pdfs} PDF
      </div>
    </div>
  );
}
