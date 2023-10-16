import { useMemo, useState } from 'react';
import { buy, currentPhase, equip, holdItem, unequipArmor, activateInvItem } from '../utils/game';
import { useGame } from '../utils/useGame';
import {
  coinSprite,
  cursorSprite,
  isHelmetId,
  itemGives,
  itemPrice,
  nightSaleOn,
  SHOP_ALL,
  shopItemById,
  SHOP_TABS,
  type ShopCategory,
  type ShopItem,
} from '../utils/shopItems';
import { MC_ITEMS } from '../utils/mcAssets';
import Button from './ui/Button';

function Coin({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-300">
      <img src={coinSprite} width={14} height={14} alt="" style={{ imageRendering: 'pixelated' }} />
      {n}
    </span>
  );
}

export default function ShopModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const g = useGame();
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<ShopCategory | 'all'>('all');
  const [infoId, setInfoId] = useState<string | null>(null);
  const night = currentPhase().isNight;

  const list = useMemo(
    () => (tab === 'all' ? SHOP_ALL : SHOP_ALL.filter((i) => i.category === tab)),
    [tab],
  );

  if (!open) return null;

  const tryBuy = (item: ShopItem) => {
    const res = buy(item.id);
    setMsg(res.ok ? (item.kind === 'stack' ? `Envantere eklendi: ${item.name}` : `Satın alındı: ${item.name}`) : `${res.reason}`);
    window.setTimeout(() => setMsg(null), 1600);
  };

  const Card = (item: ShopItem) => {
    const owned = g.owned.includes(item.id);
    const equipped = item.kind === 'armor'
      ? (isHelmetId(item.id) ? g.equippedHelm === item.id : g.equippedChest === item.id)
      : g.equipped === item.id;
    const isEquip = item.kind === 'cursor' || item.kind === 'armor';
    const stackN = g.inv[item.id] ?? 0;
    const isStack = item.kind === 'stack';
    const showInfo = infoId === item.id;
    const price = itemPrice(item, night);
    const dayPrice = itemPrice(item, false);
    const sale = night && price < dayPrice && nightSaleOn(item);
    const buyBtn = (
      <button
        type="button"
        onClick={() => tryBuy(item)}
        disabled={g.coins < price || (isStack && stackN >= 64)}
        className="mc-block mc-press bg-accent-600 px-2 py-1 text-[10px] font-bold text-[#12250a] disabled:opacity-50"
      >
        <span className="inline-flex flex-col items-center gap-0.5">
          {sale ? <span className="text-[8px] font-black text-amber-200">Gece −%10</span> : null}
          <span className="inline-flex items-center gap-1">
            {sale ? <span className="font-mono text-[9px] text-[#12250a]/50 line-through">{dayPrice}</span> : null}
            <Coin n={price} />
          </span>
        </span>
      </button>
    );
    return (
      <div key={item.id} className="mc-block flex flex-col items-center gap-1 bg-[#191d13] p-2 text-center">
        <span className="mc-block flex h-12 w-12 items-center justify-center bg-[#0f120b]">
          <img src={item.icon} width={34} height={34} alt="" style={{ imageRendering: 'pixelated' }} />
        </span>
        <div className="flex items-center gap-1">
          <div className="text-[11px] font-bold text-slate-900">{item.name}</div>
          <button
            type="button"
            className="mc-block h-4 w-4 bg-[#2b3220] text-[9px] font-black text-slate-800"
            title="Ne işe yarar?"
            onClick={() => setInfoId(showInfo ? null : item.id)}
          >
            ?
          </button>
        </div>
        {showInfo ? (
          <div className="w-full text-left">
            <div className="text-[9px] leading-snug text-slate-500">{item.desc}</div>
            <div className="mt-1 text-[9px] leading-snug text-emerald-300">Sana: {itemGives(item)}</div>
          </div>
        ) : (
          <div className="text-[9px] leading-snug text-slate-500">{item.desc}</div>
        )}
        {isStack ? (
          <>
            <div className="font-mono text-[10px] font-bold text-emerald-300">Envanter ×{stackN}</div>
            {buyBtn}
            {stackN > 0 ? (
              <button
                type="button"
                onClick={() => (item.effect === 'buff' ? activateInvItem(item.id) : holdItem(item.id))}
                className="mc-block mc-press bg-[#c6c6c6] px-2 py-1 text-[10px] font-bold text-[#111]"
              >
                {item.effect === 'buff' ? 'Kullan' : g.held === item.id ? 'Elinde ✓' : 'Kuşan'}
              </button>
            ) : null}
          </>
        ) : isEquip && owned ? (
          equipped ? (
            <div className="flex flex-col items-center gap-1">
              <span className="mc-label text-[8px] text-accent-500">Kuşanıldı ✓</span>
              {item.kind === 'armor' ? (
                <button
                  type="button"
                  onClick={() => unequipArmor(isHelmetId(item.id) ? 'helm' : 'chest')}
                  className="mc-block mc-press bg-[#c6c6c6] px-2 py-1 text-[10px] font-bold text-[#111]"
                >
                  Çıkar
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => equip(item.id)}
              className="mc-block mc-press bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-900"
            >
              Kuşan
            </button>
          )
        ) : (
          buyBtn
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="presentation">
      <div
        className="mc-block flex max-h-[90vh] w-full max-w-4xl animate-modal-in flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-3 border-b-4 border-black bg-[#20250f] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="mc-block flex h-10 w-10 items-center justify-center bg-[#0f120b]">
              <img src={coinSprite} width={28} height={28} alt="" style={{ imageRendering: 'pixelated' }} />
            </span>
            <div>
              <h2 className="mc-title text-[12px] text-accent-500">Köy Mağazası</h2>
              <p className="mt-1 text-[11px]">
                Cüzdan: <Coin n={g.coins} />{' '}
                {night ? (
                  <span className="ml-2 text-[10px] font-bold text-amber-300">Gece pazarı −%10</span>
                ) : null}{' '}
                {g.totems > 0 ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-amber-400">
                    <img src={MC_ITEMS.totem} width={14} height={14} alt="" style={{ imageRendering: 'pixelated' }} />x{g.totems}
                  </span>
                ) : null}
                {g.shieldHits > 0 ? <span className="ml-2 text-[10px] text-slate-500">Kalkan {g.shieldHits}</span> : null}
                {g.equippedHelm || g.equippedChest ? (
                  <span className="ml-2 text-[10px] text-slate-500">
                    Zırh: {[shopItemById(g.equippedHelm)?.name, shopItemById(g.equippedChest)?.name].filter(Boolean).join(' + ')}
                  </span>
                ) : null}
                {(g.inv.water ?? 0) > 0 ? (
                  <span className="ml-2 text-[10px] text-sky-300">Su ×{g.inv.water}</span>
                ) : null}
              </p>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>Kapat</Button>
        </div>

        <div className="flex flex-wrap gap-1 border-b-4 border-black bg-[#12140e] px-3 py-2">
          {SHOP_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                'mc-block px-2 py-1 text-[11px] font-semibold',
                tab === t.id ? 'bg-accent-600 text-[#12250a]' : 'bg-[#2b3220] text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {night ? (
            <div className="mc-block mb-3 bg-[#2b3220] px-3 py-2 text-center text-[10px] font-bold text-amber-200">
              Gece indirimi: yiyecek, iksir, savaş, tılsım, meşale ve erken alet/zırhta %10
            </div>
          ) : null}
          {msg ? (
            <div className="mc-block mb-3 bg-[#2b3220] px-3 py-2 text-center text-xs font-bold text-slate-800">{msg}</div>
          ) : null}

          {(tab === 'all' || tab === 'alet' || list.some((i) => i.kind === 'cursor')) ? (
            <>
              <div className="mc-label mb-2 text-[9px] text-accent-500">⚔ İmleç Aletleri</div>
              <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {tab === 'all' || tab === 'alet' ? (
                  <div className="mc-block flex flex-col items-center gap-1 bg-[#191d13] p-2 text-center">
                    <span className="mc-block flex h-12 w-12 items-center justify-center bg-[#0f120b]">
                      <img src={cursorSprite('fist')} width={30} height={30} alt="" style={{ imageRendering: 'pixelated' }} />
                    </span>
                    <div className="text-[11px] font-bold text-slate-900">Yumruk</div>
                    <div className="text-[9px] text-slate-500">Varsayılan · 1 hasar</div>
                    {g.equipped === 'fist' ? (
                      <span className="mc-label text-[8px] text-accent-500">Kuşanıldı ✓</span>
                    ) : (
                      <button type="button" onClick={() => equip('fist')} className="mc-block mc-press bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-900">Kuşan</button>
                    )}
                  </div>
                ) : null}
                {list.filter((i) => i.kind === 'cursor').map(Card)}
              </div>
            </>
          ) : null}

          {list.filter((i) => i.kind !== 'cursor').length > 0 ? (
            <>
              <div className="mc-label mb-2 text-[9px] text-accent-500">Çeşit</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {list.filter((i) => i.kind !== 'cursor').map(Card)}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
