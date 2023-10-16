import { useMemo, useState, useSyncExternalStore } from 'react';
import { equip, unequipArmor, activateInvItem } from '../utils/game';
import { useGame } from '../utils/useGame';
import {
  armorReduction,
  formatAliveDays,
  isHelmetId,
  itemGives,
  SHOP_ALL,
  shopItemById,
  type ShopItem,
} from '../utils/shopItems';
import { MC_MOBS } from '../utils/mcAssets';
import { useProgression } from '../utils/useProgression';
import { levelFromXp } from '../utils/progression';
import { usePlayerName } from '../utils/lanBoard';
import { getPlayerProfile, subscribePlayerProfile } from '../utils/playerProfile';
import PlayerName, { LevelBadge } from './PlayerName';
import ProfileEditor from './ProfileEditor';
import TrophyGrid from './TrophyGrid';
import Button from './ui/Button';

type ArmorTint = { main: string; dark: string; light: string; visor: string };

function armorTint(id: string): ArmorTint {
  if (id.includes('leather')) return { main: '#b85a32', dark: '#7a3518', light: '#e08a58', visor: '#3a1c0c' };
  if (id.includes('gold')) return { main: '#f0c430', dark: '#b88614', light: '#ffe56a', visor: '#6a4a08' };
  if (id.includes('chain')) return { main: '#8d8d9c', dark: '#4e4e5c', light: '#c8c8d4', visor: '#2a2a32' };
  if (id.includes('iron')) return { main: '#c8c8c8', dark: '#7a7a7a', light: '#f0f0f0', visor: '#3a3a3a' };
  if (id.includes('turtle')) return { main: '#2f9a4a', dark: '#176030', light: '#5ad06e', visor: '#0c3018' };
  if (id.includes('netherite')) return { main: '#3a3333', dark: '#161010', light: '#6a5a52', visor: '#0a0606' };
  return { main: '#41d6c8', dark: '#1a8a8a', light: '#b8fff4', visor: '#0c3c44' };
}

