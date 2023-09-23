import { currentPhase, holdItem, setPaused, activeHudEffects, activateInvItem } from '../utils/game';
import { useGame } from '../utils/useGame';
import { armorReduction, coinSprite, formatAliveDays, shopItemById } from '../utils/shopItems';
import { MC_MOBS, MC_UI } from '../utils/mcAssets';

function Hearts({ hp, maxHp }: { hp: number; maxHp: number }) {
  const hearts = [];
  const count = Math.max(10, Math.ceil(maxHp / 2));
  const low = hp > 0 && hp <= 6;
  for (let i = 0; i < count; i++) {
    const v = hp - i * 2;
    const src = v >= 2 ? MC_UI.heartFull : v === 1 ? MC_UI.heartHalf : MC_UI.heartEmpty;
    hearts.push(
      <img
        key={i}
        src={src}
        width={18}
        height={18}
        alt=""
        className={low ? 'mc-heart-low' : undefined}
        style={{ imageRendering: 'pixelated', animationDelay: low ? `${(i % 5) * 45}ms` : undefined }}
      />,
    );
  }
  return <div className="flex flex-wrap items-center gap-px">{hearts}</div>;
}

export default function GameHud({
  onOpenShop,
  onOpenAvatar,
  onOpenRanks,
}: {
  onOpenShop: () => void;
  onOpenAvatar?: () => void;
  onOpenRanks?: () => void;
}) {
  const g = useGame();
  const phase = currentPhase();
  const clock = `${String(phase.hour).padStart(2, '0')}:${String(phase.minute).padStart(2, '0')}`;
  const helm = shopItemById(g.equippedHelm);
  const chest = shopItemById(g.equippedChest);
  const redPct = Math.round(armorReduction((helm?.armor ?? 0) + (chest?.armor ?? 0)) * 100);
  const liveDays = g.aliveDays + g.potionBonusDays;
  const effects = activeHudEffects();

  const invSlots = Object.entries(g.inv).filter(([, n]) => n > 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="mc-block flex items-center gap-2 bg-[#20250f] px-2 py-1">
        <Hearts hp={g.hp} maxHp={g.maxHp} />
      </div>
      {helm || chest ? (
        <div
          className="mc-block flex items-center gap-1.5 bg-[#20250f] px-2 py-1"
          title={`${[helm?.name, chest?.name].filter(Boolean).join(' + ')}: canavar hasarı %${redPct} azalır`}
        >
          {helm ? <img src={helm.icon} width={16} height={16} alt="" style={{ imageRendering: 'pixelated' }} /> : null}
          {chest ? <img src={chest.icon} width={16} height={16} alt="" style={{ imageRendering: 'pixelated' }} /> : null}
          <span className="font-mono text-[10px] font-bold text-emerald-300">−%{redPct}</span>
        </div>
      ) : null}

      <div
        className="mc-block flex items-center gap-1 bg-[#20250f] px-2 py-1"
        title={
          g.potionBonusDays > 0
            ? `İksir bonusu +${g.potionBonusDays} gün · gece bitince +1`
            : 'Gece bitip gün doğunca +1 gün'
        }
      >
        <span className="mc-label text-[8px] text-slate-500">Hayatta</span>
        <span className="font-mono text-[10px] font-bold text-amber-300">{formatAliveDays(liveDays)}</span>
      </div>

      {effects.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {effects.map((fx) => (
            <div
              key={fx.key}
              className="mc-block flex items-center gap-1 bg-[#20250f] px-1.5 py-1"
              title={`${fx.name} — ${fx.remainingSec} sn sonra biter`}
            >
              <img src={fx.icon} width={14} height={14} alt="" style={{ imageRendering: 'pixelated' }} />
              <span className="mc-label text-[8px] text-amber-200">{fx.name}</span>
              <span className="font-mono text-[10px] font-bold text-emerald-300">{fx.remainingSec}s</span>
            </div>
          ))}
        </div>
      ) : null}

      {onOpenAvatar ? (
        <button
          type="button"
          onClick={onOpenAvatar}
          className="mc-block mc-press flex h-8 w-8 items-center justify-center bg-[#2b3220]"
          title="Karakter / envanter"
        >
          <img
            src={MC_MOBS.steveFace}
            alt="Steve"
            className="h-7 w-7 object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        </button>
      ) : null}

      <div className="mc-block flex items-center gap-1 bg-[#20250f] px-1 py-1" title="Envanter — tılsımı tıkla kullan">
        {(['water', ...invSlots.map(([id]) => id).filter((id) => id !== 'water')] as string[]).map((id) => {
          const n = g.inv[id] ?? 0;
          const item = shopItemById(id);
          const isBuff = item?.effect === 'buff';
          const on = !isBuff && g.held === id && n > 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (n <= 0) {
                  onOpenShop();
                  return;
                }
                if (isBuff) activateInvItem(id);
                else holdItem(id);
              }}
              className={[
                'relative flex h-8 w-8 items-center justify-center',
                on ? 'mc-block bg-accent-600' : 'mc-block bg-[#2b3220]',
                n <= 0 ? 'opacity-50' : '',
              ].join(' ')}
              title={item ? `${item.name} ×${n}${isBuff ? ' — tıkla kullan' : ''}` : id}
            >
              <img src={item?.icon ?? MC_UI.waterBucket} width={18} height={18} alt="" style={{ imageRendering: 'pixelated' }} />
              <span className="absolute -bottom-0.5 -right-0.5 font-mono text-[9px] font-black text-white" style={{ textShadow: '1px 1px 0 #000' }}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onOpenShop}
        className="mc-block mc-press flex items-center gap-1.5 bg-[#2b3220] px-2 py-1"
        title="Mağaza"
      >
        <img src={coinSprite} width={16} height={16} alt="" style={{ imageRendering: 'pixelated' }} />
        <span className="font-mono text-xs font-bold text-emerald-300">{g.coins}</span>
        <span className="mc-label text-[8px] text-slate-500">Mağaza</span>
      </button>

      <div
        className="mc-block flex items-center gap-1.5 bg-[#20250f] px-2 py-1"
        title={phase.isNight ? 'Gece' : 'Gündüz'}
      >
        <img
          src={phase.isNight ? MC_UI.moon : MC_UI.sun}
          width={16}
          height={16}
          alt=""
          style={{ imageRendering: 'pixelated' }}
        />
        <span className="font-mono text-xs font-bold text-slate-800">{clock}</span>
        <span className="mc-label text-[8px] text-slate-500">{phase.isNight ? 'Gece' : 'Gündüz'}</span>
      </div>

      {onOpenRanks ? (
        <button
          type="button"
          onClick={onOpenRanks}
          className="mc-block mc-press flex h-8 items-center bg-[#2b3220] px-2 text-[10px] font-bold text-slate-800"
          title="LAN sıralama"
        >
          👑
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => setPaused(true)}
        className="mc-block mc-press flex h-7 w-7 items-center justify-center bg-[#2b3220] text-slate-800"
        title="Duraklat"
      >
        ⏸
      </button>
    </div>
  );
}
