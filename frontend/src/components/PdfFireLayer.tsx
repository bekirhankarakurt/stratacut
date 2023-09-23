import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
  consumeItem,
  damagePlayer,
  emitDouse,
  emitNeedWater,
  getGame,
  isCombatActive,
  subscribeGameEvents,
} from '../utils/game';
import McFire from './McFire';

type Patch = { id: number; nx: number; ny: number };
type Steam = { id: number; nx: number; ny: number };

let seq = 0;

export default function PdfFireLayer({
  children,
  resetKey,
}: {
  children: ReactNode;
  resetKey?: string;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [fires, setFires] = useState<Patch[]>([]);
  const [steam, setSteam] = useState<Steam[]>([]);
  const [hint, setHint] = useState<false | 'shop' | 'hold'>(false);
  const firesRef = useRef(fires);
  firesRef.current = fires;

  useEffect(() => {
    setFires([]);
  }, [resetKey]);

  useEffect(() => {
    return subscribeGameEvents((e) => {
      const box = stageRef.current?.getBoundingClientRect();
      if (e.kind === 'ignite') {
        if (!box || box.width < 8 || box.height < 8) return;
        if (e.x < box.left - 8 || e.x > box.right + 8 || e.y < box.top - 8 || e.y > box.bottom + 8) return;
        if (firesRef.current.length >= 3) return;
        const nx = ((e.x - box.left) / box.width) * 100;
        const ny = ((e.y - box.top) / box.height) * 100;
        setFires((prev) => [...prev, { id: ++seq, nx: Math.max(4, Math.min(96, nx)), ny: Math.max(4, Math.min(96, ny)) }]);
        return;
      }
      if (e.kind === 'needWater') {
        const g = getGame();
        setHint((g.inv.water ?? 0) <= 0 ? 'shop' : 'hold');
        window.setTimeout(() => setHint(false), 1600);
      }
      if (e.kind === 'clearMobs') setFires([]);
    });
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (!isCombatActive() || firesRef.current.length === 0) return;
      damagePlayer(1);
    }, 4000);
    return () => window.clearInterval(t);
  }, []);

  const douse = (p: Patch, ev: PointerEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    const g = getGame();
    if (g.held !== 'water' || (g.inv.water ?? 0) <= 0) {
      emitNeedWater();
      return;
    }
    if (!consumeItem('water')) {
      emitNeedWater();
      return;
    }
    emitDouse(ev.clientX, ev.clientY);
    setFires((prev) => prev.filter((f) => f.id !== p.id));
    const sid = ++seq;
    setSteam((prev) => [...prev, { id: sid, nx: p.nx, ny: p.ny }]);
    window.setTimeout(() => setSteam((prev) => prev.filter((s) => s.id !== sid)), 900);
  };

  return (
    <div ref={stageRef} data-pdf-stage className="relative inline-block">
      {children}
      {fires.map((p) => (
        <button
          key={p.id}
          type="button"
          className="mc-pdf-fire pointer-events-auto absolute z-20 cursor-none border-0 bg-transparent p-0"
          style={{ left: `${p.nx}%`, top: `${p.ny}%` }}
          title="Su kovası ile tıkla"
          onPointerDown={(e) => douse(p, e)}
        >
          <McFire />
        </button>
      ))}
      {steam.map((s) => (
        <div
          key={s.id}
          className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${s.nx}%`, top: `${s.ny}%` }}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="mc-steam-puff" style={{ left: (i - 2) * 8, animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
      ))}
      {hint ? (
        <div className="mc-block pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 bg-[#20250f] px-2 py-1 text-[10px] font-bold text-sky-200">
          {hint === 'shop' ? 'Mağazadan su kovası al (1 zümrüt)' : 'Su kovası kuşan, sonra ateşe tıkla'}
        </div>
      ) : fires.length > 0 ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-orange-200">
          PDF yanıyor! Su kovası ile söndür
        </div>
      ) : null}
    </div>
  );
}
