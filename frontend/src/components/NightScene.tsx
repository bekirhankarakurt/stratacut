import { useMemo } from 'react';
import { currentPhase } from '../utils/game';
import { useGame } from '../utils/useGame';
import { MC_UI } from '../utils/mcAssets';
import type { GraphicsQuality } from '../utils/appSettings';

export default function NightScene({ quality = 'high' }: { quality?: GraphicsQuality }) {
  useGame();
  const phase = currentPhase();
  const starCount = quality === 'high' ? 46 : 0;
  const stars = useMemo(
    () =>
      Array.from({ length: starCount }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 55,
        size: 1 + Math.random() * 2,
        delay: Math.random() * 3,
      })),
    [starCount],
  );

  const night = phase.isNight;
  const opacity = night ? 1 : 0;

  return (
    <div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 2, opacity, transition: 'opacity 2.5s ease-in-out' }}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(6,10,34,0.82) 0%, rgba(10,16,44,0.7) 45%, rgba(20,26,40,0.5) 100%)' }}
      />
      {stars.map((s, i) => (
        <span
          key={i}
          className={quality === 'high' ? 'absolute animate-mc-blink rounded-full bg-white' : 'absolute rounded-full bg-white'}
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
        />
      ))}
      <img
        src={MC_UI.moon}
        alt=""
        className="absolute"
        style={{ right: '8%', top: '10%', width: quality === 'high' ? 56 : 36, height: quality === 'high' ? 56 : 36, imageRendering: 'pixelated', filter: quality === 'high' ? 'drop-shadow(0 0 14px rgba(220,220,255,0.6))' : 'none' }}
      />
      {quality === 'high' ? <div className="mc-rain" /> : null}
      <div className="absolute" style={{ left: 24, bottom: 24 }}>
        <div
          className="absolute -inset-8 rounded-full"
          style={{ background: quality === 'high' ? 'radial-gradient(circle, rgba(255,150,40,0.4), transparent 70%)' : 'none', animation: quality === 'high' ? 'mc-blink 1.6s ease-in-out infinite' : 'none' }}
        />
        <img
          src={MC_UI.campfire}
          alt=""
          style={{ width: 48, height: 48, imageRendering: 'pixelated', position: 'relative' }}
        />
      </div>
    </div>
  );
}
