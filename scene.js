// SIGNAL 3D: the hero data globe and the scroll-driven flight tunnel (Three.js + bloom).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Exact hex colours end to end, so the canvas background matches the page (#04070a).
THREE.ColorManagement.enabled = false;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = () => window.innerWidth < 760;
const NEON = 0x00ff9d;
const CYAN = 0x00e1ff;
const MAGENTA = 0xff2e88;
const BG = 0x04070a;
const DEG = Math.PI / 180;

const hasWebGL = () => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (_) { return false; }
};

const dotTexture = (() => {
  let tex;
  return () => {
    if (tex) return tex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    tex = new THREE.CanvasTexture(c);
    return tex;
  };
})();

function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small() ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(BG, 1);
  return renderer;
}

function makeComposer(renderer, scene, camera, strength) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), strength, 0.38, 0.22);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return { composer, bloom };
}

const latLon = (lat, lon, r) => {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 180) * DEG;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
};

// Smooth pseudo-noise so the point cloud forms continent-like clusters.
const landNoise = (v) => {
  const { x, y, z } = v;
  return Math.sin(x * 2.1 + 1.3) * Math.sin(y * 2.7 + 0.4) * Math.sin(z * 2.3 + 2.2)
    + 0.55 * Math.sin(x * 4.3 - y * 1.7 + 0.9) * Math.sin(z * 3.9 + 1.1)
    + 0.25 * Math.sin(x * 9.1 + z * 7.3) * Math.sin(y * 8.7);
};

