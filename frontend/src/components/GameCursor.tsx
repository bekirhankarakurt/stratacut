import { useEffect, useRef } from 'react';
import { getGame, getStealLock, getWebLock, notePointer, subscribeGameEvents } from '../utils/game';
import { trackScreenOffset, warpOsCursor } from '../utils/osCursor';
import { cursorSprite, shopItemById } from '../utils/shopItems';
import { MC_UI } from '../utils/mcAssets';
import { useGame } from '../utils/useGame';

/** Hotspot = top-left of the sprite, same as a normal OS pointer. */
const HOT_X = 2;
const HOT_Y = 2;
const SIZE = 32;

export default function GameCursor() {
  const g = useGame();
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const webRef = useRef<HTMLImageElement | null>(null);
  const mouse = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const pos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const swingUntil = useRef(0);
  const chorusUntil = useRef(0);

  useEffect(() => {
    document.body.classList.add('mc-game-cursor');
    return () => document.body.classList.remove('mc-game-cursor');
  }, []);

  useEffect(() => {
    return subscribeGameEvents((e) => {
      if (e.kind === 'chorus') {
        pos.current.x = 40 + Math.random() * (window.innerWidth - 80);
        pos.current.y = 40 + Math.random() * (window.innerHeight - 80);
        chorusUntil.current = performance.now() + 900;
        if (document.visibilityState === 'visible') warpOsCursor(pos.current.x, pos.current.y, true);
        return;
      }
      if (e.kind === 'steal' || e.kind === 'web') {
        pos.current.x = e.x;
        pos.current.y = e.y;
        mouse.current.x = e.x;
        mouse.current.y = e.y;
        if (document.visibilityState === 'visible') warpOsCursor(e.x, e.y, true);
      }
    });
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      trackScreenOffset(e);
      const stolen = getStealLock();
      const webbed = getWebLock();
      if (stolen) {
        warpOsCursor(stolen.x, stolen.y, true);
        return;
      }
      if (webbed) {
        warpOsCursor(webbed.x, webbed.y);
        return;
      }
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      notePointer(e.clientX, e.clientY);
    };
    const onDown = () => {
      swingUntil.current = performance.now() + 140;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      const game = getGame();
      const sprite = spriteRef.current;
      const web = webRef.current;
      const stolen = getStealLock();
      const webbed = !game.paused && !game.dead ? getWebLock() : null;
      const chorusing = now < chorusUntil.current;

      if (stolen) {
        pos.current.x = stolen.x;
        pos.current.y = stolen.y;
      } else if (webbed) {
        pos.current.x = webbed.x;
        pos.current.y = webbed.y;
      } else if (!chorusing) {
        pos.current.x = mouse.current.x;
        pos.current.y = mouse.current.y;
      }

      if (web) {
        web.style.display = webbed ? 'block' : 'none';
        if (webbed) {
          web.style.transform = `translate3d(${pos.current.x - 36}px, ${pos.current.y - 36}px, 0)`;
        }
      }

      if (sprite) {
        const swinging = now < swingUntil.current && !stolen && !webbed;
        const rot = swinging ? 24 : 0;
        sprite.style.transform = `translate3d(${pos.current.x - HOT_X}px, ${pos.current.y - HOT_Y}px, 0) rotate(${rot}deg)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <img
        ref={webRef}
        src={MC_UI.cobweb}
        alt=""
        aria-hidden
        className="mc-game-cursor-sprite"
        style={{ width: 72, height: 72, display: 'none', zIndex: 94, imageRendering: 'pixelated' }}
      />
      <img
        ref={spriteRef}
        src={g.held && (g.inv[g.held] ?? 0) > 0 ? shopItemById(g.held)?.icon ?? cursorSprite(g.equipped) : cursorSprite(g.equipped)}
        alt=""
        aria-hidden
        className="mc-game-cursor-sprite"
        style={{
          width: SIZE,
          height: SIZE,
          transformOrigin: `${HOT_X}px ${HOT_Y}px`,
          imageRendering: 'pixelated',
        }}
      />
    </>
  );
}
