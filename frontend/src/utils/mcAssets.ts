const mcPng = import.meta.glob('../assets/mc/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const fxPng = import.meta.glob('../assets/fx/*.png', { eager: true, import: 'default' }) as Record<string, string>;
const mobPng = import.meta.glob('../assets/mobs/*.{png,webp}', { eager: true, import: 'default' }) as Record<string, string>;

function pick(map: Record<string, string>, file: string): string {
  for (const ext of ['webp', 'png']) {
    const needle = `/${file}.${ext}`;
    const key = Object.keys(map).find((k) => k.replace(/\\/g, '/').endsWith(needle));
    if (key) return map[key]!;
  }
  return Object.values(map)[0] ?? '';
}

export function mcIcon(file: string): string {
  return pick(mcPng, file);
}

export const MC_ITEMS: Record<string, string> = {
  fist: mcIcon('fist'),
  'pick-wood': mcIcon('wooden_pickaxe'),
  'pick-stone': mcIcon('stone_pickaxe'),
  'pick-iron': mcIcon('iron_pickaxe'),
  'pick-gold': mcIcon('golden_pickaxe'),
  'pick-diamond': mcIcon('diamond_pickaxe'),
  'pick-netherite': mcIcon('netherite_pickaxe'),
  'sword-wood': mcIcon('wooden_sword'),
  'sword-stone': mcIcon('stone_sword'),
  'sword-iron': mcIcon('iron_sword'),
  'sword-gold': mcIcon('golden_sword'),
  'sword-diamond': mcIcon('diamond_sword'),
  'sword-netherite': mcIcon('netherite_sword'),
  'axe-wood': mcIcon('wooden_axe'),
  'axe-stone': mcIcon('stone_axe'),
  'axe-iron': mcIcon('iron_axe'),
  'axe-gold': mcIcon('golden_axe'),
  'axe-diamond': mcIcon('diamond_axe'),
  'axe-netherite': mcIcon('netherite_axe'),
  'shovel-wood': mcIcon('wooden_shovel'),
  'shovel-stone': mcIcon('stone_shovel'),
  'shovel-iron': mcIcon('iron_shovel'),
  'shovel-gold': mcIcon('golden_shovel'),
  'shovel-diamond': mcIcon('diamond_shovel'),
  'shovel-netherite': mcIcon('netherite_shovel'),
  bow: mcIcon('bow'),
  crossbow: mcIcon('crossbow_standby'),
  trident: mcIcon('trident'),
  fishing: mcIcon('fishing_rod'),
  shears: mcIcon('shears'),
  milk: mcIcon('milk_bucket'),
  gapple: mcIcon('golden_apple'),
  pearl: mcIcon('ender_pearl'),
  totem: mcIcon('totem_of_undying'),
};

export const MC_MOBS = {
  spider: pick(mobPng, 'spider'),
  enderman: pick(mobPng, 'enderman'),
  creeper: pick(mobPng, 'creeper'),
  zombie: pick(mobPng, 'zombie'),
  skeleton: pick(mobPng, 'skeleton'),
  blaze: pick(mobPng, 'blaze'),
  pig: pick(mobPng, 'pig'),
  chicken: pick(mobPng, 'chicken'),
  cow: pick(mobPng, 'cow'),
  steve: pick(mobPng, 'steve'),
  steveFace: pick(mobPng, 'steve_face'),
  steveFull: pick(mobPng, 'steve_full'),
};

export const MC_UI = {
  emerald: mcIcon('emerald'),
  cobweb: mcIcon('cobweb'),
  campfire: mcIcon('campfire'),
  sun: mcIcon('sun'),
  moon: mcIcon('moon'),
  heartFull: mcIcon('heart_full'),
  heartHalf: mcIcon('heart_half'),
  heartEmpty: mcIcon('heart_empty'),
  arrow: mcIcon('arrow'),
  torch: mcIcon('torch'),
  tnt: mcIcon('tnt_side'),
  fireCharge: mcIcon('fire_charge'),
  waterBucket: mcIcon('water_bucket'),
  explosion: pick(fxPng, 'explosion_0'),
  genericParticle: pick(fxPng, 'generic_0'),
  glitter: pick(fxPng, 'glitter_0'),
  criticalHit: pick(fxPng, 'critical_hit'),
  enchantedHit: pick(fxPng, 'enchanted_hit'),
  fireSheet: pick(fxPng, 'mc_fire'),
  grass: pick(fxPng, 'mc_grass'),
  dirtSide: pick(fxPng, 'mc_dirt_side'),
};

/** Every extracted PNG is imported so none sit unused in the bundle. */
export const ALL_MC_ICONS = Object.values(mcPng);
export const ALL_FX = Object.values(fxPng);
export const ALL_MOBS = Object.values(mobPng);
