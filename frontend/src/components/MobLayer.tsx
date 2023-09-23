import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addCoins,
  applyWeb,
  clearWeb,
  currentPhase,
  damagePlayer,
  emitArrow,
  emitFireball,
  emitIgnite,
  getPdfFireTarget,
  emitHitFx,
  getAimPoint,
  getGame,
  hasBuff,
  isCombatActive,
  isSpawnBlocked,
  isWebbed,
  isStealing,
  notePointer,
  playerHitDamage,
  stealTo,
  clearSteal,
  subscribeGameEvents,
} from '../utils/game';
import { trackScreenOffset } from '../utils/osCursor';
import { grantXp, levelFromXp, getSnapshot, recordMobKill } from '../utils/progression';
import { coinSprite, XP_BUFF_MULT } from '../utils/shopItems';
import { deadlyModeEnabled, nightMobsEnabled, subscribeAppSettings } from '../utils/appSettings';
import { MC_MOBS, MC_UI } from '../utils/mcAssets';
import { gfxSpriteEdge, useLoResSrc } from '../utils/loRes';
import { useGraphicsQuality } from '../utils/useGraphics';
import PortalFx from './PortalFx';

type MobType = 'zombie' | 'spider' | 'skeleton' | 'creeper' | 'enderman' | 'blaze';

type MobCfg = {
  src: string;
  hp: number;
  coins: number;
  w: number;
  h: number;
  speed: number;
};

const CFG: Record<MobType, MobCfg> = {
  zombie: { src: MC_MOBS.zombie, hp: 8, coins: 28, w: 56, h: 112, speed: 55 },
  spider: { src: MC_MOBS.spider, hp: 8, coins: 32, w: 110, h: 82, speed: 70 },
  skeleton: { src: MC_MOBS.skeleton, hp: 8, coins: 34, w: 56, h: 112, speed: 42 },
  blaze: { src: MC_MOBS.blaze, hp: 10, coins: 45, w: 96, h: 206, speed: 38 },
  creeper: { src: MC_MOBS.creeper, hp: 9, coins: 40, w: 54, h: 96, speed: 100 },
  enderman: { src: MC_MOBS.enderman, hp: 10, coins: 55, w: 56, h: 140, speed: 380 },
};

const MOB_GAP_MIN = 120_000;
const MOB_GAP_MAX = 150_000;
const FIRST_SPAWN_MIN = 8_000;
const FIRST_SPAWN_MAX = 18_000;
const DEADLY_GAP = 30_000;
const MAX_MOBS_NORMAL = 3;
const MAX_MOBS_DEADLY = 5;
const BOSS_CHANCE = 0.16;
const BOSS_HP_MULT = 8;
const BOSS_COIN_MULT = 4;
const BOSS_SIZE_MULT = 2.15;
const BOSS_ATK_SLOW = 1.2;
const BOSS_ATK_DMG = 3;
const ENRAGE_SPAWN_CHANCE = 0.28;
const ENRAGE_REVIVE_CHANCE = 0.82;
const ENRAGE_HP_MULT = 1.7;
const ENRAGE_SIZE_EXTRA = 1.42;
const ENRAGE_COIN_MULT = 4;
const ENRAGE_XP_MULT = 3;

const CREEPER_FUSE_MS = 1500;
const CREEPER_IGNITE_DIST = 85;
const CREEPER_CANCEL_DIST = 200;
const CREEPER_BLAST_DIST = 130;

type MobData = {
  id: number;
  type: MobType;
  hpMax: number;
  coins: number;
  x: number;
  y: number;
  boss?: boolean;
  canEnrage?: boolean;
  enrage?: boolean;
};
type Fx = { id: number; kind: 'coin' | 'poof' | 'scorch' | 'xp' | 'rage'; x: number; y: number; amount?: number };
type WebShot = { id: number; x: number; y: number; tx: number; ty: number };

const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let mobCounter = 0;
let fxCounter = 0;

