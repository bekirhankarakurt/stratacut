import { useState } from 'react';
import { ACHIEVEMENTS, levelFromXp, nameStyleForLevel, rankForLevel, splashFor } from '../utils/progression';
import { useProgression } from '../utils/useProgression';
import { usePlayerName } from '../utils/lanBoard';
import GameHud from './GameHud';
import PlayerName, { LevelBadge } from './PlayerName';

export default function TitleScreen({
  busy,
  onStart,
  onOpenSettings,
  onOpenAchievements,
  onOpenStats,
  onOpenShortcuts,
  onOpenShop,
  onOpenAvatar,
  onOpenRanks,
}: {
  busy: boolean;
  onStart: () => void;
  onOpenSettings: () => void;
  onOpenAchievements: () => void;
  onOpenStats: () => void;
  onOpenShortcuts: () => void;
  onOpenShop: () => void;
  onOpenAvatar?: () => void;
  onOpenRanks?: () => void;
}) {
  const p = useProgression();
  const info = levelFromXp(p.xp);
  const rank = rankForLevel(info.level);
  const style = nameStyleForLevel(info.level);
  const name = usePlayerName();
  const [splash, setSplash] = useState(() => splashFor(info.level));

  return (
    <div className="relative flex h-full min-h-[30rem] flex-col items-center justify-between px-4 py-6 text-center">
      <div className="absolute left-3 top-3">
        <GameHud onOpenShop={onOpenShop} onOpenAvatar={onOpenAvatar} onOpenRanks={onOpenRanks} />
      </div>
      {/* Logo + splash */}
      <div className="mt-6 flex flex-col items-center sm:mt-12">
        <div className="relative">
          <h1
            className="mc-logo cursor-pointer select-none text-4xl sm:text-6xl lg:text-7xl"
            onClick={() => setSplash(splashFor(info.level))}
            title="Splash yazısını değiştir"
          >
            PDFCRAFT
          </h1>
          <span className="mc-splash absolute -right-2 -bottom-3 text-[10px] sm:-right-8 sm:text-sm">
            {splash}
          </span>
        </div>
        <div className="mc-label mt-4 text-[10px] text-slate-800 sm:text-xs">PDF EDITION</div>
      </div>

      {/* Menu buttons */}
      <div className="flex w-full max-w-md flex-col gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onStart}
          className="mc-menu-btn mc-block mc-press w-full bg-slate-100 py-4 text-[13px] font-bold text-slate-900 shadow-md hover:bg-slate-200 disabled:opacity-60"
        >
          {busy ? 'Açılıyor…' : 'PDF Aç ve Başla'}
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onOpenAchievements}
            className="mc-menu-btn mc-block mc-press bg-slate-100 py-3 text-[11px] font-bold text-slate-900 hover:bg-slate-200"
          >
            🏆 Başarımlar
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="mc-menu-btn mc-block mc-press bg-slate-100 py-3 text-[11px] font-bold text-slate-900 hover:bg-slate-200"
          >
            ⚙ Ayarlar
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenStats}
          className="mc-menu-btn mc-block mc-press w-full bg-slate-100 py-3 text-[11px] font-bold text-slate-900 hover:bg-slate-200"
        >
          📊 Günlük istatistik
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onOpenShop}
            className="mc-menu-btn mc-block mc-press bg-slate-100 py-3 text-[11px] font-bold text-slate-900 hover:bg-slate-200"
          >
            🛒 Mağaza
          </button>
          <button
            type="button"
            onClick={onOpenShortcuts}
            className="mc-menu-btn mc-block mc-press bg-slate-100 py-3 text-[11px] font-bold text-slate-900 hover:bg-slate-200"
          >
            ⌨ Kısayollar
          </button>
        </div>
        {onOpenRanks ? (
          <button
            type="button"
            onClick={onOpenRanks}
            className="mc-menu-btn mc-block mc-press w-full bg-slate-100 py-3 text-[11px] font-bold text-slate-900 hover:bg-slate-200"
          >
            👑 LAN Sıralama
          </button>
        ) : null}

        {/* Rank + XP */}
        <div className="mc-block mt-1 flex items-center gap-3 bg-white/90 px-3 py-2">
          <span className="mc-block h-9 w-9 shrink-0 text-sm">
            <LevelBadge level={info.level} />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center justify-between gap-2">
              <PlayerName name={name} level={info.level} className="min-w-0 text-[10px]" />
              <span className="font-mono text-[9px] text-slate-500">🏆 {p.unlocked.length}/{ACHIEVEMENTS.length}</span>
            </div>
            <div className={['mc-label mt-0.5 truncate text-[8px]', style.titleClass].join(' ')}>{rank}</div>
            <div className="mt-1 h-2 w-full overflow-hidden bg-[#12140e] mc-block-inset">
              <div
                className="h-full bg-accent-500"
                style={{ width: `${Math.round(info.progress * 100)}%`, boxShadow: '0 0 6px rgba(158,214,111,0.7)' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex w-full items-end justify-between pt-4 font-mono text-[10px] text-slate-700">
        <span>PDFCraft v1.0 — PDF Edition</span>
        <span className="hidden sm:inline">Sürükle-bırak da çalışır · %100 offline</span>
      </div>
    </div>
  );
}
