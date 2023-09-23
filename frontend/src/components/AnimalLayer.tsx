import { useEffect, useRef, useState } from 'react';
import { currentPhase, isCombatActive } from '../utils/game';
import { MC_MOBS } from '../utils/mcAssets';
import { deadlyModeEnabled } from '../utils/appSettings';
import { useGame } from '../utils/useGame';

type Critter = 'pig' | 'chicken' | 'cow';
type Walker = { id: number; kind: Critter; x: number; dir: 1 | -1; bob: number };

const SPRITE: Record<Critter, { src: string; w: number; h: number; speed: number }> = {
  pig: { src: MC_MOBS.pig, w: 56, h: 34, speed: 28 },
  chicken: { src: MC_MOBS.chicken, w: 40, h: 32, speed: 36 },
  cow: { src: MC_MOBS.cow, w: 72, h: 38, speed: 22 },
};

const KINDS: Critter[] = ['pig', 'chicken', 'cow'];
let seq = 0;

/** Daytime passive animals that wander along the bottom. Night / pause = gone. */
export default function AnimalLayer() {
  useGame();
  const [walkers, setWalkers] = useState<Walker[]>([]);
  const list = useRef(walkers);
  list.current = walkers;

  useEffect(() => {
    let tid = 0;
    const spawn = () => {
      const night = currentPhase().isNight;
      if (!night && !deadlyModeEnabled() && isCombatActive() && list.current.length < 2) {
        const kind = KINDS[Math.floor(Math.random() * KINDS.length)]!;
        const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
        const w = SPRITE[kind].w;
        setWalkers((prev) => [
          ...prev,
          {
            id: ++seq,
            kind,
            x: dir === 1 ? -w - 8 : window.innerWidth + 8,
            dir,
            bob: Math.random() * Math.PI,
          },
        ]);
      }
      if (night || deadlyModeEnabled() || !isCombatActive()) setWalkers((prev) => (prev.length ? [] : prev));
      tid = window.setTimeout(spawn, 14000 + Math.random() * 16000);
    };
    tid = window.setTimeout(spawn, 8000 + Math.random() * 8000);
    return () => window.clearTimeout(tid);
  }, []);

  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      if (isCombatActive() && !currentPhase().isNight && list.current.length) {
        setWalkers((items) =>
          items
            .map((w) => ({
              ...w,
              x: w.x + SPRITE[w.kind].speed * w.dir * dt,
              bob: w.bob + dt * 8,
            }))
            .filter((w) => w.x < window.innerWidth + 80 && w.x > -SPRITE[w.kind].w - 80),
        );
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (currentPhase().isNight || deadlyModeEnabled() || !isCombatActive() || walkers.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[8]" aria-hidden>
      {walkers.map((w) => {
        const cfg = SPRITE[w.kind];
        const hop = Math.abs(Math.sin(w.bob)) * 4;
        return (
          <img
            key={w.id}
            src={cfg.src}
            alt=""
            className="mc-animal"
            style={{
              left: w.x,
              bottom: 6 + hop,
              width: cfg.w,
              height: cfg.h,
              transform: w.dir === -1 ? 'scaleX(-1)' : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
