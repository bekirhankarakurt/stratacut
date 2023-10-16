import { MC_ITEMS, MC_UI, mcIcon } from './mcAssets';

export type ToolTier = 'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'netherite';
export type ShopCategory = 'alet' | 'yiyecek' | 'iksir' | 'savas' | 'zirh' | 'ozel' | 'tilsim';
export type BuffId = 'xp' | 'coin' | 'guard' | 'regen' | 'fury' | 'light';
export type ShopEffect =
  | 'heal'
  | 'healN'
  | 'milk'
  | 'pearl'
  | 'torch'
  | 'skipDay'
  | 'xp'
  | 'chorus'
  | 'clearMobs'
  | 'firework'
  | 'shield'
  | 'armor'
  | 'invuln'
  | 'totem'
  | 'douse'
  | 'music'
  | 'buff';

export type ShopItem = {
  id: string;
  name: string;
  price: number;
  desc: string;
  kind: 'cursor' | 'instant' | 'totem' | 'armor' | 'stack';
  category: ShopCategory;
  cursorKind?: 'pickaxe' | 'sword' | 'axe' | 'shovel' | 'other';
  tier?: ToolTier;
  damage?: number;
  heal?: number;
  armor?: number;
  hpBonus?: number;
  effect?: ShopEffect;
  buffId?: BuffId;
  durationMs?: number;
  xp?: number;
  icon: string;
};

/** Active XP talisman multiplies work XP and mob XP. */
export const XP_BUFF_MULT = 5;

export const BUFF_META: Record<BuffId, { name: string; icon: string }> = {
  xp: { name: 'XP Tılsımı', icon: mcIcon('experience_bottle') },
  coin: { name: 'Şans Tılsımı', icon: mcIcon('gold_ingot') },
  guard: { name: 'Koruma Tılsımı', icon: mcIcon('heart_of_the_sea') },
  regen: { name: 'Can Tılsımı', icon: mcIcon('golden_apple') },
  fury: { name: 'Öfke Tılsımı', icon: mcIcon('blaze_rod') },
  light: { name: 'Işık Tılsımı', icon: mcIcon('lantern') },
};

const TIER_TR: Record<ToolTier, string> = {
  wood: 'Tahta',
  stone: 'Taş',
  iron: 'Demir',
  gold: 'Altın',
  diamond: 'Elmas',
  netherite: 'Netherite',
};

function tool(
  kind: 'pickaxe' | 'sword' | 'axe' | 'shovel',
  tier: ToolTier,
  price: number,
  damage: number,
): ShopItem {
  const prefix = kind === 'pickaxe' ? 'pick' : kind === 'sword' ? 'sword' : kind === 'axe' ? 'axe' : 'shovel';
  const id = `${prefix}-${tier}`;
  const noun = kind === 'pickaxe' ? 'Kazma' : kind === 'sword' ? 'Kılıç' : kind === 'axe' ? 'Balta' : 'Kürek';
  const role = kind === 'sword' || kind === 'axe' ? 'savaşçı' : 'madenci';
  return {
    id,
    name: `${TIER_TR[tier]} ${noun}`,
    price,
    damage,
    kind: 'cursor',
    category: 'alet',
    cursorKind: kind,
    tier,
    icon: MC_ITEMS[id] ?? mcIcon('stick'),
    desc: `İmleç: ${damage} hasar · ${role}`,
  };
}

function cursor(id: string, file: string, name: string, price: number, damage: number, desc: string): ShopItem {
  return { id, name, price, damage, kind: 'cursor', category: 'alet', cursorKind: 'other', icon: mcIcon(file), desc };
}

function food(id: string, file: string, name: string, price: number, heal: number, desc: string): ShopItem {
  return { id, name, price, heal, kind: 'instant', category: 'yiyecek', effect: heal >= 20 ? 'heal' : 'healN', icon: mcIcon(file), desc };
}

