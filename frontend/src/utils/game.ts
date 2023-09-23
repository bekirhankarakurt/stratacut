// PDFCraft game engine: health (hardcore), coins, shop inventory, cursor tools,
// day/night clock, pause, debuffs and death (loses 50% of current-level XP). Persisted locally.

import { grantXp, loseHalfCurrentLevelXp, recordCoins, recordDeath, recordNight, recordShopBuy, recordTalisman, setXpMultiplier } from './progression';
import { deadlyModeEnabled } from './appSettings';
import { GAME_STORAGE_KEY, isSaveBootstrapped, scheduleDiskSave } from './diskSave';
import { mcIcon } from './mcAssets';
import {
  armorReduction,
  BUFF_META,
  cursorDamage,
  isHelmetId,
  itemPrice,
  shopItemById,
  surviveBonusDays,
  XP_BUFF_MULT,
  type BuffId,
  type ShopItem,
} from './shopItems';

const STORAGE_KEY = GAME_STORAGE_KEY;

export const MAX_HP = 20; // 10 hearts, 2 hp each
export const DAY_MS = 15 * 60 * 1000;
export const NIGHT_MS = 15 * 60 * 1000;
export const CYCLE_MS = DAY_MS + NIGHT_MS;

export function tntRespawnMs(): number {
  return 40_000 + Math.random() * 30_000;
}

export type GameState = {
  hp: number;
  maxHp: number;
  coins: number;
  owned: string[];
  equipped: string;
  equippedArmor: string;
  equippedHelm: string;
  equippedChest: string;
  totems: number;
  deaths: number;
  paused: boolean;
  dead: boolean;
  clockMs: number;
  webUntil: number;
  repelUntil: number;
  invulnUntil: number;
  shieldHits: number;
  inv: Record<string, number>;
  held: string;
  aliveMs: number;
  bestAliveMs: number;
  potionBonusMs: number;
  aliveDays: number;
  bestAliveDays: number;
  potionBonusDays: number;
  buffs: Partial<Record<BuffId, number>>;
};

function defaults(): GameState {
  return {
    hp: MAX_HP,
    maxHp: MAX_HP,
    coins: 0,
    owned: [],
    equipped: 'fist',
    equippedArmor: '',
    equippedHelm: '',
    equippedChest: '',
    totems: 0,
    deaths: 0,
    paused: false,
    dead: false,
    clockMs: 6 * 60 * 1000,
    webUntil: 0,
    repelUntil: 0,
    invulnUntil: 0,
    shieldHits: 0,
    inv: {},
    held: '',
    aliveMs: 0,
    bestAliveMs: 0,
    potionBonusMs: 0,
    aliveDays: 0,
    bestAliveDays: 0,
    potionBonusDays: 0,
    buffs: {},
  };
}

let state: GameState = load();
const listeners = new Set<() => void>();

export type GameEvent =
  | { kind: 'hurt'; amount: number }
  | { kind: 'heal' }
  | { kind: 'death' }
  | { kind: 'totem' }
  | { kind: 'coin'; amount: number }
  | { kind: 'steal'; x: number; y: number; fromX: number; fromY: number; ms: number }
  | { kind: 'web'; x: number; y: number; ms: number }
  | { kind: 'portal'; x: number; y: number }
  | { kind: 'buy'; item: ShopItem }
  | { kind: 'clearMobs' }
  | { kind: 'firework' }
  | { kind: 'chorus' }
  | { kind: 'hitFx'; crit: boolean; x: number; y: number }
  | { kind: 'arrow'; fromX: number; fromY: number; toX: number; toY: number }
  | { kind: 'fireball'; fromX: number; fromY: number; toX: number; toY: number }
  | { kind: 'ignite'; x: number; y: number }
  | { kind: 'douse'; x: number; y: number }
  | { kind: 'needWater' };
const eventListeners = new Set<(e: GameEvent) => void>();

