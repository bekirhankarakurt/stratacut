import { useEffect, useRef, useState } from 'react';
import { subscribeGameEvents } from '../utils/game';
import { getGraphicsQuality } from '../utils/appSettings';
import { MC_UI } from '../utils/mcAssets';

type Bit = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  src: string;
};
type Arrow = { id: number; x: number; y: number; tx: number; ty: number; life: number; kind: 'arrow' | 'fireball' };
type Burst = { id: number; x: number; y: number; src: string; life: number };

let seq = 0;
const PURPLES = ['#6b21a8', '#7e22ce', '#a855f7', '#d946ef', '#c026d3', '#4c1d95', '#e879f9'];
const FIRE = ['#f97316', '#facc15', '#ef4444', '#fb7185', '#fde68a'];

export default function PortalFx() {
  const bits = useRef<Bit[]>([]);
  const arrows = useRef<Arrow[]>([]);
  const bursts = useRef<Burst[]>([]);
  const [, tick] = useState(0);

  useEffect(() => {
    return subscribeGameEvents((e) => {
      if (e.kind === 'portal' || e.kind === 'firework' || e.kind === 'coin') {
        const x = e.kind === 'portal' ? e.x : window.innerWidth / 2 + (Math.random() - 0.5) * 80;
        const y = e.kind === 'portal' ? e.y : 80 + Math.random() * 40;
        const colors = e.kind === 'portal' ? PURPLES : FIRE;
        const src = e.kind === 'coin' ? MC_UI.glitter : MC_UI.genericParticle;
        const next: Bit[] = [];
        const q = getGraphicsQuality();
        const n =
          e.kind === 'firework'
            ? q === 'low' ? 8 : q === 'medium' ? 18 : 36
            : q === 'low' ? 6 : q === 'medium' ? 12 : 22;
        for (let i = 0; i < n; i++) {
          next.push({
            id: ++seq,
            x: x + (Math.random() - 0.5) * 36,
            y: y + (Math.random() - 0.5) * 52,
            vx: (Math.random() - 0.5) * (e.kind === 'firework' ? 120 : 40),
            vy: -20 - Math.random() * (e.kind === 'firework' ? 140 : 70),
            life: 0.7 + Math.random() * 0.5,
            color: colors[Math.floor(Math.random() * colors.length)]!,
            size: 3 + Math.random() * 5,
            src,
          });
        }
        bits.current = [...bits.current, ...next];
      }
      if (e.kind === 'hitFx') {
        bursts.current.push({
          id: ++seq,
          x: e.x,
          y: e.y,
          src: e.crit ? MC_UI.enchantedHit : MC_UI.criticalHit,
          life: 0.35,
        });
      }
      if (e.kind === 'arrow') {
        arrows.current.push({ id: ++seq, x: e.fromX, y: e.fromY, tx: e.toX, ty: e.toY, life: 0.45, kind: 'arrow' });
      }
      if (e.kind === 'fireball') {
        arrows.current.push({ id: ++seq, x: e.fromX, y: e.fromY, tx: e.toX, ty: e.toY, life: 0.42, kind: 'fireball' });
        const next: Bit[] = [];
        const trail = getGraphicsQuality() === 'low' ? 3 : 10;
        for (let i = 0; i < trail; i++) {
          next.push({
            id: ++seq,
            x: e.fromX,
            y: e.fromY,
            vx: (Math.random() - 0.5) * 50,
            vy: (Math.random() - 0.5) * 50,
            life: 0.4 + Math.random() * 0.3,
            color: FIRE[Math.floor(Math.random() * FIRE.length)]!,
            size: 4 + Math.random() * 5,
            src: MC_UI.fireCharge,
          });
        }
        bits.current = [...bits.current, ...next];
      }
      if (e.kind === 'douse') {
        const next: Bit[] = [];
        const n = getGraphicsQuality() === 'low' ? 6 : 16;
        for (let i = 0; i < n; i++) {
          next.push({
            id: ++seq,
            x: e.x + (Math.random() - 0.5) * 24,
            y: e.y + (Math.random() - 0.5) * 18,
            vx: (Math.random() - 0.5) * 30,
            vy: -40 - Math.random() * 50,
            life: 0.6 + Math.random() * 0.4,
            color: i % 2 ? '#e2e8f0' : '#94a3b8',
            size: 6 + Math.random() * 8,
            src: MC_UI.genericParticle,
          });
        }
        bits.current = [...bits.current, ...next];
      }
    });
  }, []);

  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      let dirty = false;
      if (bits.current.length) {
        bits.current = bits.current
          .map((b) => ({ ...b, x: b.x + b.vx * dt, y: b.y + b.vy * dt, life: b.life - dt, vy: b.vy - 10 * dt }))
          .filter((b) => b.life > 0);
        dirty = true;
      }
      if (arrows.current.length) {
        arrows.current = arrows.current
          .map((a) => ({
            ...a,
            x: a.x + (a.tx - a.x) * 0.18,
            y: a.y + (a.ty - a.y) * 0.18,
            life: a.life - dt,
          }))
          .filter((a) => a.life > 0);
        dirty = true;
      }
      if (bursts.current.length) {
        bursts.current = bursts.current.map((b) => ({ ...b, life: b.life - dt })).filter((b) => b.life > 0);
        dirty = true;
      }
      if (dirty) tick((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[46]" aria-hidden>
      {bits.current.map((b) => (
        <img
          key={b.id}
          src={b.src}
          alt=""
          style={{
            position: 'fixed',
            left: b.x,
            top: b.y,
            width: b.size,
            height: b.size,
            opacity: Math.min(1, b.life * 1.4),
            imageRendering: 'pixelated',
            filter: `drop-shadow(0 0 3px ${b.color})`,
            background: b.color,
          }}
        />
      ))}
      {arrows.current.map((a) => {
        const rot = (Math.atan2(a.ty - a.y, a.tx - a.x) * 180) / Math.PI;
        return (
          <img
            key={a.id}
            src={a.kind === 'fireball' ? MC_UI.fireCharge : MC_UI.arrow}
            alt=""
            style={{
              position: 'fixed',
              left: a.x,
              top: a.y,
              width: a.kind === 'fireball' ? 28 : 24,
              height: a.kind === 'fireball' ? 28 : 24,
              transform: `rotate(${rot}deg)`,
              imageRendering: 'pixelated',
              filter: a.kind === 'fireball' ? 'drop-shadow(0 0 8px #f97316)' : undefined,
            }}
          />
        );
      })}
      {bursts.current.map((b) => (
        <img
          key={b.id}
          src={b.src}
          alt=""
          style={{
            position: 'fixed',
            left: b.x - 24,
            top: b.y - 24,
            width: 48,
            height: 48,
            opacity: Math.min(1, b.life * 3),
            imageRendering: 'pixelated',
          }}
        />
      ))}
    </div>
  );
}