export const SHOP_CURSORS: ShopItem[] = [
  tool('pickaxe', 'wood', 30, 1),
  tool('sword', 'wood', 50, 2),
  tool('axe', 'wood', 40, 2),
  tool('shovel', 'wood', 25, 1),
  tool('pickaxe', 'stone', 90, 1),
  tool('sword', 'stone', 130, 3),
  tool('axe', 'stone', 110, 2),
  tool('shovel', 'stone', 70, 1),
  tool('sword', 'gold', 200, 3),
  tool('axe', 'gold', 180, 2),
  tool('pickaxe', 'iron', 220, 2),
  tool('sword', 'iron', 300, 4),
  tool('axe', 'iron', 260, 3),
  tool('shovel', 'iron', 160, 2),
  tool('pickaxe', 'diamond', 480, 2),
  tool('sword', 'diamond', 640, 5),
  tool('axe', 'diamond', 560, 4),
  tool('shovel', 'diamond', 400, 2),
  tool('pickaxe', 'netherite', 1000, 3),
  tool('sword', 'netherite', 1400, 7),
  tool('axe', 'netherite', 1200, 5),
  tool('shovel', 'netherite', 900, 3),
  cursor('bow', 'bow', 'Yay', 220, 2, 'İmleç: 2 hasar · menzilli'),
  cursor('crossbow', 'crossbow_standby', 'Arbalet', 340, 3, 'İmleç: 3 hasar · ağır'),
  cursor('trident', 'trident', 'Üçlü Mızrak', 720, 4, 'İmleç: 4 hasar · okyanus'),
  cursor('fishing', 'fishing_rod', 'Olta', 80, 1, 'İmleç: 1 hasar · şaka'),
  cursor('shears', 'shears', 'Makas', 90, 1, 'İmleç: 1 hasar · keskin'),
  cursor('flint', 'flint_and_steel', 'Çakmak Taşı', 120, 2, 'İmleç: 2 hasar · kıvılcım'),
];

export const SHOP_FOOD: ShopItem[] = [
  food('apple', 'apple', 'Elma', 20, 4, '+2 kalp doldurur.'),
  food('bread', 'bread', 'Ekmek', 28, 6, '+3 kalp doldurur.'),
  food('cookie', 'cookie', 'Kurabiye', 16, 2, '+1 kalp doldurur.'),
  food('carrot', 'carrot', 'Havuç', 18, 4, '+2 kalp doldurur.'),
  food('melon', 'melon_slice', 'Karpuz', 14, 2, '+1 kalp doldurur.'),
  food('berries', 'sweet_berries', 'Tatlı Meyve', 12, 2, '+1 kalp doldurur.'),
  food('potato', 'baked_potato', 'Kızarmış Patates', 24, 6, '+3 kalp doldurur.'),
  food('pie', 'pumpkin_pie', 'Balkabağı Turtası', 40, 8, '+4 kalp doldurur.'),
  food('stew', 'mushroom_stew', 'Mantar Yahnisi', 36, 8, '+4 kalp doldurur.'),
  food('chicken', 'cooked_chicken', 'Pişmiş Tavuk', 32, 8, '+4 kalp doldurur.'),
  food('pork', 'cooked_porkchop', 'Pişmiş Domuz', 38, 10, '+5 kalp doldurur.'),
  food('steak', 'cooked_beef', 'Biftek', 42, 10, '+5 kalp doldurur.'),
  food('cake', 'cake', 'Pasta', 55, 12, '+6 kalp doldurur.'),
  food('honey', 'honey_bottle', 'Bal Şişesi', 48, 8, '+4 kalp, etkileri temizler.'),
  food('gcarrot', 'golden_carrot', 'Altın Havuç', 60, 10, '+5 kalp doldurur.'),
  { id: 'gapple', name: 'Altın Elma', price: 70, kind: 'instant', category: 'yiyecek', effect: 'heal', icon: MC_ITEMS.gapple, desc: 'Canını tamamen doldurur.' },
];

