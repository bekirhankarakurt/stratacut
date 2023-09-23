import { useEffect, useState } from 'react';
import { respawn, setPaused, subscribeGameEvents } from '../utils/game';
import { useGame } from '../utils/useGame';

type Flash = { id: number; kind: 'hurt' | 'heal' | 'totem' };
let flashCounter = 0;

export default function GameOverlays({ onOpenShop }: { onOpenShop: () => void }) {
  const g = useGame();
  const [flashes, setFlashes] = useState<Flash[]>([]);

  useEffect(() => {
    return subscribeGameEvents((e) => {
      if (e.kind === 'hurt' || e.kind === 'heal' || e.kind === 'totem') {
        const id = ++flashCounter;
        setFlashes((prev) => [...prev, { id, kind: e.kind }]);
        window.setTimeout(() => setFlashes((prev) => prev.filter((f) => f.id !== id)), 800);
        if (e.kind === 'hurt') {
          const root = document.getElementById('root');
          if (root) {
            root.classList.remove('mc-hurt-shake');
            void root.offsetWidth;
            root.classList.add('mc-hurt-shake');
            window.setTimeout(() => root.classList.remove('mc-hurt-shake'), 480);
          }
        }
      }
    });
  }, []);

  return (
    <>
      {flashes.map((f) =>
        f.kind === 'hurt' ? (
          <div key={f.id} className="mc-hurt-flash" aria-hidden />
        ) : (
          <div key={f.id} className="mc-heal-flash" aria-hidden />
        ),
      )}

      {g.paused && !g.dead ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
          <div className="mc-block flex w-full max-w-sm flex-col items-center gap-3 bg-[#20250f] px-6 py-8 text-center shadow-xl">
            <div className="mc-title text-[16px] text-accent-500">Duraklatıldı</div>
            <p className="font-mono text-[11px] text-slate-500">
              PDF Splitter Pro bekliyor. Canavarlar, TNT ve süre durdu. Mağaza açınca oyun duraklamaya devam eder.
            </p>
            <button
              type="button"
              onClick={() => setPaused(false)}
              className="mc-menu-btn mc-block mc-press mt-2 w-full bg-slate-100 py-3 text-[12px] font-bold text-slate-900 hover:bg-slate-200"
            >
              Devam et
            </button>
            <button
              type="button"
              onClick={() => { onOpenShop(); }}
              className="mc-menu-btn mc-block mc-press w-full bg-slate-100 py-2.5 text-[11px] font-bold text-slate-900 hover:bg-slate-200"
            >
              Mağaza
            </button>
          </div>
        </div>
      ) : null}

      {g.dead ? (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center"
          style={{ background: 'rgba(90,0,0,0.55)', backdropFilter: 'blur(1px)' }}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="mc-title text-[28px] text-red-200" style={{ textShadow: '3px 3px 0 #300' }}>
              Öldün!
            </div>
            <p className="font-mono text-sm text-red-100">Bu seviyedeki XP'nin yarısını kaybettin. Dikkatli ol!</p>
            <button
              type="button"
              onClick={respawn}
              className="mc-menu-btn mc-block mc-press mt-2 bg-slate-100 px-8 py-3 text-[13px] font-bold text-slate-900 hover:bg-slate-200"
            >
              Yeniden Doğ
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
