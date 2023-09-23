/** Move the real Windows mouse via the local desktop backend. */

let screenOff = { x: 0, y: 0 };
let lastWarp = 0;

export function trackScreenOffset(e: MouseEvent) {
  screenOff.x = e.screenX - e.clientX;
  screenOff.y = e.screenY - e.clientY;
}

export function warpOsCursor(clientX: number, clientY: number, force = false) {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  const now = performance.now();
  if (!force && now - lastWarp < 40) return;
  lastWarp = now;
  const x = Math.round(clientX + screenOff.x);
  const y = Math.round(clientY + screenOff.y);
  void fetch('/api/system/cursor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y }),
    keepalive: true,
  }).catch(() => {
    /* browser-only / API down — visual lock still applies */
  });
}