function randEdge(): { x: number; y: number } {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const edge = Math.floor(Math.random() * 4);
  return {
    x: edge === 0 ? 10 : edge === 1 ? W - 90 : Math.random() * (W - 100),
    y: edge === 2 ? 70 : edge === 3 ? H - 150 : 70 + Math.random() * (H - 220),
  };
}

function randAwayFrom(prev: { x: number; y: number }, minDist = 240): { x: number; y: number } {
  const W = window.innerWidth;
  const H = window.innerHeight;
  for (let i = 0; i < 16; i++) {
    const p = {
      x: 16 + Math.random() * Math.max(40, W - 120),
      y: 70 + Math.random() * Math.max(40, H - 220),
    };
    if (Math.hypot(p.x - prev.x, p.y - prev.y) >= minDist) return p;
  }
  return randEdge();
}

function randBetween(minMs: number, maxMs: number) {
  return minMs + Math.random() * (maxMs - minMs);
}

function spawnCombatOn() {
  return deadlyModeEnabled() || (currentPhase().isNight && nightMobsEnabled());
}

function pickWave(deadly: boolean, blazeThisNight: boolean): MobType[] {
  const pool: MobType[] = ['zombie', 'spider', 'skeleton', 'creeper', 'enderman'];
  if (!deadly) {
    if (!blazeThisNight) return ['blaze'];
    return [pool[Math.floor(Math.random() * pool.length)]!];
  }
  const count = 2 + Math.floor(Math.random() * 3);
  const types: MobType[] = [];
  let creeper = false;
  let blaze = false;
  let enderman = false;
  const deadlyPool: MobType[] = [...pool, 'blaze'];
  for (let i = 0; i < count; i++) {
    let t = deadlyPool[Math.floor(Math.random() * deadlyPool.length)]!;
    if (t === 'creeper' && creeper) t = 'zombie';
    if (t === 'blaze' && blaze) t = 'skeleton';
    if (t === 'enderman' && enderman) t = 'spider';
    if (t === 'creeper') creeper = true;
    if (t === 'blaze') blaze = true;
    if (t === 'enderman') enderman = true;
    types.push(t);
  }
  return types;
}

function aim() {
  const p = getAimPoint();
  if (p.x || p.y) {
    mouse.x = p.x;
    mouse.y = p.y;
  }
  return mouse;
}

