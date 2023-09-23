import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { GraphicsQuality } from '../utils/appSettings';

/**
 * 2.5D animated Minecraft "Overworld" terrain: a field of grass blocks that
 * scrolls toward the camera under a bright day sky, with distance haze fading
 * into the CSS sky gradient behind the transparent canvas.
 * three.js is bundled by Vite, so this runs fully offline inside the EXE.
 * Renders nothing gracefully if WebGL is unavailable (CSS sky shows instead).
 */

// Authentic-ish Minecraft palette
const GRASS = '#7fb238';
const GRASS_LIGHT = '#91bd59';
const DIRT = '#976d4d';
const DIRT_DARK = '#79553d';
const HAZE = '#c3e2d2';

function speckle(ctx: CanvasRenderingContext2D, size: number, dark: string, light: string) {
  for (let i = 0; i < size * size * 0.5; i++) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    ctx.fillStyle = Math.random() > 0.5 ? dark : light;
    ctx.fillRect(x, y, 1, 1);
  }
}

function makeTopTex(): THREE.Texture {
  const S = 16;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = GRASS;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = GRASS_LIGHT;
  for (let i = 0; i < 40; i++) {
    ctx.fillRect(Math.floor(Math.random() * S), Math.floor(Math.random() * S), 1, 1);
  }
  speckle(ctx, S, '#5f8f2b', '#a6d16a');
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return t;
}

function makeSideTex(): THREE.Texture {
  const S = 16;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  // dirt body
  ctx.fillStyle = DIRT;
  ctx.fillRect(0, 0, S, S);
  speckle(ctx, S, DIRT_DARK, '#a9805c');
  // grass top strip with a little overhang
  ctx.fillStyle = GRASS;
  ctx.fillRect(0, 0, S, 4);
  ctx.fillStyle = GRASS_LIGHT;
  for (let i = 0; i < S; i++) {
    if (Math.random() > 0.5) ctx.fillRect(i, 4, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return t;
}

function makeBottomTex(): THREE.Texture {
  const S = 16;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = DIRT;
  ctx.fillRect(0, 0, S, S);
  speckle(ctx, S, DIRT_DARK, '#a9805c');
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return t;
}

// deterministic value noise for terrain heights
function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function smooth(t: number) {
  return t * t * (3 - 2 * t);
}
function valueNoise(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  const ux = smooth(xf);
  const uz = smooth(zf);
  return a * (1 - ux) * (1 - uz) + b * ux * (1 - uz) + c * (1 - ux) * uz + d * ux * uz;
}

export default function MinecraftBackground({ quality = 'high' }: { quality?: GraphicsQuality }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const medium = quality === 'medium';
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !medium });
    } catch {
      return;
    }

    renderer.setPixelRatio(medium ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
    const setSize = () => renderer.setSize(window.innerWidth, window.innerHeight, false);
    setSize();
    const canvas = renderer.domElement;
    canvas.className = 'mc-canvas-bg';
    canvas.setAttribute('aria-hidden', 'true');
    mount.appendChild(canvas);

    const scene = new THREE.Scene();
    // Hide the far recycle: cubes fade into the sky before they teleport.
    scene.fog = new THREE.Fog(new THREE.Color(HAZE), 18, 29);

    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    const CAM_Z = 12;
    camera.position.set(0, 6.6, CAM_Z);
    camera.lookAt(0, 0.4, -3);

    scene.add(new THREE.HemisphereLight(0xdff1ff, 0x6b8f3a, 1.05));
    const sun = new THREE.DirectionalLight(0xfff6df, 0.75);
    sun.position.set(6, 12, 6);
    scene.add(sun);

    const topTex = makeTopTex();
    const sideTex = makeSideTex();
    const bottomTex = makeBottomTex();
    const topMat = new THREE.MeshLambertMaterial({ map: topTex });
    const sideMat = new THREE.MeshLambertMaterial({ map: sideTex });
    const bottomMat = new THREE.MeshLambertMaterial({ map: bottomTex });
    // BoxGeometry face order: +x -x +y -y +z -z
    const mats = [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat];
    const geo = new THREE.BoxGeometry(1.02, 1.02, 1.02);

    const COLS = medium ? 14 : 24;
    const ROWS = medium ? 14 : 26;
    const SPACING = 1.05;
    // Recycle only after a cube has passed under/behind the camera — never in the foreground.
    const RECYCLE_Z = CAM_Z + 0.45;
    const DEPTH = ROWS * SPACING;
    const heightAt = (worldX: number, worldZ: number) =>
      Math.round(valueNoise(worldX * 0.18 + 100, worldZ * 0.18 + 100) * 3.2) * 0.5;

    const group = new THREE.Group();
    const cubes: THREE.Mesh[] = [];
    for (let ci = 0; ci < COLS; ci++) {
      for (let ri = 0; ri < ROWS; ri++) {
        const m = new THREE.Mesh(geo, mats);
        m.position.x = (ci - (COLS - 1) / 2) * SPACING;
        m.position.z = -ri * SPACING + RECYCLE_Z;
        m.position.y = heightAt(m.position.x, m.position.z);
        cubes.push(m);
        group.add(m);
      }
    }
    scene.add(group);

    let raf = 0;
    let running = true;
    const clock = new THREE.Clock();
    const speed = 1.15;

    const onResize = () => {
      setSize();
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    const onLost = (e: Event) => {
      e.preventDefault();
      running = false;
      cancelAnimationFrame(raf);
    };
    const onRestored = () => {
      if (running) return;
      running = true;
      animate();
    };
    canvas.addEventListener('webglcontextlost', onLost as EventListener, false);
    canvas.addEventListener('webglcontextrestored', onRestored as EventListener, false);

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
        return;
      }
      if (running) return;
      running = true;
      animate();
    };
    document.addEventListener('visibilitychange', onVis);

    const animate = () => {
      if (!running) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      for (const m of cubes) {
        m.position.z += speed * dt;
        while (m.position.z > RECYCLE_Z) {
          m.position.z -= DEPTH;
          m.position.y = heightAt(m.position.x, m.position.z);
        }
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('webglcontextlost', onLost as EventListener);
      canvas.removeEventListener('webglcontextrestored', onRestored as EventListener);
      document.removeEventListener('visibilitychange', onVis);
      geo.dispose();
      topTex.dispose();
      sideTex.dispose();
      bottomTex.dispose();
      topMat.dispose();
      sideMat.dispose();
      bottomMat.dispose();
      renderer.dispose();
      if (canvas.parentNode === mount) mount.removeChild(canvas);
    };
  }, [quality]);

  return <div ref={mountRef} aria-hidden />;
}