export const SHOP_POTIONS: ShopItem[] = [
  { id: 'milk', name: 'Süt Kovası', price: 45, kind: 'instant', category: 'iksir', effect: 'milk', icon: MC_ITEMS.milk, desc: 'Ağ ve olumsuz etkileri temizler.' },
  { id: 'potion', name: 'İksir', price: 55, kind: 'instant', category: 'iksir', effect: 'healN', heal: 8, icon: mcIcon('potion'), desc: '+4 kalp doldurur.' },
  { id: 'splash', name: 'Patlayıcı İksir', price: 80, kind: 'instant', category: 'iksir', effect: 'heal', icon: mcIcon('splash_potion'), desc: 'Canını tamamen doldurur.' },
  { id: 'xp_bottle', name: 'XP Şişesi', price: 90, kind: 'instant', category: 'iksir', effect: 'xp', xp: 800, icon: mcIcon('experience_bottle'), desc: '+800 XP kazandırır.' },
  { id: 'dragon_breath', name: 'Ejderha Nefesi', price: 180, kind: 'instant', category: 'iksir', effect: 'invuln', icon: mcIcon('dragon_breath'), desc: '8 sn hasar almazsın.' },
  { id: 'chorus', name: 'Kor Meyvesi', price: 50, kind: 'instant', category: 'iksir', effect: 'chorus', icon: mcIcon('chorus_fruit'), desc: 'İmleci rastgele ışınlar.' },
  { id: 'pearl', name: 'Ender İncisi', price: 140, kind: 'instant', category: 'iksir', effect: 'pearl', icon: MC_ITEMS.pearl, desc: '60 sn canavarları uzak tutar.' },
  { id: 'water', name: 'Su Kovası', price: 1, kind: 'stack', category: 'iksir', effect: 'douse', icon: mcIcon('water_bucket'), desc: 'Envantere gider. Yanan PDF’ye tıkla, söndür (buhar).' },
];

export const SHOP_COMBAT: ShopItem[] = [
  { id: 'snowball', name: 'Kartopu', price: 25, kind: 'instant', category: 'savas', effect: 'clearMobs', icon: mcIcon('snowball'), desc: 'Ekrandaki canavarları kovar.' },
  { id: 'egg', name: 'Yumurta', price: 22, kind: 'instant', category: 'savas', effect: 'clearMobs', icon: mcIcon('egg'), desc: 'Canavarları dağıtır.' },
  { id: 'fire_charge', name: 'Ateş Topu', price: 70, kind: 'instant', category: 'savas', effect: 'clearMobs', icon: mcIcon('fire_charge'), desc: 'Canavarları yakıp yok eder.' },
  { id: 'tnt_cart', name: 'TNT Vagonu', price: 110, kind: 'instant', category: 'savas', effect: 'clearMobs', icon: mcIcon('tnt_minecart'), desc: 'Tüm canavarları patlatır.' },
  { id: 'end_crystal', name: 'End Kristali', price: 160, kind: 'instant', category: 'savas', effect: 'clearMobs', icon: mcIcon('end_crystal'), desc: 'Güçlü patlama, canavarları siler.' },
  { id: 'spectral', name: 'Spektral Ok', price: 40, kind: 'instant', category: 'savas', effect: 'clearMobs', icon: mcIcon('spectral_arrow'), desc: 'Canavarları işaretleyip kovar.' },
  { id: 'gunpowder', name: 'Barut', price: 30, kind: 'instant', category: 'savas', effect: 'firework', icon: mcIcon('gunpowder'), desc: 'Kıvılcım efekti.' },
  { id: 'firework', name: 'Havai Fişek', price: 60, kind: 'instant', category: 'savas', effect: 'firework', icon: mcIcon('firework_rocket'), desc: 'Ekranda havai fişek patlatır.' },
];