export default function MobLayer() {
  const [mobs, setMobs] = useState<MobData[]>([]);
  const [fx, setFx] = useState<Fx[]>([]);
  const [shots, setShots] = useState<WebShot[]>([]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      trackScreenOffset(e);
      notePointer(e.clientX, e.clientY);
      const p = getAimPoint();
      mouse.x = p.x;
      mouse.y = p.y;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    return subscribeGameEvents((e) => {
      if (e.kind === 'clearMobs') setMobs([]);
    });
  }, []);

  useEffect(() => {
    return subscribeAppSettings(() => {
      if (!nightMobsEnabled() && !deadlyModeEnabled()) setMobs((prev) => (prev.length ? [] : prev));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let tid = 0;
    let blazeThisNight = false;
    let wasNight = currentPhase().isNight;
    let deadlyPrimed = deadlyModeEnabled() && !currentPhase().isNight;

    const schedule = (ms: number) => {
      window.clearTimeout(tid);
      tid = window.setTimeout(tick, ms);
    };

    const tick = () => {
      if (cancelled) return;
      const night = currentPhase().isNight;
      const deadly = deadlyModeEnabled();
      const active = deadly || (night && nightMobsEnabled());
      if (!active) {
        blazeThisNight = false;
        wasNight = false;
        deadlyPrimed = false;
        setMobs((prev) => (prev.length ? [] : prev));
        schedule(1000);
        return;
      }
      if (night && !wasNight) {
        wasNight = true;
        blazeThisNight = false;
        schedule(randBetween(FIRST_SPAWN_MIN, FIRST_SPAWN_MAX));
        return;
      }
      if (!night) wasNight = false;
      if (deadly && !night && !deadlyPrimed) {
        deadlyPrimed = true;
        schedule(randBetween(FIRST_SPAWN_MIN, FIRST_SPAWN_MAX));
        return;
      }
      if (!deadly) deadlyPrimed = false;

      const game = getGame();
      if (game.paused || game.dead || isSpawnBlocked() || !isCombatActive()) {
        schedule(1500);
        return;
      }

      const types = pickWave(deadly, blazeThisNight);
      const cap = deadly ? MAX_MOBS_DEADLY : MAX_MOBS_NORMAL;
      const hpMult = deadly ? 3 : 1;
      setMobs((prev) => {
        const room = cap - prev.length;
        if (room <= 0) return prev;
        const level = levelFromXp(getSnapshot().xp).level;
        const added: MobData[] = [];
        const spawnBoss = !prev.some((m) => m.boss) && Math.random() < BOSS_CHANCE;
        for (const type of types.slice(0, room)) {
          if (type === 'blaze') blazeThisNight = true;
          const cfg = CFG[type];
          const pos = added.length ? randAwayFrom(added[added.length - 1]!) : randEdge();
          const boss = spawnBoss && added.length === 0;
          const canEnrage = boss && Math.random() < ENRAGE_SPAWN_CHANCE;
          added.push({
            id: ++mobCounter,
            type,
            hpMax: (cfg.hp + Math.floor(level / 6)) * hpMult * (boss ? BOSS_HP_MULT : 1),
            coins: (cfg.coins + Math.floor(level / 2)) * (boss ? BOSS_COIN_MULT : 1),
            x: pos.x,
            y: pos.y,
            boss,
            canEnrage,
          });
        }
        return added.length ? [...prev, ...added] : prev;
      });
      schedule(deadly ? DEADLY_GAP : randBetween(MOB_GAP_MIN, MOB_GAP_MAX));
    };

    schedule(spawnCombatOn() ? randBetween(FIRST_SPAWN_MIN, FIRST_SPAWN_MAX) : 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, []);

  const removeMob = (id: number) => setMobs((prev) => prev.filter((m) => m.id !== id));

  const killMob = (m: MobData, x: number, y: number, exploded = false) => {
    if (m.type === 'spider') clearWeb();

    if (m.boss && m.canEnrage && !m.enrage && !exploded && Math.random() < ENRAGE_REVIVE_CHANCE) {
      const rid = ++fxCounter;
      const pid = ++fxCounter;
      setFx((prev) => [...prev, { id: pid, kind: 'poof', x, y }, { id: rid, kind: 'rage', x, y: y - 28 }]);
      window.setTimeout(() => setFx((prev) => prev.filter((f) => f.id !== rid && f.id !== pid)), 1400);
      const enraged: MobData = {
        ...m,
        id: ++mobCounter,
        hpMax: Math.max(1, Math.round(m.hpMax * ENRAGE_HP_MULT)),
        coins: m.coins * ENRAGE_COIN_MULT,
        x: Math.max(8, x - 40),
        y: Math.max(56, y - 50),
        canEnrage: false,
        enrage: true,
      };
      setMobs((prev) => [...prev.filter((n) => n.id !== m.id), enraged]);
      return;
    }

    const cid = ++fxCounter;
    const pid = ++fxCounter;
    const next: Fx[] = [{ id: pid, kind: 'poof', x, y }];
    const xid = ++fxCounter;
    if (!exploded) {
      const shown = hasBuff('coin') ? m.coins * 2 : m.coins;
      addCoins(m.coins);
      const baseXp = Math.max(25, Math.round(m.coins * 1.5));
      const xpGain = (hasBuff('xp') ? baseXp * XP_BUFF_MULT : baseXp) * (m.enrage ? ENRAGE_XP_MULT : 1);
      grantXp(xpGain);
      recordMobKill(!!m.boss, !!m.enrage);
      next.push({ id: cid, kind: 'coin', x, y, amount: shown });
      next.push({ id: xid, kind: 'xp', x, y: y - 22, amount: xpGain });
    }
    if (m.type === 'creeper' || exploded) {
      const sid = ++fxCounter;
      next.push({ id: sid, kind: 'scorch', x, y });
      window.setTimeout(() => setFx((prev) => prev.filter((f) => f.id !== sid)), 5000);
    }
    setFx((prev) => [...prev, ...next]);
    window.setTimeout(() => setFx((prev) => prev.filter((f) => f.id !== cid && f.id !== pid && f.id !== xid)), 1000);
    removeMob(m.id);
  };

  const throwWeb = (fromX: number, fromY: number, toX: number, toY: number) => {
    if (!isCombatActive() || isWebbed()) return;
    const id = ++fxCounter;
    setShots((prev) => [...prev, { id, x: fromX, y: fromY, tx: toX, ty: toY }]);
    window.setTimeout(() => {
      setShots((prev) => prev.filter((s) => s.id !== id));
      applyWeb(1800, toX, toY);
    }, 280);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[45]" aria-hidden>
      <PortalFx />
      {mobs.map((m) => (
        <Mob key={m.id} data={m} onKill={killMob} onDespawn={removeMob} onWeb={throwWeb} />
      ))}
      {shots.map((s) => (
        <img
          key={s.id}
          src={MC_UI.cobweb}
          alt=""
          className="pointer-events-none fixed"
          style={{
            left: s.x - 18,
            top: s.y - 18,
            width: 36,
            height: 36,
            imageRendering: 'pixelated',
            animation: 'mc-web-shot 0.28s linear forwards',
            ['--tx' as string]: `${s.tx - s.x}px`,
            ['--ty' as string]: `${s.ty - s.y}px`,
          }}
        />
      ))}
      {fx.map((f) =>
        f.kind === 'coin' ? (
          <div
            key={f.id}
            className="pointer-events-none fixed flex items-center gap-1 font-mono text-sm font-black text-emerald-300"
            style={{ left: f.x, top: f.y, animation: 'mc-float 1s ease-out forwards', textShadow: '1px 1px 0 #000' }}
          >
            <img src={coinSprite} width={18} height={18} alt="" style={{ imageRendering: 'pixelated' }} />+{f.amount}
          </div>
        ) : f.kind === 'xp' ? (
          <div
            key={f.id}
            className="pointer-events-none fixed font-mono text-sm font-black text-lime-300"
            style={{ left: f.x, top: f.y, animation: 'mc-float 1s ease-out forwards', textShadow: '1px 1px 0 #000' }}
          >
            +{f.amount} XP
          </div>
        ) : f.kind === 'rage' ? (
          <div
            key={f.id}
            className="pointer-events-none fixed font-mono text-base font-black text-red-400"
            style={{
              left: f.x - 40,
              top: f.y,
              animation: 'mc-float 1.4s ease-out forwards',
              textShadow: '1px 1px 0 #000, 0 0 12px #ef4444',
            }}
          >
            ÖFKELİ!
          </div>
        ) : f.kind === 'scorch' ? (
          <div
            key={f.id}
            className="pointer-events-none fixed"
            style={{
              left: f.x - 48,
              top: f.y - 36,
              width: 96,
              height: 72,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.92) 0%, rgba(10,10,10,0.75) 42%, rgba(0,0,0,0) 72%)',
              animation: 'mc-scorch 5s ease-out forwards',
            }}
          />
        ) : (
          <img
            key={f.id}
            src={MC_UI.explosion}
            alt=""
            className="pointer-events-none fixed"
            style={{
              left: f.x - 24,
              top: f.y - 24,
              width: 48,
              height: 48,
              imageRendering: 'pixelated',
              animation: 'mc-pop 0.5s ease-out forwards',
            }}
          />
        ),
      )}
    </div>
  );
}

function Mob({
  data,
  onKill,
  onDespawn,
  onWeb,
}: {
  data: MobData;
  onKill: (m: MobData, x: number, y: number, exploded?: boolean) => void;
  onDespawn: (id: number) => void;
  onWeb: (fromX: number, fromY: number, toX: number, toY: number) => void;
}) {
  const base = CFG[data.type];
  const gfx = useGraphicsQuality();
  const animated = /\.webp(?:\?|$)/i.test(base.src);
  const src = useLoResSrc(base.src, animated ? 0 : gfxSpriteEdge(gfx));
  const cfg = useMemo(() => {
    const gfxMul = gfx === 'low' ? 0.75 : gfx === 'medium' ? 0.85 : 1;
    const sizeMul = gfxMul * (data.boss ? BOSS_SIZE_MULT * (data.enrage ? ENRAGE_SIZE_EXTRA : 1) : 1);
    const speedMul = data.enrage ? 1.5 : data.boss ? 1.15 : 1;
    return { ...base, w: Math.round(base.w * sizeMul), h: Math.round(base.h * sizeMul), speed: base.speed * speedMul };
  }, [base, gfx, data.boss, data.enrage]);
  const atkDmg = data.enrage ? BOSS_ATK_DMG + 2 : data.boss ? BOSS_ATK_DMG : 1;
  const atkSlow = data.enrage ? 0.75 : data.boss ? BOSS_ATK_SLOW : 1;
  const [hp, setHp] = useState(data.hpMax);
  const [hurt, setHurt] = useState(false);
  const [fuse, setFuse] = useState(false);
  const elRef = useRef<HTMLDivElement | null>(null);
  const pos = useRef({ x: data.x, y: data.y });
  const vel = useRef({
    x: (Math.random() - 0.5) * cfg.speed,
    y: (Math.random() - 0.5) * cfg.speed,
  });
  const hpRef = useRef(hp);
  hpRef.current = hp;
  const lastContact = useRef(0);
  const exploded = useRef(false);
  const fuseAt = useRef(0);
  const grabbing = useRef(false);

  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      if (!isCombatActive()) {
        if (fuseAt.current) fuseAt.current += dt * 1000;
      } else {
        const target = aim();
        const chasing = data.type === 'zombie' || data.type === 'creeper' || data.type === 'enderman';
        const fusing = data.type === 'creeper' && fuseAt.current > 0;
        if (chasing && !grabbing.current) {
          const dx = target.x - pos.current.x - cfg.w / 2;
          const dy = target.y - pos.current.y - cfg.h / 2;
          const d = Math.hypot(dx, dy) || 1;
          const speedMul = hasBuff('light') ? 0.55 : 1;
          const speed = (fusing ? cfg.speed * 0.45 : cfg.speed) * speedMul;
          vel.current.x = (dx / d) * speed;
          vel.current.y = (dy / d) * speed;
        }
        if (!grabbing.current) {
          pos.current.x += vel.current.x * dt;
          pos.current.y += vel.current.y * dt;
        }
        const W = window.innerWidth;
        const H = window.innerHeight;
        if (pos.current.x < 4) { pos.current.x = 4; vel.current.x *= -1; }
        if (pos.current.x > W - cfg.w) { pos.current.x = W - cfg.w; vel.current.x *= -1; }
        if (pos.current.y < 56) { pos.current.y = 56; vel.current.y *= -1; }
        if (pos.current.y > H - cfg.h) { pos.current.y = H - cfg.h; vel.current.y *= -1; }

        if (data.type === 'zombie' || data.type === 'spider') {
          const d = Math.hypot(target.x - pos.current.x - cfg.w / 2, target.y - pos.current.y - cfg.h / 2);
          const hitDist = data.enrage ? 92 : data.boss ? 78 : 48;
          if (d < hitDist && now - lastContact.current > 1200 * atkSlow) {
            lastContact.current = now;
            damagePlayer(1 * atkDmg);
          }
        }

        if (data.type === 'creeper' && !exploded.current) {
          const d = Math.hypot(target.x - pos.current.x - cfg.w / 2, target.y - pos.current.y - cfg.h / 2);
          const igniteDist = CREEPER_IGNITE_DIST * (data.boss ? 1.4 : 1);
          const cancelDist = CREEPER_CANCEL_DIST * (data.boss ? 1.3 : 1);
          const blastDist = CREEPER_BLAST_DIST * (data.boss ? 1.4 : 1);
          if (fuseAt.current) {
            if (d > cancelDist) {
              fuseAt.current = 0;
              setFuse(false);
            } else if (now - fuseAt.current >= CREEPER_FUSE_MS * atkSlow) {
              exploded.current = true;
              const x = pos.current.x + cfg.w / 2;
              const y = pos.current.y + cfg.h / 2;
              if (d < blastDist) damagePlayer(3 * atkDmg);
              onKill(data, x, y, true);
            }
          } else if (d < igniteDist) {
            fuseAt.current = now;
            setFuse(true);
          }
        }
      }
      if (elRef.current) {
        const hover = data.type === 'blaze' ? Math.sin(now / 420) * 10 : 0;
        elRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y + hover}px, 0)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cfg.w, cfg.h, cfg.speed, data.type, data.boss, atkDmg, atkSlow]);

  useEffect(() => {
    const timers: number[] = [];
    const active = () => isCombatActive();

    if (data.type === 'spider') {
      timers.push(
        window.setTimeout(() => {
          if (!active() || isWebbed()) return;
          const t = aim();
          onWeb(pos.current.x + cfg.w / 2, pos.current.y + cfg.h / 2, t.x, t.y);
        }, 5000 * atkSlow),
      );
      timers.push(
        window.setInterval(() => {
          if (!active() || isWebbed()) return;
          const t = aim();
          onWeb(pos.current.x + cfg.w / 2, pos.current.y + cfg.h / 2, t.x, t.y);
        }, 14000 * atkSlow),
      );
    } else if (data.type === 'enderman') {
      const grabX = () => pos.current.x + cfg.w / 2;
      const grabY = () => pos.current.y + 28;
      const hopCount = 5;
      const hopMs = 240 * atkSlow;
      const startGrab = () => {
        if (!active() || grabbing.current || isStealing()) return;
        grabbing.current = true;
        const sequenceMs = hopCount * hopMs + 200;
        const t = aim();
        stealTo(grabX(), grabY(), t.x, t.y, sequenceMs);

        let hop = 0;
        const doHop = () => {
          if (!active()) {
            grabbing.current = false;
            clearSteal();
            return;
          }
          hop += 1;
          const fromX = grabX();
          const fromY = grabY();
          const dest = randAwayFrom(pos.current);
          pos.current.x = dest.x;
          pos.current.y = dest.y;
          const remain = (hopCount - hop) * hopMs + 200;
          stealTo(dest.x + cfg.w / 2, dest.y + 28, fromX, fromY, remain);
          if (hop < hopCount) {
            timers.push(window.setTimeout(doHop, hopMs));
          } else {
            timers.push(
              window.setTimeout(() => {
                clearSteal();
                grabbing.current = false;
                onDespawn(data.id);
              }, hopMs),
            );
          }
        };
        timers.push(window.setTimeout(doHop, 70));
      };
      timers.push(
        window.setInterval(() => {
          if (!active() || grabbing.current || isStealing()) return;
          const t = aim();
          const d = Math.hypot(t.x - grabX(), t.y - grabY());
          if (d < (data.boss ? 150 : 110)) startGrab();
        }, 120 * atkSlow),
      );
    } else if (data.type === 'skeleton') {
      timers.push(
        window.setInterval(() => {
          if (!active()) return;
          const t = aim();
          emitArrow(pos.current.x + cfg.w / 2, pos.current.y + 20, t.x, t.y);
          damagePlayer(1 * atkDmg);
        }, 3000 * atkSlow),
      );
    } else if (data.type === 'blaze') {
      let shots = 0;
      const shoot = () => {
        if (!active() || shots >= 3) return;
        const target = getPdfFireTarget();
        if (!target) return;
        shots += 1;
        const fromX = pos.current.x + cfg.w / 2;
        const fromY = pos.current.y + 36;
        emitFireball(fromX, fromY, target.x, target.y);
        window.setTimeout(() => {
          if (!active()) return;
          emitIgnite(target.x, target.y);
          damagePlayer(1 * atkDmg);
          if (shots >= 3) onDespawn(data.id);
        }, 420);
      };
      timers.push(window.setTimeout(shoot, 1400 * atkSlow));
      timers.push(window.setTimeout(shoot, 5200 * atkSlow));
      timers.push(window.setTimeout(shoot, 9000 * atkSlow));
    }

    const lifeMs = data.enrage
      ? 70_000 + Math.random() * 18_000
      : data.boss
        ? 62_000 + Math.random() * 16_000
        : 26_000 + Math.random() * 8_000;
    timers.push(window.setTimeout(() => onDespawn(data.id), lifeMs));
    return () => timers.forEach((t) => { window.clearInterval(t); window.clearTimeout(t); });
  }, [data, cfg.w, cfg.h, onDespawn, onKill, onWeb, atkDmg, atkSlow]);

  const takeHit = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dmg = playerHitDamage();
    const next = hpRef.current - dmg;
    setHurt(true);
    emitHitFx(dmg >= 3, e.clientX, e.clientY);
    window.setTimeout(() => setHurt(false), 180);
    if (next <= 0) {
      exploded.current = true;
      onKill(data, pos.current.x + cfg.w / 2, pos.current.y + cfg.h / 2);
    } else {
      setHp(next);
    }
  };

  const glow = data.enrage
    ? 'drop-shadow(0 0 14px #ef4444) drop-shadow(0 0 8px #f97316) drop-shadow(0 2px 0 #000)'
    : gfx === 'low' || gfx === 'medium'
      ? data.boss
        ? 'drop-shadow(0 0 8px #f59e0b) drop-shadow(0 2px 0 #000)'
        : 'drop-shadow(0 2px 0 #000)'
      : data.boss
        ? 'drop-shadow(0 0 12px #f59e0b) drop-shadow(0 0 6px #facc15) drop-shadow(0 2px 0 #000)'
        : data.type === 'enderman'
        ? 'drop-shadow(0 0 8px #c026d3) drop-shadow(0 2px 0 #000)'
        : data.type === 'blaze'
          ? 'drop-shadow(0 0 10px #f97316) drop-shadow(0 0 4px #facc15) drop-shadow(0 2px 0 #000)'
          : 'drop-shadow(0 0 4px rgba(255,255,255,0.45)) drop-shadow(0 2px 0 #000)';

  return (
    <div
      ref={elRef}
      className="pointer-events-none fixed left-0 top-0"
      style={{ width: cfg.w, transform: `translate3d(${data.x}px, ${data.y}px, 0)` }}
    >
      {data.boss ? (
        <div
          className={`mx-auto mb-0.5 text-center font-mono text-[9px] font-black ${data.enrage ? 'text-red-400' : 'text-amber-300'}`}
          style={{ textShadow: '1px 1px 0 #000' }}
        >
          {data.enrage ? 'ÖFKELİ' : 'BOSS'}
        </div>
      ) : null}
      {hp < data.hpMax ? (
        <div className={`mx-auto mb-1 h-1.5 overflow-hidden bg-black/70 ${data.boss ? 'w-20' : 'w-10'}`}>
          <div className={`h-full ${data.enrage ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${(hp / data.hpMax) * 100}%` }} />
        </div>
      ) : null}
      <img
        src={src}
        alt=""
        width={cfg.w}
        height={cfg.h}
        onPointerDown={takeHit}
        className="pointer-events-auto cursor-none select-none"
        style={{
          width: cfg.w,
          height: cfg.h,
          objectFit: 'contain',
          imageRendering: animated || data.type === 'spider' || data.type === 'enderman' ? 'auto' : 'pixelated',
          animation: fuse
            ? 'mc-mob-hurt 0.3s steps(1) infinite'
            : hurt
              ? 'mc-mob-hurt 0.18s'
              : data.enrage
                ? 'mc-boss-rage 0.35s steps(2) infinite'
                : gfx === 'high'
                ? data.type === 'blaze'
                  ? undefined
                  : 'mc-mob-float 2s ease-in-out infinite'
                : undefined,
          filter: fuse ? `brightness(1.8) ${glow}` : glow,
          transform: fuse ? 'scale(1.15)' : undefined,
        }}
      />
    </div>
  );
}
