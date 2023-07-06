import { useEffect, useRef, useState } from 'react';

export default function ServerWatchdog() {
  const [down, setDown] = useState(false);
  const wasDown = useRef(false);

  useEffect(() => {
    let misses = 0;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!res.ok) throw new Error('health');
        misses = 0;
        if (!stopped) {
          if (wasDown.current) {
            wasDown.current = false;
            window.location.reload();
            return;
          }
          setDown(false);
        }
      } catch {
        misses += 1;
        if (misses >= 2 && !stopped) {
          wasDown.current = true;
          setDown(true);
        }
      }
    };
    void tick();
    const id = window.setInterval(tick, 2500);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, []);

  if (!down) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center p-3">
      <div className="pointer-events-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-950 shadow-lg">
        Yerel sunucu yeniden başlıyor. Sayfayı kapatmayın; açılınca otomatik yenilenir.
      </div>
    </div>
  );
}
