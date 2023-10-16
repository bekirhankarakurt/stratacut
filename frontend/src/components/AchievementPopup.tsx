import { useEffect, useState } from 'react';
import { rankForLevel, subscribeUnlocks, type UnlockEvent } from '../utils/progression';

type Item =
  | { id: number; kind: 'achievement'; icon: string; name: string }
  | { id: number; kind: 'level'; level: number; rank: string };

let counter = 0;

export default function AchievementPopup() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const onEvt = (e: UnlockEvent) => {
      const id = ++counter;
      const item: Item =
        e.kind === 'achievement'
          ? { id, kind: 'achievement', icon: e.achievement.icon, name: e.achievement.name }
          : { id, kind: 'level', level: e.level, rank: rankForLevel(e.level) };
      setItems((prev) => [...prev, item].slice(-4));
      window.setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }, 4600);
    };
    return subscribeUnlocks(onEvt);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[60] flex flex-col gap-2">
      {items.map((it) =>
        it.kind === 'achievement' ? (
          <div
            key={it.id}
            className="mc-block flex w-72 animate-mc-pop items-center gap-3 bg-[#20250f] px-3 py-2 shadow-md"
          >
            <span className="mc-block flex h-10 w-10 shrink-0 items-center justify-center bg-[#2b3220] text-xl">
              {it.icon}
            </span>
            <div className="min-w-0">
              <div className="mc-label text-[9px] text-accent-500">Başarım kazanıldı!</div>
              <div className="truncate text-sm font-bold text-slate-900">{it.name}</div>
            </div>
          </div>
        ) : (
          <div
            key={it.id}
            className="mc-block flex w-72 animate-mc-pop items-center gap-3 bg-[#3a2c08] px-3 py-2 shadow-md mc-glow"
          >
            <span className="mc-block flex h-10 w-10 shrink-0 items-center justify-center bg-[#5a4410] text-xl">
              ⭐
            </span>
            <div className="min-w-0">
              <div className="mc-label text-[9px] text-amber-400">Seviye atladın!</div>
              <div className="truncate text-sm font-bold text-amber-200">
                Seviye {it.level} · {it.rank}
              </div>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
