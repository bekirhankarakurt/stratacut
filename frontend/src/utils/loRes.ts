import { useEffect, useState } from 'react';

const cache = new Map<string, string>();

/** Downsample a sprite for low/medium graphics. `maxEdge <= 0` returns the original. */
export function useLoResSrc(src: string, maxEdge: number): string {
  const [out, setOut] = useState(src);

  useEffect(() => {
    if (!src || maxEdge <= 0) {
      setOut(src);
      return;
    }
    const key = `${src}@${maxEdge}`;
    const hit = cache.get(key);
    if (hit) {
      setOut(hit);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (cancelled) return;
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      if (scale >= 0.92) {
        cache.set(key, src);
        setOut(src);
        return;
      }
      const w = Math.max(8, Math.round(img.width * scale));
      const h = Math.max(8, Math.round(img.height * scale));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) {
        setOut(src);
        return;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, w, h);
      const url = c.toDataURL('image/png');
      cache.set(key, url);
      setOut(url);
    };
    img.onerror = () => {
      if (!cancelled) setOut(src);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, maxEdge]);

  return out;
}

export function gfxSpriteEdge(quality: 'high' | 'medium' | 'low'): number {
  if (quality === 'low') return 64;
  return 0;
}
