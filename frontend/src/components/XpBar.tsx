import { ACHIEVEMENTS, levelFromXp, nameStyleForLevel, rankForLevel } from '../utils/progression';
import { useProgression } from '../utils/useProgression';
import { usePlayerName } from '../utils/lanBoard';
import PlayerName, { LevelBadge } from './PlayerName';

export default function XpBar({
  onOpen,
  compact = false,
}: {
  onOpen?: () => void;
  compact?: boolean;
}) {
  const p = useProgression();
  const info = levelFromXp(p.xp);
  const rank = rankForLevel(info.level);
  const style = nameStyleForLevel(info.level);
  const name = usePlayerName();

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${name} · ${rank} · Seviye ${info.level} · ${info.intoLevel}/${info.neededForNext} XP · Başarımlar (${p.unlocked.length}/${ACHIEVEMENTS.length})`}
      className={[
        'mc-block mc-press group flex items-center gap-2 bg-white px-2 py-1 text-left',
        compact ? '' : 'min-w-[190px]',
      ].join(' ')}
    >
      <span className="mc-block h-7 w-7 shrink-0 text-[11px]">
        <LevelBadge level={info.level} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center justify-between gap-2">
          <PlayerName name={name} level={info.level} className="min-w-0 text-[9px]" />
          <span className="shrink-0 font-mono text-[9px] text-slate-500">
            🏆 {p.unlocked.length}/{ACHIEVEMENTS.length}
          </span>
        </span>
        <span className={['mc-label truncate text-[8px]', style.titleClass].join(' ')}>{rank}</span>
        <span className="relative h-2 w-full overflow-hidden bg-[#12140e] mc-block-inset">
          <span
            className="absolute inset-y-0 left-0 bg-accent-500 transition-[width] duration-500"
            style={{ width: `${Math.round(info.progress * 100)}%`, boxShadow: '0 0 6px rgba(158,214,111,0.7)' }}
          />
        </span>
      </span>
    </button>
  );
}