function load(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const p = JSON.parse(raw) as Partial<GameState>;
    const d = defaults();
    const next: GameState = {
      ...d,
      ...p,
      owned: Array.isArray(p.owned) ? p.owned : [],
      equipped: p.equipped ?? 'fist',
      equippedArmor: typeof p.equippedArmor === 'string' ? p.equippedArmor : '',
      equippedHelm: typeof p.equippedHelm === 'string' ? p.equippedHelm : '',
      equippedChest: typeof p.equippedChest === 'string' ? p.equippedChest : '',
      paused: false,
      dead: false,
      webUntil: 0,
      repelUntil: 0,
      invulnUntil: 0,
      shieldHits: typeof p.shieldHits === 'number' ? p.shieldHits : 0,
      inv: p.inv && typeof p.inv === 'object' ? sanitizeInv(p.inv) : {},
      held: typeof p.held === 'string' ? p.held : '',
      aliveMs: typeof p.aliveMs === 'number' ? Math.max(0, p.aliveMs) : 0,
      bestAliveMs: typeof p.bestAliveMs === 'number' ? Math.max(0, p.bestAliveMs) : 0,
      potionBonusMs: typeof p.potionBonusMs === 'number' ? Math.max(0, p.potionBonusMs) : 0,
      aliveDays: typeof p.aliveDays === 'number' ? Math.max(0, Math.floor(p.aliveDays)) : 0,
      bestAliveDays: typeof p.bestAliveDays === 'number' ? Math.max(0, Math.floor(p.bestAliveDays)) : 0,
      potionBonusDays: typeof p.potionBonusDays === 'number' ? Math.max(0, Math.floor(p.potionBonusDays)) : 0,
      buffs: sanitizeBuffs(p.buffs, typeof p.clockMs === 'number' ? p.clockMs : d.clockMs),
      hp: typeof p.hp === 'number' ? Math.max(0, p.hp) : d.hp,
    };
    if (!next.equippedHelm && !next.equippedChest && next.equippedArmor) {
      if (isHelmetId(next.equippedArmor)) next.equippedHelm = next.equippedArmor;
      else next.equippedChest = next.equippedArmor;
    }
    const bonus = armorHpBonus(next.equippedHelm, next.equippedChest);
    next.maxHp = MAX_HP + bonus;
    if (typeof p.maxHp === 'number' && p.maxHp < 20) {
      next.hp = next.maxHp;
    } else {
      next.hp = Math.min(next.maxHp, next.hp);
    }
    if (!next.inv[next.held]) next.held = '';
    if (next.aliveDays === 0 && next.aliveMs >= CYCLE_MS) {
      next.aliveDays = Math.floor(next.aliveMs / CYCLE_MS);
    }
    if (next.bestAliveDays === 0 && next.bestAliveMs >= CYCLE_MS) {
      next.bestAliveDays = Math.floor(next.bestAliveMs / CYCLE_MS);
    }
    return next;
  } catch {
    return defaults();
  }
}

function sanitizeBuffs(raw: unknown, clockMs: number): Partial<Record<BuffId, number>> {
  const out: Partial<Record<BuffId, number>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const id of Object.keys(BUFF_META) as BuffId[]) {
    const v = (raw as Record<string, unknown>)[id];
    if (typeof v === 'number' && Number.isFinite(v) && v > clockMs) out[id] = v;
  }
  return out;
}

function sanitizeInv(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (k && Number.isFinite(n) && n > 0) out[k] = Math.min(64, Math.floor(n));
  }
  return out;
}

function armorHpBonus(helm: string, chest: string): number {
  return (shopItemById(helm)?.hpBonus ?? 0) + (shopItemById(chest)?.hpBonus ?? 0);
}

function armorPts(helm: string, chest: string): number {
  return (shopItemById(helm)?.armor ?? 0) + (shopItemById(chest)?.armor ?? 0);
}

export function wornArmorPts(): number {
  return armorPts(state.equippedHelm, state.equippedChest);
}

let persistThrottle = 0;
function persist(force = false, opts?: { disk?: boolean }) {
  if (!isSaveBootstrapped()) return;
  const now = Date.now();
  if (!force && now - persistThrottle < 4000) return;
  persistThrottle = now;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  if (opts?.disk !== false) scheduleDiskSave();
}

export function reloadGameFromStorage() {
  state = load();
  listeners.forEach((l) => l());
}

function set(patch: Partial<GameState>, opts?: { persist?: boolean }) {
  state = { ...state, ...patch };
  if (opts?.persist !== false) persist(true);
  listeners.forEach((l) => l());
}