export const SHOP_ARMOR: ShopItem[] = [
  { id: 'leather_helm', name: 'Deri Kask', price: 50, kind: 'armor', category: 'zirh', effect: 'armor', armor: 2, hpBonus: 2, icon: mcIcon('leather_helmet'), desc: 'Kuşanınca: hasar −12% · +1 kalp.' },
  { id: 'leather_chest', name: 'Deri Göğüslük', price: 80, kind: 'armor', category: 'zirh', effect: 'armor', armor: 3, hpBonus: 2, icon: mcIcon('leather_chestplate'), desc: 'Kuşanınca: hasar −18% · +1 kalp.' },
  { id: 'gold_helm', name: 'Altın Kask', price: 90, kind: 'armor', category: 'zirh', effect: 'armor', armor: 2, hpBonus: 2, icon: mcIcon('golden_helmet'), desc: 'Kuşanınca: hasar −12% · +1 kalp.' },
  { id: 'gold_chest', name: 'Altın Göğüslük', price: 160, kind: 'armor', category: 'zirh', effect: 'armor', armor: 5, hpBonus: 2, icon: mcIcon('golden_chestplate'), desc: 'Kuşanınca: hasar −30% · +1 kalp.' },
  { id: 'chain_helm', name: 'Zincir Kask', price: 110, kind: 'armor', category: 'zirh', effect: 'armor', armor: 3, hpBonus: 2, icon: mcIcon('chainmail_helmet'), desc: 'Kuşanınca: hasar −18% · +1 kalp.' },
  { id: 'chain_chest', name: 'Zincir Göğüslük', price: 190, kind: 'armor', category: 'zirh', effect: 'armor', armor: 5, hpBonus: 2, icon: mcIcon('chainmail_chestplate'), desc: 'Kuşanınca: hasar −30% · +1 kalp.' },
  { id: 'iron_helm', name: 'Demir Kask', price: 140, kind: 'armor', category: 'zirh', effect: 'armor', armor: 2, hpBonus: 2, icon: mcIcon('iron_helmet'), desc: 'Kuşanınca: hasar −12% · +1 kalp.' },
  { id: 'iron_chest', name: 'Demir Göğüslük', price: 240, kind: 'armor', category: 'zirh', effect: 'armor', armor: 6, hpBonus: 2, icon: mcIcon('iron_chestplate'), desc: 'Kuşanınca: hasar −36% · +1 kalp.' },
  { id: 'turtle_helm', name: 'Kaplumbağa Kabuğu', price: 180, kind: 'armor', category: 'zirh', effect: 'armor', armor: 3, hpBonus: 2, icon: mcIcon('turtle_helmet'), desc: 'Kuşanınca: hasar −18% · +1 kalp.' },
  { id: 'diamond_helm', name: 'Elmas Kask', price: 280, kind: 'armor', category: 'zirh', effect: 'armor', armor: 3, hpBonus: 2, icon: mcIcon('diamond_helmet'), desc: 'Kuşanınca: hasar −18% · +1 kalp.' },
  { id: 'diamond_chest', name: 'Elmas Göğüslük', price: 420, kind: 'armor', category: 'zirh', effect: 'armor', armor: 8, hpBonus: 4, icon: mcIcon('diamond_chestplate'), desc: 'Kuşanınca: hasar −48% · +2 kalp.' },
  { id: 'netherite_helm', name: 'Netherite Kask', price: 520, kind: 'armor', category: 'zirh', effect: 'armor', armor: 4, hpBonus: 4, icon: mcIcon('netherite_helmet'), desc: 'Kuşanınca: hasar −24% · +2 kalp.' },
  { id: 'netherite_chest', name: 'Netherite Göğüslük', price: 800, kind: 'armor', category: 'zirh', effect: 'armor', armor: 10, hpBonus: 4, icon: mcIcon('netherite_chestplate'), desc: 'Kuşanınca: hasar −60% · +2 kalp.' },
  { id: 'shield', name: 'Kalkan', price: 95, kind: 'instant', category: 'zirh', effect: 'shield', icon: mcIcon('item_frame'), desc: 'Sonraki 3 hasarı tamamen bloklar.' },
];

