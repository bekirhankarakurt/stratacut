import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { recordTnt } from '../utils/progression';
import { isCombatActive, tntRespawnMs } from '../utils/game';
import { MC_UI } from '../utils/mcAssets';

type Boom = { id: number; x: number; y: number };

let seq = 0;

function randPos(size: number) {
  return {
    x: 72 + Math.random() * Math.max(40, window.innerWidth - size - 120),
    y: 80 + Math.random() * Math.max(40, window.innerHeight - size - 140),
  };
}

/** Pixel TNT for low graphics — same click-to-boom loop, no WebGL. */
export default function TntBlock2D() {
  const SIZE = 48;
  const [pos, setPos] = useState(() => randPos(SIZE));
  const [hidden, setHidden] = useState(true);
  const [booms, setBooms] = useState<Boom[]>([]);
  const exploding = useRef(false);

  useEffect(() => {
    const first = window.setTimeout(() => {
      setPos(randPos(SIZE));
      setHidden(false);
    }, tntRespawnMs());
    return () => window.clearTimeout(first);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (exploding.current) return;
      setPos(randPos(SIZE));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const explode = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (exploding.current || hidden || !isCombatActive()) return;
    exploding.current = true;
    recordTnt();
    setHidden(true);
    const id = ++seq;
    setBooms((prev) => [...prev, { id, x: pos.x + SIZE / 2, y: pos.y + SIZE / 2 }]);
    window.setTimeout(() => setBooms((prev) => prev.filter((b) => b.id !== id)), 700);
    window.setTimeout(() => {
      setPos(randPos(SIZE));
      setHidden(false);
      exploding.current = false;
    }, tntRespawnMs());
  };

  return (
    <div className="mc-tnt-layer" aria-hidden>
      {hidden ? null : (
        <button
          type="button"
          className="mc-tnt-2d"
          title="Tıkla → BUM!"
          onPointerDown={explode}
          style={{
            width: SIZE,
            height: SIZE,
            transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
          }}
        >
          <img src={MC_UI.tnt} alt="" width={SIZE} height={SIZE} draggable={false} />
        </button>
      )}
      {booms.map((b) => (
        <div key={b.id} className="mc-tnt-boom" style={{ left: b.x, top: b.y }}>
          <img src={MC_UI.explosion} alt="" className="mc-tnt-boom-core" />
          {Array.from({ length: 6 }, (_, i) => (
            <img
              key={i}
              src={MC_UI.fireCharge}
              alt=""
              className="mc-tnt-shard"
              style={{
                ['--dx' as string]: `${(i % 2 ? 1 : -1) * (18 + i * 10)}px`,
                ['--dy' as string]: `${-24 - i * 8}px`,
                animationDelay: `${i * 30}ms`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