function emit(e: GameEvent) {
  eventListeners.forEach((l) => l(e));
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function getGame(): GameState {
  return state;
}
export function isTabActive(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible' && document.hasFocus();
}

export function isCombatActive(): boolean {
  return !state.paused && !state.dead && isTabActive();
}
export function subscribeGameEvents(cb: (e: GameEvent) => void): () => void {
  eventListeners.add(cb);
  return () => eventListeners.delete(cb);
}

// ── Day / night ──────────────────────────────────────────────────
export type Phase = { isNight: boolean; progress: number; hour: number; minute: number };
export function phaseOf(clockMs: number): Phase {
  const p = ((clockMs % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
  const isNight = p >= DAY_MS;
  const within = isNight ? (p - DAY_MS) / NIGHT_MS : p / DAY_MS;
  // Map full cycle to 24h, dawn at 06:00
  const totalHours = (p / CYCLE_MS) * 24 + 6;
  const h = Math.floor(totalHours) % 24;
  const m = Math.floor((totalHours - Math.floor(totalHours)) * 60);
  return { isNight, progress: within, hour: h, minute: m };
}
export function currentPhase(): Phase {
  return phaseOf(state.clockMs);
}

// ── Actions ──────────────────────────────────────────────────────
export function setPaused(b: boolean) {
  set({ paused: b });
}
export function togglePaused() {
  set({ paused: !state.paused });
}

export function hasBuff(id: BuffId): boolean {
  return ((state.buffs ?? {})[id] ?? 0) > state.clockMs;
}

setXpMultiplier(() => (hasBuff('xp') ? XP_BUFF_MULT : 1));

export function playerHitDamage(): number {
  return cursorDamage(state.equipped) + (hasBuff('fury') ? 2 : 0);
}

export type HudEffect = { key: string; name: string; icon: string; remainingSec: number };

export function activeHudEffects(): HudEffect[] {
  const clock = state.clockMs;
  const out: HudEffect[] = [];
  if (state.repelUntil > clock) {
    out.push({
      key: 'repel',
      name: 'Kovma',
      icon: mcIcon('torch'),
      remainingSec: Math.ceil((state.repelUntil - clock) / 1000),
    });
  }
  if (state.invulnUntil > clock) {
    out.push({
      key: 'invuln',
      name: 'Hasarsızlık',
      icon: mcIcon('dragon_breath'),
      remainingSec: Math.ceil((state.invulnUntil - clock) / 1000),
    });
  }
  for (const id of Object.keys(BUFF_META) as BuffId[]) {
    const until = state.buffs[id] ?? 0;
    if (until <= clock) continue;
    const meta = BUFF_META[id];
    out.push({
      key: id,
      name: meta.name,
      icon: meta.icon,
      remainingSec: Math.ceil((until - clock) / 1000),
    });
  }
  return out;
}

export function isSpawnBlocked(): boolean {
  return isRepelling() || hasBuff('light');
}

export function damagePlayer(amount: number) {
  if (!isCombatActive()) return;
  if (state.invulnUntil > state.clockMs) return;
  if (state.shieldHits > 0) {
    set({ shieldHits: state.shieldHits - 1 });
    return;
  }
  const prot = wornArmorPts();
  let dealt = Math.max(1, Math.round(amount * (1 - armorReduction(prot))));
  if (hasBuff('guard')) dealt = Math.max(1, Math.round(dealt * 0.5));
  const hp = Math.max(0, state.hp - dealt);
  emit({ kind: 'hurt', amount: dealt });
  if (hp <= 0) {
    set({ hp: 0 });
    triggerDeath();
  } else {
    set({ hp });
  }
}

export function healFull() {
  set({ hp: state.maxHp });
  emit({ kind: 'heal' });
}

function triggerDeath() {
  if (state.totems > 0) {
    set({ totems: state.totems - 1, hp: state.maxHp });
    emit({ kind: 'totem' });
    return;
  }
  loseHalfCurrentLevelXp();
  recordDeath();
  webLock = null;
  stealLock = null;
  const run = state.aliveMs + state.potionBonusMs;
  const runDays = state.aliveDays + state.potionBonusDays;
  set({
    dead: true,
    deaths: state.deaths + 1,
    webUntil: 0,
    aliveMs: 0,
    potionBonusMs: 0,
    aliveDays: 0,
    potionBonusDays: 0,
    bestAliveMs: Math.max(state.bestAliveMs, run),
    bestAliveDays: Math.max(state.bestAliveDays, runDays),
    buffs: {},
    repelUntil: 0,
    invulnUntil: 0,
  });
  emit({ kind: 'death' });
}

export function respawn() {
  webLock = null;
  stealLock = null;
  set({ dead: false, hp: state.maxHp, webUntil: 0 });
}

export function addCoins(n: number) {
  if (n <= 0) return;
  const amount = hasBuff('coin') ? n * 2 : n;
  set({ coins: state.coins + amount });
  recordCoins(amount);
  emit({ kind: 'coin', amount });
}

export function equip(id: string) {
  if (id === 'fist') {
    set({ equipped: 'fist' });
    return;
  }
  if (!state.owned.includes(id)) return;
  const item = shopItemById(id);
  if (item?.kind === 'armor') {
    if (isHelmetId(id)) applyArmorSlots(id, state.equippedChest);
    else applyArmorSlots(state.equippedHelm, id);
    return;
  }
  set({ equipped: id });
}

function applyArmorSlots(helm: string, chest: string) {
  const prev = armorHpBonus(state.equippedHelm, state.equippedChest);
  const nextBonus = armorHpBonus(helm, chest);
  const maxHp = MAX_HP + nextBonus;
  const hp = Math.max(1, Math.min(maxHp, state.hp + Math.max(0, nextBonus - prev)));
  set({
    equippedHelm: helm,
    equippedChest: chest,
    equippedArmor: chest || helm,
    maxHp,
    hp,
  });
}

export function unequipArmor(slot?: 'helm' | 'chest') {
  if (slot === 'helm') applyArmorSlots('', state.equippedChest);
  else if (slot === 'chest') applyArmorSlots(state.equippedHelm, '');
  else applyArmorSlots('', '');
}

export function buy(id: string): { ok: boolean; reason?: string } {
  const item = shopItemById(id);
  if (!item) return { ok: false, reason: 'Ürün yok' };
  if ((item.kind === 'cursor' || item.kind === 'armor') && state.owned.includes(id)) {
    return { ok: false, reason: 'Zaten sahipsin' };
  }
  const price = itemPrice(item, currentPhase().isNight);
  if (state.coins < price) return { ok: false, reason: 'Yetersiz coin' };
  if ((item.kind === 'stack' || item.effect === 'douse') && (state.inv[id] ?? 0) >= 64) {
    return { ok: false, reason: 'Envanter dolu (64)' };
  }

  const coins = state.coins - price;
  const patch: Partial<GameState> = { coins };

  if (item.kind === 'cursor') {
    patch.owned = [...state.owned, id];
    patch.equipped = id;
  } else if (item.kind === 'stack' || item.effect === 'douse') {
    const n = Math.min(64, (state.inv[id] ?? 0) + 1);
    patch.inv = { ...state.inv, [id]: n };
    if (!state.held && (item.effect === 'douse' || item.id === 'water')) patch.held = id;
  } else if (item.kind === 'totem' || item.effect === 'totem') {
    patch.totems = state.totems + 1;
  } else if (item.kind === 'armor' || item.effect === 'armor') {
    patch.owned = [...state.owned, id];
    set(patch);
    if (isHelmetId(id)) applyArmorSlots(id, state.equippedChest);
    else applyArmorSlots(state.equippedHelm, id);
    recordShopBuy(id);
    emit({ kind: 'buy', item });
    return { ok: true };
  } else if (item.effect === 'heal') {
    patch.hp = state.maxHp;
    emit({ kind: 'heal' });
  } else if (item.effect === 'healN') {
    patch.hp = Math.min(state.maxHp, state.hp + (item.heal ?? 4));
    emit({ kind: 'heal' });
  } else if (item.effect === 'milk') {
    webLock = null;
    patch.webUntil = 0;
  } else if (item.effect === 'pearl') {
    patch.repelUntil = state.clockMs + (id === 'ender_eye' ? 45_000 : 60_000);
  } else if (item.effect === 'torch') {
    const ms = id === 'soul_lantern' ? 75_000 : id === 'lantern' ? 60_000 : 45_000;
    patch.repelUntil = state.clockMs + ms;
  } else if (item.effect === 'skipDay') {
    const p = ((state.clockMs % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
    if (p >= DAY_MS) patch.clockMs = state.clockMs + (CYCLE_MS - p);
  } else if (item.effect === 'xp') {
    grantXp(item.xp ?? 0);
  } else if (item.effect === 'chorus') {
    emit({ kind: 'chorus' });
  } else if (item.effect === 'clearMobs') {
    emit({ kind: 'clearMobs' });
  } else if (item.effect === 'firework') {
    emit({ kind: 'firework' });
  } else if (item.effect === 'shield') {
    patch.shieldHits = state.shieldHits + 3;
  } else if (item.effect === 'invuln') {
    patch.invulnUntil = state.clockMs + 8_000;
  } else if (item.effect === 'buff' && item.buffId && item.durationMs) {
    patch.buffs = { ...state.buffs, [item.buffId]: state.clockMs + item.durationMs };
  } else if (item.effect === 'music') {
    emit({ kind: 'firework' });
  }

  if (id === 'honey') {
    webLock = null;
    patch.webUntil = 0;
    patch.hp = Math.min(state.maxHp, (patch.hp ?? state.hp));
  }

  const dayBonus = surviveBonusDays(item);
  if (dayBonus) patch.potionBonusDays = state.potionBonusDays + dayBonus;

  set(patch);
  recordShopBuy(id);
  emit({ kind: 'buy', item });
  return { ok: true };
}

export function applyWeb(durationMs: number, x?: number, y?: number) {
  if (!isCombatActive()) return;
  const px = x ?? pointer.x;
  const py = y ?? pointer.y;
  pointer.x = px;
  pointer.y = py;
  webLock = { x: px, y: py, until: performance.now() + durationMs };
  set({ webUntil: state.clockMs + durationMs });
  emit({ kind: 'web', x: px, y: py, ms: durationMs });
}
export function clearWeb() {
  webLock = null;
  set({ webUntil: 0 });
}
export function isWebbed(): boolean {
  return getWebLock() != null;
}
export function getWebLock(): { x: number; y: number } | null {
  if (!webLock) return null;
  if (performance.now() >= webLock.until) {
    webLock = null;
    return null;
  }
  return { x: webLock.x, y: webLock.y };
}
export function isRepelling(): boolean {
  return state.repelUntil > state.clockMs;
}

let pointer = { x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0, y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0 };
type PosLock = { x: number; y: number; until: number };
let stealLock: PosLock | null = null;
let webLock: PosLock | null = null;

let lastActivity = Date.now();
const IDLE_MS = 60_000;
let regenAcc = 0;

export function noteActivity() {
  lastActivity = Date.now();
}

export function notePointer(x: number, y: number) {
  lastActivity = Date.now();
  if (getStealLock() || getWebLock()) return;
  pointer.x = x;
  pointer.y = y;
}

export function getAimPoint(): { x: number; y: number } {
  return getStealLock() ?? getWebLock() ?? pointer;
}

export function stealTo(x: number, y: number, fromX: number, fromY: number, ms?: number) {
  if (!isCombatActive()) return;
  const until = ms != null && ms > 0
    ? performance.now() + ms
    : (stealLock && performance.now() < stealLock.until ? stealLock.until : performance.now() + 3000);
  stealLock = { x, y, until };
  pointer.x = x;
  pointer.y = y;
  emit({ kind: 'steal', x, y, fromX, fromY, ms: until - performance.now() });
  emit({ kind: 'portal', x: fromX, y: fromY });
  emit({ kind: 'portal', x, y });
}

export function getStealLock(): { x: number; y: number } | null {
  if (!stealLock) return null;
  if (performance.now() >= stealLock.until) {
    stealLock = null;
    return null;
  }
  return { x: stealLock.x, y: stealLock.y };
}

export function clearSteal() {
  stealLock = null;
}

export function isStealing(): boolean {
  return getStealLock() != null;
}

export function emitHitFx(crit: boolean, x: number, y: number) {
  emit({ kind: 'hitFx', crit, x, y });
}

export function holdItem(id: string) {
  if (!id) {
    set({ held: '' });
    return;
  }
  if ((state.inv[id] ?? 0) <= 0) return;
  set({ held: state.held === id ? '' : id });
}

/** Use a stacked inventory item: water is held; talismans activate their buff. */
export function activateInvItem(id: string): { ok: boolean; reason?: string } {
  const item = shopItemById(id);
  if (!item) return { ok: false, reason: 'Ürün yok' };
  if (state.dead) return { ok: false, reason: 'Öldün' };
  const n = state.inv[id] ?? 0;
  if (n <= 0) return { ok: false, reason: 'Envanterde yok' };

  if (item.effect === 'douse' || item.id === 'water') {
    holdItem(id);
    return { ok: true };
  }

  if (item.effect === 'buff' && item.buffId && item.durationMs) {
    const next = { ...state.inv };
    if (n <= 1) delete next[id];
    else next[id] = n - 1;
    const prev = (state.buffs ?? {})[item.buffId] ?? 0;
    const start = Math.max(prev, state.clockMs);
    set({
      inv: next,
      held: next[id] ? state.held : state.held === id ? '' : state.held,
      buffs: { ...state.buffs, [item.buffId]: start + item.durationMs },
    });
    recordTalisman();
    return { ok: true };
  }

  return { ok: false, reason: 'Kullanılamaz' };
}

export function invCount(id: string): number {
  return state.inv[id] ?? 0;
}

export function consumeHeld(): boolean {
  const id = state.held;
  if (!id) return false;
  return consumeItem(id);
}

export function consumeItem(id: string): boolean {
  const n = state.inv[id] ?? 0;
  if (n <= 0) return false;
  const next = { ...state.inv };
  if (n <= 1) delete next[id];
  else next[id] = n - 1;
  set({ inv: next, held: next[id] ? state.held : state.held === id ? '' : state.held });
  return true;
}

export function getPdfFireTarget(): { x: number; y: number } | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector('[data-pdf-stage]') as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 48 || r.height < 48) return null;
  const padX = Math.min(36, r.width * 0.12);
  const padY = Math.min(36, r.height * 0.12);
  return {
    x: r.left + padX + Math.random() * Math.max(8, r.width - padX * 2),
    y: r.top + padY + Math.random() * Math.max(8, r.height - padY * 2),
  };
}

export function emitFireball(fromX: number, fromY: number, toX: number, toY: number) {
  emit({ kind: 'fireball', fromX, fromY, toX, toY });
}

export function emitIgnite(x: number, y: number) {
  emit({ kind: 'ignite', x, y });
}

export function emitDouse(x: number, y: number) {
  emit({ kind: 'douse', x, y });
}

export function emitNeedWater() {
  emit({ kind: 'needWater' });
}

export function emitArrow(fromX: number, fromY: number, toX: number, toY: number) {
  emit({ kind: 'arrow', fromX, fromY, toX, toY });
}

export function resetGame() {
  webLock = null;
  stealLock = null;
  state = defaults();
  persist(true, { disk: false });
  listeners.forEach((l) => l());
  emit({ kind: 'clearMobs' });
}

// ── Clock ticker: started only in the Minecraft boot path ─────────
let clockStarted = false;
let last = Date.now();

export function startGameClock() {
  if (clockStarted || typeof window === 'undefined') return;
  clockStarted = true;
  last = Date.now();
  const releaseLocks = () => {
    if (webLock || stealLock || state.webUntil) {
      webLock = null;
      stealLock = null;
      if (state.webUntil) set({ webUntil: 0 });
    }
  };
  const onTabAway = () => {
    if (!isTabActive()) releaseLocks();
  };
  document.addEventListener('visibilitychange', onTabAway);
  window.addEventListener('blur', onTabAway);
  window.addEventListener('focus', () => {
    last = Date.now();
  });

  window.setInterval(() => {
    const now = Date.now();
    const dt = Math.min(now - last, 2000);
    last = now;
    if (state.paused || state.dead || !isTabActive()) return;
    if (now - lastActivity >= IDLE_MS) {
      set({ paused: true });
      return;
    }
    const wasNight = phaseOf(state.clockMs).isNight;
    const clockMs = state.clockMs + dt;
    const sunrise = wasNight && !phaseOf(clockMs).isNight;
    const webExpired = state.webUntil && clockMs > state.webUntil;
    const invulnExpired = state.invulnUntil && clockMs > state.invulnUntil;
    if (webExpired) webLock = null;
    const buffs: Partial<Record<BuffId, number>> = {};
    for (const id of Object.keys(BUFF_META) as BuffId[]) {
      const until = (state.buffs ?? {})[id] ?? 0;
      if (until > clockMs) buffs[id] = until;
    }
    let hp = state.hp;
    if ((buffs.regen ?? 0) > clockMs && hp < state.maxHp) {
      regenAcc += dt;
      if (regenAcc >= 3000) {
        regenAcc = 0;
        hp = Math.min(state.maxHp, hp + 1);
      }
    } else {
      regenAcc = 0;
    }
    state = {
      ...state,
      clockMs,
      hp,
      buffs,
      aliveMs: state.aliveMs + dt,
      aliveDays: state.aliveDays + (sunrise ? 1 : 0),
      ...(webExpired ? { webUntil: 0 } : {}),
      ...(invulnExpired ? { invulnUntil: 0 } : {}),
    };
    if (sunrise) recordNight(deadlyModeEnabled());
    listeners.forEach((l) => l());
    persist(false);
  }, 1000);
  window.addEventListener('keydown', () => { lastActivity = Date.now(); }, { passive: true });
  window.addEventListener('pointerdown', () => { lastActivity = Date.now(); }, { passive: true });
  window.addEventListener('beforeunload', () => persist(true));
}