export const SHOP_SPECIAL: ShopItem[] = [
  { id: 'torch', name: 'Meşale', price: 40, kind: 'instant', category: 'ozel', effect: 'torch', icon: mcIcon('torch'), desc: '45 sn canavar spawn olmaz.' },
  { id: 'lantern', name: 'Fener', price: 65, kind: 'instant', category: 'ozel', effect: 'torch', icon: mcIcon('lantern'), desc: '60 sn canavar spawn olmaz.' },
  { id: 'soul_lantern', name: 'Ruh Feneri', price: 85, kind: 'instant', category: 'ozel', effect: 'torch', icon: mcIcon('soul_lantern'), desc: '75 sn canavar spawn olmaz.' },
  { id: 'clock', name: 'Saat', price: 120, kind: 'instant', category: 'ozel', effect: 'skipDay', icon: mcIcon('clock_00'), desc: 'Geceyi atlar, gündüze geçer.' },
  { id: 'compass', name: 'Pusula', price: 50, kind: 'instant', category: 'ozel', effect: 'milk', icon: mcIcon('compass_00'), desc: 'Yönünü bulur, etkileri temizler.' },
  { id: 'totem', name: 'Ölümsüzlük Totemi', price: 550, kind: 'totem', category: 'ozel', effect: 'totem', icon: MC_ITEMS.totem, desc: 'Ölünce mevcut seviyedeki XP kaybını önler.' },
  { id: 'nether_star', name: 'Nether Yıldızı', price: 900, kind: 'instant', category: 'ozel', effect: 'xp', xp: 12000, icon: mcIcon('nether_star'), desc: '+12000 XP ve prestij parıltısı.' },
  { id: 'elytra', name: 'Elytra', price: 750, kind: 'cursor', category: 'ozel', damage: 1, cursorKind: 'other', icon: mcIcon('elytra'), desc: 'İmleç: kanatlı stil · 1 hasar.' },
  { id: 'disc_cat', name: 'Müzik Diski (cat)', price: 70, kind: 'instant', category: 'ozel', effect: 'music', icon: mcIcon('music_disc_cat'), desc: 'Koleksiyon / splash yazısı.' },
  { id: 'disc_13', name: 'Müzik Diski (13)', price: 70, kind: 'instant', category: 'ozel', effect: 'music', icon: mcIcon('music_disc_13'), desc: 'Koleksiyon / splash yazısı.' },
  { id: 'disc_pigstep', name: 'Pigstep', price: 110, kind: 'instant', category: 'ozel', effect: 'music', icon: mcIcon('music_disc_pigstep'), desc: 'Koleksiyon / Nether diski.' },
  { id: 'painting', name: 'Tablo', price: 35, kind: 'instant', category: 'ozel', effect: 'firework', icon: mcIcon('painting'), desc: 'Kozmetik kutlama.' },
  { id: 'name_tag', name: 'İsim Etiketi', price: 45, kind: 'instant', category: 'ozel', effect: 'music', icon: mcIcon('name_tag'), desc: 'Koleksiyon eşyası.' },
  { id: 'saddle', name: 'Eyer', price: 55, kind: 'instant', category: 'ozel', effect: 'music', icon: mcIcon('saddle'), desc: 'Koleksiyon eşyası.' },
  { id: 'lead', name: 'Tasma', price: 30, kind: 'instant', category: 'ozel', effect: 'music', icon: mcIcon('lead'), desc: 'Koleksiyon eşyası.' },
  { id: 'book', name: 'Büyü Kitabı', price: 95, kind: 'instant', category: 'ozel', effect: 'xp', xp: 1000, icon: mcIcon('enchanted_book'), desc: '+1000 XP.' },
  { id: 'map', name: 'Harita', price: 40, kind: 'instant', category: 'ozel', effect: 'music', icon: mcIcon('map'), desc: 'Koleksiyon eşyası.' },
  { id: 'ender_eye', name: 'Ender Gözü', price: 130, kind: 'instant', category: 'ozel', effect: 'pearl', icon: mcIcon('ender_eye'), desc: '45 sn canavarları uzak tutar.' },
  { id: 'blaze_rod', name: 'Blaze Çubuğu', price: 75, kind: 'instant', category: 'ozel', effect: 'firework', icon: mcIcon('blaze_rod'), desc: 'Ateş parçacıkları.' },
  { id: 'heart_sea', name: 'Denizin Kalbi', price: 200, kind: 'instant', category: 'ozel', effect: 'xp', xp: 2500, icon: mcIcon('heart_of_the_sea'), desc: '+2500 XP nadide eşya.' },
  { id: 'diamond', name: 'Elmas', price: 150, kind: 'instant', category: 'ozel', effect: 'xp', xp: 1600, icon: mcIcon('diamond'), desc: '+1600 XP.' },
  { id: 'netherite_ingot', name: 'Netherite Külçe', price: 320, kind: 'instant', category: 'ozel', effect: 'xp', xp: 4000, icon: mcIcon('netherite_ingot'), desc: '+4000 XP.' },
];