// ---------------------------------------------------------------- Globe
function initGlobe() {
  const canvas = document.querySelector('canvas.globe');
  if (!canvas) return;
  const hero = canvas.parentElement;
  const tag = hero.querySelector('.marker-tag');
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(0, 0, 7.2);

  const R = 2;
  const world = new THREE.Group();
  const globe = new THREE.Group();
  world.add(globe);
  scene.add(world);

  // Occluding core so the far side stays hidden
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 64, 64), new THREE.MeshBasicMaterial({ color: 0x03080b })));

  // Point cloud: bright "land" clusters and a sparse "ocean" grid
  const N = small() ? 2200 : 4200;
  const land = []; const sea = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    const v = new THREE.Vector3(Math.cos(th) * rad, y, Math.sin(th) * rad).multiplyScalar(R);
    if (landNoise(v) > 0.12) land.push(v); else if (i % 3 === 0) sea.push(v);
  }
  const pts = (arr, size, color, opacity) => new THREE.Points(
    new THREE.BufferGeometry().setFromPoints(arr),
    new THREE.PointsMaterial({ size, color, map: dotTexture(), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  globe.add(pts(land, 0.05, NEON, 0.95));
  globe.add(pts(sea, 0.028, CYAN, 0.35));

  // Atmosphere (fresnel glow)
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.1, 64, 64),
    new THREE.ShaderMaterial({
      uniforms: { glow: { value: new THREE.Color(CYAN) } },
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 glow; varying vec3 vN; void main(){ float i = pow(max(0.0, 0.62 - dot(vN, vec3(0.0,0.0,1.0))), 3.2) * 0.55; gl_FragColor = vec4(glow * i, i); }',
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }),
  );
  world.add(atmosphere);

  // Wireframe shell
  const shell = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(R * 1.32, 1)),
    new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.1 }),
  );
  world.add(shell);

  // Orbit rings with satellites
  const orbits = [];
  [[R * 1.55, 0.42, 0.2, NEON], [R * 1.78, -0.62, 0.9, CYAN], [R * 2.02, 1.15, -0.3, MAGENTA]].forEach(([rad, tiltX, tiltZ, color], k) => {
    const curve = new THREE.EllipseCurve(0, 0, rad, rad, 0, Math.PI * 2);
    const ringGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(180).map((p) => new THREE.Vector3(p.x, 0, p.y)));
    const ring = new THREE.LineLoop(ringGeo, new THREE.LineDashedMaterial({ color, transparent: true, opacity: k === 2 ? 0.25 : 0.35, dashSize: 0.08, gapSize: 0.06 }));
    ring.computeLineDistances();
    const pivot = new THREE.Group();
    pivot.rotation.set(tiltX, 0, tiltZ);
    pivot.add(ring);
    const sat = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sat.scale.setScalar(0.16);
    pivot.add(sat);
    world.add(pivot);
    orbits.push({ sat, rad, speed: 0.18 + k * 0.07, phase: k * 2.1 });
  });

  // Data arcs from Ibadan to the world
  const home = latLon(7.3775, 3.947, R);
  const cities = [
    [37.77, -122.42], [40.71, -74.0], [43.65, -79.38], [51.51, -0.13], [52.52, 13.4], [48.86, 2.35],
    [12.97, 77.59], [1.35, 103.82], [35.68, 139.69], [-33.87, 151.21], [-23.55, -46.63], [-1.29, 36.82], [25.2, 55.27], [6.52, 3.38],
  ];
  const arcs = [];
  cities.forEach(([la, lo], i) => {
    const end = latLon(la, lo, R);
    const dist = home.distanceTo(end) / (2 * R);
    const mid = home.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(R * (1.05 + dist * 0.75));
    const pointsOnArc = new THREE.QuadraticBezierCurve3(home, mid, end).getPoints(80);
    const geo = new THREE.BufferGeometry().setFromPoints(pointsOnArc);
    globe.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: NEON, transparent: true, opacity: 0.16 })));
    const pulse = new THREE.Line(geo.clone(), new THREE.LineBasicMaterial({ color: i % 4 === 0 ? MAGENTA : CYAN, transparent: true, opacity: 1 }));
    globe.add(pulse);
    const endDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: CYAN, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    endDot.position.copy(end).multiplyScalar(1.01); endDot.scale.setScalar(0.09);
    globe.add(endDot);
    arcs.push({ pulse, phase: Math.random(), speed: 0.22 + Math.random() * 0.18 });
  });

  // Ibadan marker
  const homeDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0xe9fff5, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  homeDot.position.copy(home).multiplyScalar(1.01); homeDot.scale.setScalar(0.2);
  globe.add(homeDot);
  const pulses = [0, 0.5].map(() => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.075, 48), new THREE.MeshBasicMaterial({ color: NEON, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.position.copy(home).multiplyScalar(1.012);
    ring.lookAt(home.clone().multiplyScalar(2));
    globe.add(ring);
    return ring;
  });

  // Star dust
  const dust = [];
  for (let i = 0; i < (small() ? 500 : 1100); i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(9 + Math.random() * 26);
    dust.push(v);
  }
  scene.add(pts(dust, 0.07, 0x9fdcff, 0.55));

  // Face Ibadan towards the camera at load
  const baseY = Math.atan2(-home.x, home.z);
  globe.rotation.y = baseY;
  world.rotation.x = 0.28;

  const { composer, bloom } = makeComposer(renderer, scene, camera, small() ? 0.55 : 0.75);
  let w = 0; let h = 0;
  // Lay the globe out in screen pixels against the part of the hero that is actually visible,
  // so it stays whole and centred on any window shape (the hero can be taller than the window).
  const layout = () => {
    const vh = Math.min(h, window.innerHeight);
    const unit = (2 * Math.tan((camera.fov * DEG) / 2) * 7.2) / h; // world units per pixel at the globe's depth
    // Use the free space to the right of the hero text; if there is not enough, rise from the bottom instead.
    const copy = hero.querySelector('.hero-copy');
    const textRight = copy ? copy.getBoundingClientRect().right - hero.getBoundingClientRect().left : w * 0.5;
    const free = w - textRight - 24;
    let cx; let cy; let radiusPx;
    if (free >= 320) {
      radiusPx = Math.min(free * 0.42, vh * 0.34);
      cx = textRight + free * 0.55;
      cy = vh * 0.53;
    } else {
      radiusPx = Math.min(w * 0.42, vh * 0.3);
      cx = w * 0.6;
      cy = h - radiusPx * 0.1;
    }
    world.scale.setScalar((radiusPx * unit) / (R * 1.1));
    world.position.set((cx - w / 2) * unit, -(cy - h / 2) * unit, 0);
  };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w, h);
    camera.aspect = w / h;
    camera.fov = w >= 1000 ? 42 : w >= 640 ? 46 : 50;
    camera.updateProjectionMatrix();
    layout();
  };
  resize();
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(hero);

  let mx = 0; let my = 0; let tmx = 0; let tmy = 0;
  window.addEventListener('pointermove', (e) => { tmx = (e.clientX / window.innerWidth - 0.5); tmy = (e.clientY / window.innerHeight - 0.5); }, { passive: true });

  const v = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const clock = new THREE.Clock();
  const draw = () => {
    const t = clock.getElapsedTime();
    const heroRect = hero.getBoundingClientRect();
    const sp = Math.min(1, Math.max(0, -heroRect.top / heroRect.height));
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    if (!reduceMotion) {
      globe.rotation.y = baseY + t * 0.06 + mx * 0.5;
      shell.rotation.y = -t * 0.04; shell.rotation.x = t * 0.02;
      world.rotation.x = 0.28 + my * 0.25;
      orbits.forEach((o) => { const a = t * o.speed + o.phase; o.sat.position.set(Math.cos(a) * o.rad, 0, Math.sin(a) * o.rad); });
      arcs.forEach((a) => {
        const p = ((t * a.speed + a.phase) % 1.35);
        const start = Math.floor(Math.min(1, p) * 80);
        a.pulse.geometry.setDrawRange(Math.max(0, start - 14), p > 1 ? 0 : 14);
      });
      pulses.forEach((ring, i) => {
        const k = ((t * 0.6 + i * 0.5) % 1);
        ring.scale.setScalar(1 + k * 4); ring.material.opacity = (1 - k) * 0.9;
      });
    } else {
      arcs.forEach((a) => a.pulse.geometry.setDrawRange(20, 30));
    }
    camera.position.z = 7.2 + sp * 2.2;
    camera.position.y = sp * 1.2;
    composer.render();

    // HUD label that follows the Ibadan marker
    if (tag) {
      homeDot.getWorldPosition(v);
      camera.getWorldDirection(camDir);
      const normal = v.clone().sub(world.getWorldPosition(new THREE.Vector3())).normalize();
      const facing = normal.dot(camDir.clone().negate()) > 0.2;
      v.project(camera);
      const sx = (v.x * 0.5 + 0.5) * w; const sy = (-v.y * 0.5 + 0.5) * h;
      const show = facing && sp < 0.6 && sx > 0 && sx < w - 140 && sy > 80 && sy < h - 40;
      tag.classList.toggle('on', show);
      if (show) tag.style.transform = `translate(${(sx + 16).toFixed(0)}px, ${(sy - 18).toFixed(0)}px)`;
    }
  };

  const loop = () => {
    const r = hero.getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight) draw();
    requestAnimationFrame(loop);
  };
  if (reduceMotion) { draw(); window.addEventListener('resize', draw); } else requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- Tunnel
