import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { recordTnt } from '../utils/progression';
import type { GraphicsQuality } from '../utils/appSettings';
import { isCombatActive, tntRespawnMs } from '../utils/game';

/**
 * A 3D Minecraft "TNT" block that pops up at a RANDOM spot on screen.
 * Click it → it explodes into voxel particles, then respawns elsewhere.
 * Every 3rd explosion hides the mouse cursor for 3 seconds (just for fun).
 * three.js is bundled by Vite, so this runs offline inside the EXE.
 * A small hit-area div tracks the block so the rest of the UI stays clickable.
 */

function makeTexture(kind: 'side' | 'top'): THREE.Texture {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#c0392b';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 240; i++) {
    const x = Math.floor(Math.random() * S);
    const y = Math.floor(Math.random() * S);
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.07)';
    ctx.fillRect(x, y, 2, 2);
  }

  if (kind === 'side') {
    ctx.fillStyle = '#f4f1e6';
    ctx.fillRect(0, S * 0.36, S, S * 0.28);
    ctx.fillStyle = '#c9c4b0';
    ctx.fillRect(0, S * 0.36, S, 2);
    ctx.fillRect(0, S * 0.64 - 2, S, 2);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TNT', S / 2, S / 2 + 1);
  } else {
    ctx.fillStyle = '#8a1f16';
    ctx.fillRect(4, 4, S - 8, S - 8);
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(S / 2 - 4, 6, 8, S - 12);
    ctx.fillRect(6, S / 2 - 4, S - 12, 8);
    ctx.fillStyle = '#e7c14b';
    ctx.fillRect(S / 2 - 5, S / 2 - 5, 10, 10);
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, S - 4, S - 4);

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

export default function TntBlock3D({ quality = 'high' }: { quality?: GraphicsQuality }) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const hitRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const hit = hitRef.current;
    if (!layer || !hit) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    } catch {
      return;
    }
    renderer.setPixelRatio(quality === 'medium' ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    const canvas = renderer.domElement;
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;';
    layer.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    const CAM_Z = 7;
    camera.position.set(0, 0, CAM_Z);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(3, 5, 4);
    scene.add(dir);

    const sideTex = makeTexture('side');
    const topTex = makeTexture('top');
    const mkMat = (t: THREE.Texture) => new THREE.MeshLambertMaterial({ map: t });
    const materials = [
      mkMat(sideTex),
      mkMat(sideTex.clone()),
      mkMat(topTex),
      mkMat(topTex.clone()),
      mkMat(sideTex.clone()),
      mkMat(sideTex.clone()),
    ];
    const TNT = 0.78;
    const tntGeo = new THREE.BoxGeometry(TNT, TNT, TNT);
    const tnt = new THREE.Mesh(tntGeo, materials);
    scene.add(tnt);

    type P = { mesh: THREE.Mesh; vel: THREE.Vector3; mat: THREE.MeshBasicMaterial };
    const particles: P[] = [];
    const partGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);

    let exploding = false;
    let running = true;

    const worldExtent = () => {
      const halfH = Math.tan((camera.fov * Math.PI) / 360) * CAM_Z;
      const halfW = halfH * camera.aspect;
      return { halfW, halfH };
    };

    const moveToRandom = () => {
      const { halfW, halfH } = worldExtent();
      const nx = (Math.random() * 2 - 1) * 0.82;
      const ny = (Math.random() * 2 - 1) * 0.72;
      tnt.position.set(nx * halfW, ny * halfH, 0);
      tnt.scale.set(0.2, 0.2, 0.2);
      tnt.visible = true;
    };
    tnt.visible = false;
    hit.style.display = 'none';
    window.setTimeout(() => {
      if (!running) return;
      moveToRandom();
      exploding = false;
      hit.style.display = 'block';
    }, tntRespawnMs());

    const explode = () => {
      if (exploding || !tnt.visible || !isCombatActive()) return;
      exploding = true;
      recordTnt();
      hit.style.display = 'none';
      const origin = tnt.position.clone();
      tnt.visible = false;
      for (let i = 0; i < (quality === 'medium' ? 28 : 90); i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: Math.random() > 0.4 ? 0xff5a3c : 0xffcf5a,
          transparent: true,
          opacity: 1,
        });
        const m = new THREE.Mesh(partGeo, mat);
        m.position.copy(origin);
        const v = new THREE.Vector3(
          (Math.random() - 0.5) * 0.22,
          (Math.random() - 0.2) * 0.22,
          (Math.random() - 0.5) * 0.22,
        );
        scene.add(m);
        particles.push({ mesh: m, vel: v, mat });
      }

      // respawn 20 seconds after the blast — particles keep full size
      window.setTimeout(() => {
        moveToRandom();
        exploding = false;
        hit.style.display = 'block';
      }, tntRespawnMs());
    };

    hit.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      explode();
    });

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    let raf = 0;
    const clock = new THREE.Clock();
    const proj = new THREE.Vector3();

    const onLost = (e: Event) => {
      e.preventDefault();
      running = false;
      cancelAnimationFrame(raf);
    };
    canvas.addEventListener('webglcontextlost', onLost as EventListener, false);

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
      const t = clock.elapsedTime;

      if (tnt.visible && isCombatActive()) {
        tnt.rotation.y += dt * 1.0;
        tnt.rotation.x = Math.sin(t * 0.8) * 0.12;
        if (tnt.scale.x < 1) {
          const s = Math.min(1, tnt.scale.x + dt * 3.5);
          tnt.scale.set(s, s, s);
        }
        // track the block with the DOM hit-area
        proj.copy(tnt.position).project(camera);
        const sx = (proj.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (1 - (proj.y * 0.5 + 0.5)) * window.innerHeight;
        const { halfH } = worldExtent();
        const px = Math.max(40, (TNT / (2 * halfH)) * window.innerHeight * 1.15);
        hit.style.width = `${px}px`;
        hit.style.height = `${px}px`;
        hit.style.transform = `translate3d(${sx - px / 2}px, ${sy - px / 2}px, 0)`;
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vel.y -= dt * 0.4;
        p.mesh.position.addScaledVector(p.vel, dt * 60);
        p.mesh.rotation.x += dt * 5;
        p.mesh.rotation.y += dt * 5;
        p.mat.opacity -= dt * 1.15;
        if (p.mat.opacity <= 0) {
          scene.remove(p.mesh);
          p.mat.dispose();
          particles.splice(i, 1);
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
      document.removeEventListener('visibilitychange', onVis);
      document.documentElement.classList.remove('mc-no-cursor');
      particles.forEach((p) => {
        scene.remove(p.mesh);
        p.mat.dispose();
      });
      partGeo.dispose();
      tntGeo.dispose();
      materials.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
      sideTex.dispose();
      topTex.dispose();
      renderer.dispose();
      if (canvas.parentNode === layer) layer.removeChild(canvas);
    };
  }, [quality]);

  return (
    <div ref={layerRef} className="mc-tnt-layer" aria-hidden>
      <div ref={hitRef} className="mc-tnt-hit" title="Tıkla → BUM!" />
    </div>
  );
}