export const SHOP_TALISMANS: ShopItem[] = [
  {
    id: 'talisman_xp',
    name: 'XP Tılsımı',
    price: 55,
    kind: 'stack',
    category: 'tilsim',
    effect: 'buff',
    buffId: 'xp',
    durationMs: 180_000,
    icon: mcIcon('experience_bottle'),
    desc: 'Envantere birikir. Kullanınca 3 dk: kesim, günlük iş ve yaratık XP’si 5 katına çıkar.',
  },
  {
    id: 'talisman_coin',
    name: 'Şans Tılsımı',
    price: 50,
    kind: 'stack',
    category: 'tilsim',
    effect: 'buff',
    buffId: 'coin',
    durationMs: 90_000,
    icon: mcIcon('gold_ingot'),
    desc: 'Envantere birikir. Kullanınca 90 sn: yaratık coin’i 2 katına çıkar.',
  },
  {
    id: 'talisman_guard',
    name: 'Koruma Tılsımı',
    price: 65,
    kind: 'stack',
    category: 'tilsim',
    effect: 'buff',
    buffId: 'guard',
    durationMs: 75_000,
    icon: mcIcon('heart_of_the_sea'),
    desc: 'Envantere birikir. Kullanınca 75 sn: alınan hasar yarıya iner.',
  },
  {
    id: 'talisman_regen',
    name: 'Can Tılsımı',
    price: 60,
    kind: 'stack',
    category: 'tilsim',
    effect: 'buff',
    buffId: 'regen',
    durationMs: 90_000,
    icon: mcIcon('golden_apple'),
    desc: 'Envantere birikir. Kullanınca 90 sn: her 3 sn ½ kalp yenilenir.',
  },
  {
    id: 'talisman_fury',
    name: 'Öfke Tılsımı',
    price: 70,
    kind: 'stack',
    category: 'tilsim',
    effect: 'buff',
    buffId: 'fury',
    durationMs: 75_000,
    icon: mcIcon('blaze_rod'),
    desc: 'Envantere birikir. Kullanınca 75 sn: imleç hasarı +2.',
  },
  {
    id: 'talisman_light',
    name: 'Işık Tılsımı',
    price: 45,
    kind: 'stack',
    category: 'tilsim',
    effect: 'buff',
    buffId: 'light',
    durationMs: 60_000,
    icon: mcIcon('lantern'),
    desc: 'Envantere birikir. Kullanınca 60 sn: yeni yaratık gelmez, mevcutlar yavaşlar.',
  },
];

export const SHOP_CONSUMABLES: ShopItem[] = [
  ...SHOP_FOOD,
  ...SHOP_POTIONS,
  ...SHOP_COMBAT,
  ...SHOP_ARMOR,
  ...SHOP_SPECIAL,
  ...SHOP_TALISMANS,
];

export const SHOP_ALL: ShopItem[] = [...SHOP_CURSORS, ...SHOP_CONSUMABLES];

export const SHOP_TABS: { id: ShopCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'alet', label: 'Aletler' },
  { id: 'yiyecek', label: 'Yiyecek' },
  { id: 'iksir', label: 'İksir' },
  { id: 'savas', label: 'Savaş' },
  { id: 'zirh', label: 'Zırh' },
  { id: 'ozel', label: 'Özel' },
  { id: 'tilsim', label: 'Tılsımlar' },
];

export function shopItemById(id: string): ShopItem | undefined {
  return SHOP_ALL.find((i) => i.id === id);
}

export function cursorSprite(id: string): string {
  if (id === 'fist' || !id) return MC_ITEMS.fist;
  if (MC_ITEMS[id]) return MC_ITEMS[id];
  const item = shopItemById(id);
  return item?.icon ?? MC_ITEMS.fist;
}