function initTunnel() {
  const canvas = document.querySelector('canvas.tunnel');
  if (!canvas) return;
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(BG, 0.05);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 220);
  const LEN = 190;

  // Frames along the tunnel
  const frames = [];
  for (let i = 0; i < 64; i++) {
    const z = -i * 3;
    const sides = i % 5 === 0 ? 6 : 4;
    const radius = sides === 6 ? 3.1 : 3.4;
    const pts = [];
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2 + Math.PI / sides;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius * 0.72, 0));
    }
    const color = i % 7 === 0 ? MAGENTA : (i % 2 ? CYAN : NEON);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    line.position.z = z;
    line.rotation.z = i * 0.09;
    scene.add(line);
    frames.push(line);
  }

  // Rails: floor and ceiling grid lines
  const rail = [];
  for (let x = -3; x <= 3; x += 1) {
    rail.push(new THREE.Vector3(x, -2.3, 4), new THREE.Vector3(x, -2.3, -LEN));
    rail.push(new THREE.Vector3(x, 2.3, 4), new THREE.Vector3(x, 2.3, -LEN));
  }
  for (let z = 4; z > -LEN; z -= 3) {
    rail.push(new THREE.Vector3(-3, -2.3, z), new THREE.Vector3(3, -2.3, z));
    rail.push(new THREE.Vector3(-3, 2.3, z), new THREE.Vector3(3, 2.3, z));
  }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rail), new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.22 })));

  // Floating wireframe data blocks
  const blocks = [];
  for (let i = 0; i < 26; i++) {
    const size = 0.25 + Math.random() * 0.5;
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size)), new THREE.LineBasicMaterial({ color: i % 3 ? NEON : CYAN, transparent: true, opacity: 0.9 }));
    box.position.set((Math.random() - 0.5) * 4.6, (Math.random() - 0.5) * 3, -Math.random() * LEN);
    scene.add(box);
    blocks.push({ box, spin: 0.3 + Math.random() * 0.8 });
  }

  // Particle streaks
  const motes = [];
  for (let i = 0; i < (small() ? 900 : 2000); i++) motes.push(new THREE.Vector3((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 4.8, 4 - Math.random() * LEN));
  scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(motes), new THREE.PointsMaterial({ size: 0.04, color: 0xbff8ff, map: dotTexture(), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })));

  const { composer, bloom } = makeComposer(renderer, scene, camera, small() ? 0.6 : 0.85);
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width); const h = Math.max(1, r.height);
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  const clock = new THREE.Clock();
  let eased = 0;
  const draw = (p) => {
    const t = clock.getElapsedTime();
    eased += (p - eased) * 0.12;
    camera.position.set(Math.sin(eased * 9) * 0.35, Math.cos(eased * 7) * 0.2, 2 - eased * (LEN - 20));
    camera.rotation.z = eased * 1.1 + Math.sin(t * 0.4) * 0.03;
    frames.forEach((f, i) => { f.rotation.z = i * 0.09 + t * (i % 2 ? 0.12 : -0.1); });
    blocks.forEach((b) => { b.box.rotation.x = t * b.spin; b.box.rotation.y = t * b.spin * 0.7; });
    composer.render();
  };

  const loop = () => {
    const f = window.__flight || { progress: 0, visible: false };
    if (f.visible) draw(f.progress);
    requestAnimationFrame(loop);
  };
  if (reduceMotion) { draw(0.25); window.addEventListener('resize', () => draw(0.25)); } else requestAnimationFrame(loop);
}

if (hasWebGL()) {
  try {
    document.documentElement.classList.add('webgl');
    initGlobe();
    initTunnel();
  } catch (err) {
    document.documentElement.classList.remove('webgl');
    console.error('3D scene failed to start', err);
  }
}
