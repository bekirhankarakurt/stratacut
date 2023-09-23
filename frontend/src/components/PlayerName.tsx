import { nameStyleForLevel, rankForLevel } from '../utils/progression';

export default function PlayerName({
  name,
  level,
  showRank = false,
  className = '',
}: {
  name: string;
  level: number;
  showRank?: boolean;
  className?: string;
}) {
  const style = nameStyleForLevel(level);
  const rank = rankForLevel(level);
  return (
    <span className={['inline-flex max-w-full items-baseline gap-1.5', className].join(' ')}>
      <span className={['mc-player-name truncate', style.nameClass].join(' ')} title={`${name} · Sv.${level} · ${rank}`}>
        {name}
      </span>
      {showRank ? <span className={['mc-label truncate text-[8px]', style.titleClass].join(' ')}>{rank}</span> : null}
    </span>
  );
}

export function LevelBadge({ level }: { level: number }) {
  const style = nameStyleForLevel(level);
  return (
    <span
      className={['mc-block flex h-full w-full items-center justify-center font-black', style.badgeClass].join(' ')}
      title={`Seviye ${level}`}
    >
      {level}
    </span>
  );
}