export function cursorDamage(id: string): number {
  if (id === 'fist' || !id) return 1;
  return shopItemById(id)?.damage ?? 1;
}

export function cursorLabel(id: string): string {
  if (id === 'fist' || !id) return 'Yumruk';
  return shopItemById(id)?.name ?? 'Yumruk';
}

export function armorReduction(armorPts: number): number {
  return Math.min(0.75, Math.max(0, armorPts) * 0.06);
}

export const coinSprite = MC_UI.emerald;

/** Global shop discount so early gear is reachable after a few mobs. */
export const SHOP_PRICE_MULT = 0.5;

export function nightSaleOn(item: ShopItem): boolean {
  if (item.id === 'water') return false;
  if (item.tier === 'diamond' || item.tier === 'netherite') return false;
  if (item.id === 'totem' || item.id === 'elytra' || item.id === 'nether_star' || item.id === 'netherite_ingot' || item.id === 'netherite_helm' || item.id === 'netherite_chest' || item.id === 'diamond_chest' || item.id === 'diamond_helm') {
    return false;
  }
  if (item.category === 'yiyecek' || item.category === 'iksir' || item.category === 'savas' || item.category === 'tilsim') return true;
  if (item.effect === 'torch' || item.effect === 'shield') return true;
  if (item.kind === 'armor' && item.price <= 200) return true;
  if (item.tier === 'wood' || item.tier === 'stone') return true;
  return false;
}

export function itemPrice(item: ShopItem, isNight: boolean): number {
  if (item.id === 'water') return 1;
  let p = Math.max(1, Math.round(item.price * SHOP_PRICE_MULT));
  if (isNight && nightSaleOn(item)) p = Math.max(1, Math.round(p * 0.9));
  return p;
}

export function isHelmetId(id: string): boolean {
  return id.includes('helm');
}

export function surviveBonusMs(item: ShopItem): number {
  return surviveBonusDays(item) * 24 * 60 * 60 * 1000;
}

export function surviveBonusDays(item: ShopItem): number {
  if (item.category !== 'iksir') return 0;
  if (item.kind === 'stack' || item.effect === 'douse') return 0;
  return 1;
}

export function itemGives(item: ShopItem): string {
  const bits: string[] = [];
  if (item.damage) bits.push(`${item.damage} hasar (imleç silahı)`);
  if (item.armor) bits.push(`canavar hasarı −%${Math.round(armorReduction(item.armor) * 100)}`);
  if (item.hpBonus) bits.push(`+${item.hpBonus / 2} kalp`);
  if (item.heal) bits.push(`+${item.heal / 2} kalp doldurur`);
  if (item.kind === 'totem') bits.push('ölünce seviye XP kaybını önler');
  if (item.effect === 'invuln') bits.push('8 sn hasarsızlık');
  if (item.effect === 'pearl') bits.push('canavarları uzak tutar');
  if (item.effect === 'torch') bits.push('spawn durur');
  if (item.effect === 'clearMobs') bits.push('ekrandaki canavarları temizler');
  if (item.effect === 'douse') bits.push('PDF ateşini söndürür');
  if (item.effect === 'shield') bits.push('3 hasarı bloklar');
  if (item.effect === 'xp' && item.xp) bits.push(`+${item.xp} XP`);
  if (item.effect === 'buff' && item.durationMs) {
    bits.push(`envantere birikir · tıklayınca ${Math.round(item.durationMs / 1000)} sn sürer`);
  }
  const bonusDays = surviveBonusDays(item);
  if (bonusDays) bits.push(`hayatta kalma +${bonusDays} gün`);
  if (item.tier === 'netherite' && item.cursorKind === 'sword') {
    bits.push('en güçlü kılıç');
  }
  return bits.join(' · ') || item.desc;
}

export function formatAlive(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}sa ${String(m).padStart(2, '0')}dk`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function formatAliveDays(days: number): string {
  return `Gün ${Math.max(0, Math.floor(days))}`;
}