function WornHelm({ item }: { item: ShopItem }) {
  const c = armorTint(item.id);
  const turtle = item.id.includes('turtle');
  return (
    <div
      className="mc-doll-piece"
      title={item.name}
      style={{ left: '25%', top: turtle ? '-2%' : '0%', width: '50%', height: turtle ? '30%' : '26%', zIndex: 3 }}
    >
      <div className="absolute inset-x-0 top-0 h-[42%]" style={{ background: c.light, boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.35)' }} />
      <div className="absolute left-0 top-[34%] h-[66%] w-[22%]" style={{ background: c.main, boxShadow: `inset 2px 0 0 ${c.light}` }} />
      <div className="absolute right-0 top-[34%] h-[66%] w-[22%]" style={{ background: c.main, boxShadow: `inset -2px 0 0 ${c.dark}` }} />
      <div className="absolute left-[18%] right-[18%] top-[36%] h-[22%]" style={{ background: c.dark }} />
      <div className="absolute left-[22%] right-[22%] top-[52%] h-[28%]" style={{ background: c.visor }} />
      {turtle ? (
        <div className="absolute left-[30%] right-[30%] top-[-18%] h-[28%]" style={{ background: c.dark, borderRadius: 1 }} />
      ) : null}
    </div>
  );
}

function WornChest({ item }: { item: ShopItem }) {
  const c = armorTint(item.id);
  return (
    <>
      <div
        className="mc-doll-piece"
        title={item.name}
        style={{
          left: '25%',
          top: '25%',
          width: '50%',
          height: '37.5%',
          zIndex: 2,
          background: `linear-gradient(180deg, ${c.light} 0 14%, ${c.main} 14% 78%, ${c.dark} 78% 100%)`,
          boxShadow: `inset 0 0 0 2px ${c.dark}`,
        }}
      >
        <div className="absolute left-[42%] right-[42%] top-[18%] bottom-[22%]" style={{ background: c.light, opacity: 0.55 }} />
      </div>
      <div
        className="mc-doll-piece"
        style={{
          left: 0,
          top: '25%',
          width: '25%',
          height: '16%',
          zIndex: 2,
          background: c.main,
          boxShadow: `inset 0 2px 0 ${c.light}, inset 0 -2px 0 ${c.dark}`,
        }}
      />
      <div
        className="mc-doll-piece"
        style={{
          right: 0,
          top: '25%',
          width: '25%',
          height: '16%',
          zIndex: 2,
          background: c.main,
          boxShadow: `inset 0 2px 0 ${c.light}, inset 0 -2px 0 ${c.dark}`,
        }}
      />
    </>
  );
}

function HeldWeapon({ item }: { item: ShopItem }) {
  const kind = item.cursorKind ?? 'other';
  const elytra = item.id === 'elytra';
  if (elytra) {
    return (
      <img
        src={item.icon}
        alt=""
        className="mc-doll-piece"
        title={item.name}
        style={{
          left: '6%',
          top: '20%',
          width: '88%',
          height: '42%',
          objectFit: 'contain',
          zIndex: 0,
          filter: 'drop-shadow(1px 1px 0 #000)',
        }}
      />
    );
  }
  const bow = kind === 'other' && (item.id === 'bow' || item.id === 'crossbow');
  return (
    <img
      src={item.icon}
      alt=""
      className="mc-doll-piece"
      title={item.name}
      style={{
        left: bow ? '-6%' : '-14%',
        top: bow ? '28%' : '40%',
        width: bow ? '42%' : '52%',
        height: bow ? '32%' : '28%',
        objectFit: 'contain',
        zIndex: 4,
        transform: bow ? 'rotate(-8deg)' : 'rotate(-18deg)',
        transformOrigin: '35% 85%',
        filter: 'drop-shadow(1px 1px 0 #000)',
      }}
    />
  );
}

function Slot({
  label,
  item,
  onClear,
}: {
  label: string;
  item?: ShopItem;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="mc-label text-[8px] text-slate-500">{label}</span>
      <button
        type="button"
        onClick={item ? onClear : undefined}
        className="mc-block flex h-12 w-12 items-center justify-center bg-[#0f120b]"
        title={item ? `${item.name} — çıkar` : 'Boş'}
      >
        {item ? (
          <img src={item.icon} width={32} height={32} alt="" style={{ imageRendering: 'pixelated' }} />
        ) : (
          <span className="text-[10px] text-slate-600">·</span>
        )}
      </button>
    </div>
  );
}

export default function AvatarPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const g = useGame();
  const p = useProgression();
  const player = usePlayerName();
  const lvl = levelFromXp(p.xp).level;
  const prof = useSyncExternalStore(subscribePlayerProfile, getPlayerProfile, getPlayerProfile);
  const [info, setInfo] = useState<ShopItem | null>(null);

  const ownedGear = useMemo(
    () => SHOP_ALL.filter((i) => (i.kind === 'cursor' || i.kind === 'armor') && g.owned.includes(i.id)),
    [g.owned],
  );
  const packed = useMemo(
    () =>
      Object.entries(g.inv)
        .filter(([, n]) => n > 0)
        .map(([id, n]) => ({ item: shopItemById(id), n }))
        .filter((x): x is { item: ShopItem; n: number } => !!x.item),
    [g.inv],
  );
  const helm = shopItemById(g.equippedHelm);
  const chest = shopItemById(g.equippedChest);
  const weapon = g.equipped === 'fist' ? undefined : shopItemById(g.equipped);
  const red = Math.round(armorReduction((helm?.armor ?? 0) + (chest?.armor ?? 0)) * 100);
  const liveDays = g.aliveDays + g.potionBonusDays;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="presentation">
      <div
        className="mc-block flex min-h-0 w-full max-w-3xl animate-modal-in flex-col overflow-hidden bg-white shadow-xl"
        style={{ height: 'min(90vh, 52rem)', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b-4 border-black bg-[#20250f] px-4 py-3">
          <div>
            <h2 className="mc-title text-[12px] text-accent-500">Karakter / Envanter</h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="mc-block h-6 w-6 text-[9px]">
                <LevelBadge level={lvl} />
              </span>
              <PlayerName name={player} level={lvl} showRank className="text-[10px]" />
            </div>
            <p className="mt-1 font-mono text-[11px] text-slate-500">
              Hayatta {formatAliveDays(liveDays)}
              {g.potionBonusDays > 0 ? ` · iksir +${g.potionBonusDays} gün` : ''}
              {g.bestAliveDays > 0 ? ` · rekor ${formatAliveDays(g.bestAliveDays)}` : ''}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>Kapat</Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 sm:flex-row">
          <div className="mc-block flex shrink-0 flex-col items-center gap-3 overflow-y-auto bg-[#191d13] p-3 sm:max-w-[14rem]">
            <div className="mc-doll">
              {weapon?.id === 'elytra' ? <HeldWeapon item={weapon} /> : null}
              <img
                src={MC_MOBS.steveFull}
                alt=""
                className="absolute inset-0 h-full w-full object-fill"
                style={{ imageRendering: 'pixelated', zIndex: 1 }}
              />
              {chest ? <WornChest item={chest} /> : null}
              {helm ? <WornHelm item={helm} /> : null}
              {weapon && weapon.id !== 'elytra' ? <HeldWeapon item={weapon} /> : null}
            </div>
            <div className="flex gap-2">
              <Slot label="Kask" item={helm} onClear={() => unequipArmor('helm')} />
              <Slot label="Göğüs" item={chest} onClear={() => unequipArmor('chest')} />
              <Slot label="Silah" item={weapon} onClear={() => equip('fist')} />
            </div>
            <div className="font-mono text-[10px] text-emerald-300">
              {red > 0 ? `Hasar −%${red}` : 'Zırh yok'}
              {weapon?.damage ? ` · ${weapon.damage} hasar` : ' · yumruk 1'}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-6 sm:pr-1">
            <div className="mc-block mb-3 bg-[#191d13] p-3">
              <div className="mc-label mb-2 text-[8px] text-accent-500">Profilini özelleştir</div>
              {prof.bio ? (
                <div className="mc-profile-quote mb-3 px-5 py-3 pl-8">
                  <div className="mc-label text-[9px] font-black tracking-[0.28em] text-amber-300">PROFİL NOTU</div>
                  <p className="mt-1">{prof.bio}</p>
                </div>
              ) : (
                <p className="mb-3 text-[11px] font-semibold text-amber-200/70">Aşağıya not ekle — sıralamada büyük altın plaka olarak görünür.</p>
              )}
              <ProfileEditor />
            </div>
            <div className="mc-label mb-2 text-[9px] text-accent-500">Kupalar / başarımlar</div>
            <TrophyGrid ids={p.unlocked} empty="Henüz kupa yok. PDF kes, gece hayatta kal." />
            <div className="mc-label mb-2 mt-4 text-[9px] text-accent-500">Sahip oldukların — tıkla giy</div>
            {ownedGear.length === 0 ? (
              <p className="text-[11px] text-slate-500">Henüz zırh veya silah yok. Mağazadan al.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {ownedGear.map((item) => {
                  const on =
                    item.kind === 'armor'
                      ? isHelmetId(item.id)
                        ? g.equippedHelm === item.id
                        : g.equippedChest === item.id
                      : g.equipped === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => (on ? (item.kind === 'armor' ? unequipArmor(isHelmetId(item.id) ? 'helm' : 'chest') : equip('fist')) : equip(item.id))}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setInfo(item);
                      }}
                      className={[
                        'mc-block flex flex-col items-center gap-1 p-2',
                        on ? 'bg-accent-600' : 'bg-[#191d13]',
                      ].join(' ')}
                      title="Tıkla giy · sağ tık bilgi"
                    >
                      <img src={item.icon} width={28} height={28} alt="" style={{ imageRendering: 'pixelated' }} />
                      <span className="text-[9px] font-bold text-slate-900">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mc-label mb-2 mt-4 text-[9px] text-accent-500">Çanta — tılsımı tıkla kullan</div>
            {packed.length === 0 ? (
              <p className="text-[11px] text-slate-500">Tılsım yok. Mağazadan al, burada birikir.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {packed.map(({ item, n }) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => activateInvItem(item.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setInfo(item);
                    }}
                    className="mc-block relative flex flex-col items-center gap-1 bg-[#191d13] p-2"
                    title={item.effect === 'buff' ? 'Tıkla kullan · sağ tık bilgi' : 'Tıkla kuşan · sağ tık bilgi'}
                  >
                    <img src={item.icon} width={28} height={28} alt="" style={{ imageRendering: 'pixelated' }} />
                    <span className="text-[9px] font-bold text-slate-900">{item.name}</span>
                    <span className="absolute -bottom-0.5 -right-0.5 font-mono text-[10px] font-black text-white" style={{ textShadow: '1px 1px 0 #000' }}>
                      ×{n}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {info ? (
              <div className="mc-block mt-3 bg-[#20250f] p-2 text-left">
                <div className="text-[11px] font-bold text-slate-900">{info.name}</div>
                <p className="mt-1 text-[10px] text-slate-500">{info.desc}</p>
                <p className="mt-1 text-[10px] text-emerald-300">Ne sağlar: {itemGives(info)}</p>
                <button type="button" className="mt-2 text-[10px] underline" onClick={() => setInfo(null)}>Kapat</button>
              </div>
            ) : (
              <p className="mt-2 text-[9px] text-slate-500">Sağ tık = açıklama</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
