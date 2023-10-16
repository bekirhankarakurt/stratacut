import { useMemo, useState } from 'react';
import {
  ACHIEVEMENTS,
  achievementProgress,
  ctxOf,
  levelFromXp,
  nameStyleForLevel,
  nextPerk,
  perksUpTo,
  rankForLevel,
  type AchCategory,
} from '../utils/progression';
import { useProgression } from '../utils/useProgression';
import { usePlayerName } from '../utils/lanBoard';
import PlayerName, { LevelBadge } from './PlayerName';
import Button from './ui/Button';

const CATS: { id: AchCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'kesim', label: 'Kesim' },
  { id: 'sayfa', label: 'Sayfa' },
  { id: 'dosya', label: 'Dosya' },
  { id: 'oturum', label: 'Oturum' },
  { id: 'sepet', label: 'Sepet' },
  { id: 'aralik', label: 'Aralık' },
  { id: 'donusum', label: 'Dönüşüm' },
  { id: 'bulunamadi', label: 'Bulunamadı' },
  { id: 'atlanan', label: 'Atlanan' },
  { id: 'ilksayfa', label: 'İlk Sayfa' },
  { id: 'geri', label: 'Geri Alma' },
  { id: 'seviye', label: 'Seviye' },
  { id: 'tnt', label: 'TNT' },
  { id: 'savas', label: 'Savaş' },
  { id: 'magaza', label: 'Mağaza' },
  { id: 'hayatta', label: 'Hayatta' },
  { id: 'coin', label: 'Coin' },
  { id: 'meta', label: 'Koleksiyon' },
  { id: 'ozel', label: 'Özel' },
];

export default function AchievementsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const p = useProgression();
  const [cat, setCat] = useState<AchCategory | 'all'>('all');
  const info = levelFromXp(p.xp);
  const rank = rankForLevel(info.level);
  const style = nameStyleForLevel(info.level);
  const player = usePlayerName();
  const ctx = useMemo(() => ctxOf(p), [p]);
  const unlockedSet = useMemo(() => new Set(p.unlocked), [p.unlocked]);

  const list = useMemo(
    () => (cat === 'all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter((a) => a.category === cat)),
    [cat],
  );

  const perks = perksUpTo(info.level);
  const upcoming = nextPerk(info.level);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="mc-block flex min-h-0 w-full max-w-4xl animate-modal-in flex-col overflow-hidden bg-white shadow-xl"
        style={{ height: 'min(90vh, 52rem)', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b-4 border-black bg-[#20250f] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="mc-block flex h-12 w-12 items-center justify-center bg-accent-600 text-2xl">🏆</span>
            <div>
              <h2 className="mc-title text-[12px] text-accent-500">Başarımlar</h2>
              <p className="mt-1 font-mono text-[11px] text-slate-500">
                {p.unlocked.length} / {ACHIEVEMENTS.length} açıldı
              </p>
              <PlayerName name={player} level={info.level} showRank className="mt-1 text-[10px]" />
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Kapat
          </Button>
        </div>

        {/* Rank + XP + perks */}
        <div className="grid shrink-0 gap-3 border-b-4 border-black bg-[#181c10] px-4 py-3 sm:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-3">
            <span className="mc-block h-12 w-12 shrink-0 text-lg">
              <LevelBadge level={info.level} />
            </span>
            <div className="min-w-0 flex-1">
              <div className={['mc-label text-[10px]', style.titleClass].join(' ')}>
                {rank}
              </div>
              <div className="mt-1 h-3 w-full overflow-hidden bg-[#12140e] mc-block-inset">
                <div
                  className="h-full bg-accent-500"
                  style={{ width: `${Math.round(info.progress * 100)}%`, boxShadow: '0 0 6px rgba(158,214,111,0.7)' }}
                />
              </div>
              <div className="mt-1 font-mono text-[10px] text-slate-500">
                {info.intoLevel}/{info.neededForNext} XP · Toplam {p.xp} XP
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {perks.map((pk) => (
              <span
                key={pk.name}
                title={`Sv.${pk.level} — ${pk.desc}`}
                className="mc-block flex items-center gap-1 bg-[#2b3220] px-1.5 py-1 text-[10px] text-slate-700"
              >
                <span>{pk.icon}</span>
                <span className="font-semibold">{pk.name}</span>
              </span>
            ))}
            {upcoming ? (
              <span
                title={upcoming.desc}
                className="mc-block flex items-center gap-1 bg-[#171a10] px-1.5 py-1 text-[10px] text-slate-500 opacity-70"
              >
                🔒 Sv.{upcoming.level}: {upcoming.name}
              </span>
            ) : null}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex shrink-0 flex-wrap gap-1 border-b-4 border-black bg-[#12140e] px-3 py-2">
          {CATS.map((c) => {
            const active = cat === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={[
                  'mc-block px-2 py-1 text-[11px] font-semibold transition-colors',
                  active ? 'bg-accent-600 text-[#12250a]' : 'bg-[#2b3220] text-slate-600 hover:bg-slate-100',
                ].join(' ')}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto p-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => {
            const done = unlockedSet.has(a.id);
            const prog = achievementProgress(a, ctx);
            return (
              <div
                key={a.id}
                className={[
                  'mc-block flex items-start gap-2.5 p-2.5 transition-colors',
                  done ? 'bg-[#22300f]' : 'bg-[#191d13]',
                ].join(' ')}
              >
                <span
                  className={[
                    'mc-block flex h-11 w-11 shrink-0 items-center justify-center text-2xl',
                    done ? 'bg-accent-600' : 'bg-[#0f120b] grayscale',
                  ].join(' ')}
                >
                  {done ? a.icon : '🔒'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={['truncate text-sm font-bold', done ? 'text-slate-900' : 'text-slate-500'].join(' ')}>
                    {a.name}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{a.desc}</div>
                  {prog && !done ? (
                    <div className="mt-1.5">
                      <div className="h-1.5 w-full overflow-hidden bg-[#12140e] mc-block-inset">
                        <div
                          className="h-full bg-accent-600"
                          style={{ width: `${Math.round((prog.cur / prog.goal) * 100)}%` }}
                        />
                      </div>
                      <div className="mt-0.5 font-mono text-[9px] text-slate-500">
                        {prog.cur}/{prog.goal}
                      </div>
                    </div>
                  ) : done ? (
                    <div className="mc-label mt-1 text-[8px] text-accent-500">+{a.xp} XP · açıldı ✓</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
