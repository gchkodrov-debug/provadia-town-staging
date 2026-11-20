// PROVADIA — WORLD SPINE ENGINE
// One continuous 3D world: HEX HIVE ground + THE STREETS (built street +
// two ghosted future streets) + THE GATE + THE GOLDEN WALL + salt dust +
// the scroll-driven camera journey.
//
// Shared world contract:
//   - Three.js r160 vendored at ../../lib/three.module.min.js
//   - Ground y=0. Town axis along Z: gate z=+14, coin square at origin,
//     Golden Wall z=-16. Street runs z +26 -> -16, width x -5..+5.
//   - Palette: field #141210, golds #C9A227 / #FFEFC1 / #6B4A12 / #3D2A08,
//     salt white #F4EFE6.
//   - Lighting law: ONE warm directional key (upper-left ~45 deg,
//     castShadow), faint hemisphere only besides. Fog is set by the host
//     page (FogExp2 #141210, ~0.02). ACESFilmicToneMapping by the host.
//   - RECEIPT LAW: no invented numbers/prices/names/claims. The only count
//     in the world is the Golden Wall's 0/47.
//   - No audio. No wallet features.
//
// Interface:
//   createWorld(scene) -> {
//     group,                 // THREE.Group holding ALL world geometry
//     update(dt, t, progress), // advance animation; progress = scroll 0..1
//     stations,              // ['arrival','gate','square','wall','record','story','door']
//     setJourneyProgress(p), // set scroll-journey target progress 0..1
//     applyCamera(camera, dt), // opening flight + journey camera driver
//     getProgress(),         // smoothed scroll progress 0..1
//     getStation(),          // current station name
//     onStation(cb),         // cb(stationName, index) on change
//     setShotMode(p|null),   // freeze journey at p for screenshots
//   }

import * as THREE from '../../lib/three.module.min.js';

// ---------------------------------------------------------------- palette
export const PALETTE = {
  field: 0x141210,
  gold: 0xc9a227,
  goldPale: 0xffefc1,
  goldDeep: 0x6b4a12,
  goldDark: 0x3d2a08,
  salt: 0xf4efe6,
};

const STONE_DARK = new THREE.Color(0x2b251e);
const STONE_MID = new THREE.Color(0x3a332a);
const WOOD = 0x4f3a22;
const WOOD_DARK = 0x382818;
const ROOF_TONE = 0x54401f;

// ---------------------------------------------------------------- journey
export const STATION_NAMES = ['arrival', 'gate', 'captain', 'square', 'wall', 'record', 'door'];
export const STATION_THRESHOLDS = [0, 0.18, 0.36, 0.52, 0.68, 0.84, 1];

// Camera station points (position -> lookAt target), per locked spec.
const STATION_POS = [
  new THREE.Vector3(0, 10, 48),     // S0 arrival
  new THREE.Vector3(0, 3.4, 26),    // S1
  new THREE.Vector3(0, 2.7, 13.5),  // S2 gate / captain door
  new THREE.Vector3(0, 2.6, 7),     // S3 coin square
  new THREE.Vector3(0, 2.5, -7),    // S4 wall approach
  new THREE.Vector3(-7.5, 5.5, -11),// S5
  new THREE.Vector3(0, 6.5, 16),    // S6 final rise, looking north to the Wall
];
const STATION_LOOK = [
  new THREE.Vector3(0, 2.35, 0),    // coin
  new THREE.Vector3(0, 3.2, 14),    // gate
  new THREE.Vector3(3.6, 2, 13.5),  // captain door
  new THREE.Vector3(0, 2.35, 0),    // coin
  new THREE.Vector3(0, 3.2, -16),   // wall
  new THREE.Vector3(0, 3.0, -16),   // wall / town
  new THREE.Vector3(0, 2.5, -16),   // north over the town to the Wall
];

function stationIndexFor(p) {
  let idx = 0;
  for (let i = 0; i < STATION_THRESHOLDS.length; i++) {
    if (p >= STATION_THRESHOLDS[i]) idx = i;
  }
  return Math.min(idx, STATION_NAMES.length - 1);
}

function smootherstep(x) {
  x = Math.min(1, Math.max(0, x));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

// ---------------------------------------------------------------- helpers
function makeSoftSprite(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.4, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Triangular prism (pitched roof): width w (x), height h (y), depth d (z).
function makePrismGeometry(w, h, d) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d, bevelEnabled: false,
  });
  geo.translate(0, 0, -d / 2);
  return geo;
}

// Golden Wall slot layout — single source of truth for the canvas drawing
// AND the slot-#1 overlay, so they can never drift apart.
// Rows: 12 / 12 / 12 / 11 = 47 slots. Returns rects in canvas pixels.
const WALL_CANVAS_W = 2048;
const WALL_CANVAS_H = 768;
function wallSlotRects() {
  const rows = [12, 12, 12, 11];
  const marginX = 90, top = 118, bottom = 84;
  const rowH = (WALL_CANVAS_H - top - bottom) / rows.length;
  const rects = [];
  rows.forEach((count, r) => {
    const colW = (WALL_CANVAS_W - marginX * 2) / count;
    for (let i = 0; i < count; i++) {
      rects.push({
        x: marginX + i * colW + 9,
        y: top + r * rowH + 10,
        w: colW - 18,
        h: rowH - 20,
        row: r, col: i,
      });
    }
  });
  return rects; // length 47
}

function makeWallTexture() {
  const c = document.createElement('canvas');
  c.width = WALL_CANVAS_W;
  c.height = WALL_CANVAS_H;
  const g = c.getContext('2d');

  // Stone face.
  g.fillStyle = '#241e16';
  g.fillRect(0, 0, WALL_CANVAS_W, WALL_CANVAS_H);
  // Subtle stone mottling (deterministic, no randomness at runtime).
  for (let i = 0; i < 260; i++) {
    const x = ((i * 733) % WALL_CANVAS_W);
    const y = ((i * 389) % WALL_CANVAS_H);
    const r = 20 + ((i * 37) % 70);
    g.fillStyle = i % 2 ? 'rgba(255,239,193,0.022)' : 'rgba(0,0,0,0.05)';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Mortar courses.
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 3;
  for (let y = 96; y < WALL_CANVAS_H; y += 96) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(WALL_CANVAS_W, y); g.stroke();
  }

  // Header: the only count in the world.
  g.fillStyle = 'rgba(255,239,193,0.92)';
  g.font = '600 54px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.fillText('0 / 47', WALL_CANVAS_W / 2, 74);
  g.fillStyle = 'rgba(201,162,39,0.55)';
  g.fillRect(WALL_CANVAS_W / 2 - 130, 90, 260, 3);

  // Exactly 47 empty brick slots, faint gold outlines.
  const rects = wallSlotRects();
  g.strokeStyle = 'rgba(201,162,39,0.5)';
  g.lineWidth = 3;
  rects.forEach((r) => {
    g.strokeRect(r.x, r.y, r.w, r.h);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(r.x, r.y, r.w, r.h);
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ================================================================= create
export function createWorld(scene) {
  const group = new THREE.Group();
  group.name = 'provadia-world-spine';
  scene.add(group);

  const updaters = []; // fn(dt, t)

  // ---------------------------------------------------------- lighting law
  // ONE warm directional key light, upper-left ~45 deg, castShadow.
  const key = new THREE.DirectionalLight(0xffdf9e, 2.6);
  key.position.set(-20, 26, 16);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -36; key.shadow.camera.right = 36;
  key.shadow.camera.top = 36; key.shadow.camera.bottom = -36;
  key.shadow.camera.near = 1; key.shadow.camera.far = 90;
  key.shadow.bias = -0.0006;
  group.add(key);
  group.add(key.target);
  // Faint hemisphere only besides.
  const hemi = new THREE.HemisphereLight(0x8a7a5c, 0x141210, 0.35);
  group.add(hemi);

  // ---------------------------------------------------------- materials
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x37302a, roughness: 0.95, metalness: 0.0 });
  const stoneDarkMat = new THREE.MeshStandardMaterial({ color: 0x27211a, roughness: 0.97, metalness: 0.0 });
  const woodMat = new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.9, metalness: 0.0 });
  const woodDarkMat = new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.92, metalness: 0.0 });
  const roofMat = new THREE.MeshStandardMaterial({ color: ROOF_TONE, roughness: 0.94, metalness: 0.0 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: PALETTE.gold, roughness: 0.38, metalness: 0.85,
    emissive: 0x3d2a08, emissiveIntensity: 0.35,
  });
  const saltMat = new THREE.MeshStandardMaterial({ color: PALETTE.salt, roughness: 0.85, metalness: 0.0 });

  function box(w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    (parent || group).add(m);
    return m;
  }

  // ============================================================ HEX HIVE
  // InstancedMesh of squat hexagonal prisms tiling x -32..+32, z -36..+30.
  const HEX_R = 1.12;
  const HEX_H = 0.5;
  const hexGeo = new THREE.CylinderGeometry(HEX_R, HEX_R * 1.04, HEX_H, 6);
  const hexMat = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0.0 });
  const dx = Math.sqrt(3) * HEX_R;      // column spacing
  const dz = 1.5 * HEX_R;               // row spacing
  const hexData = [];                   // {x, z, base:Color}
  for (let row = 0, z = -36; z <= 30; z += dz, row++) {
    const xOff = (row % 2) * (dx / 2);
    for (let x = -32 + xOff; x <= 32; x += dx) {
      hexData.push({ x, z });
    }
  }
  const hexMesh = new THREE.InstancedMesh(hexGeo, hexMat, hexData.length);
  hexMesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const goldColor = new THREE.Color(PALETTE.gold);
  const tmpColor = new THREE.Color();
  hexData.forEach((h, i) => {
    // Deterministic per-instance variation (stable hash, no Math.random).
    const n = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    const frac = n - Math.floor(n);
    const onStreet = Math.abs(h.x) <= 5.6 && h.z >= -16.5 && h.z <= 26.5;
    const nearSquare = Math.hypot(h.x, h.z) < 6;
    const dist = Math.hypot(h.x / 34, h.z / 34);
    let base = STONE_DARK.clone().lerp(STONE_MID, frac * 0.8);
    if (onStreet || nearSquare) base.lerp(new THREE.Color(0x57482c), 0.45 + frac * 0.2);
    base.multiplyScalar(1 - Math.min(0.45, dist * 0.4)); // distant hexes darker
    h.base = base;
    h.phase = frac * Math.PI * 2;
    dummy.position.set(h.x, -HEX_H / 2 + 0.02, h.z); // top sits at y ~= 0.02
    dummy.rotation.y = (i % 2) * (Math.PI / 6) * 0;    // keep uniform orientation
    dummy.updateMatrix();
    hexMesh.setMatrixAt(i, dummy.matrix);
    hexMesh.setColorAt(i, base);
  });
  group.add(hexMesh);

  // Breathing golden glow travelling slowly across the field.
  updaters.push((dt, t) => {
    for (let i = 0; i < hexData.length; i++) {
      const h = hexData[i];
      const wave = Math.sin(t * 0.32 - h.x * 0.07 - h.z * 0.11 + h.phase * 0.35);
      const glow = Math.pow(0.5 + 0.5 * wave, 3) * 0.30;
      tmpColor.copy(h.base).lerp(goldColor, glow);
      hexMesh.setColorAt(i, tmpColor);
    }
    if (hexMesh.instanceColor) hexMesh.instanceColor.needsUpdate = true;
  });

  // Coin-square plaza: flat stone disc + thin gold ring at the origin.
  // (The coin itself is a separate engine; this is only its ground.)
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.4, 0.1, 40),
    stoneMat
  );
  plaza.position.set(0, 0.05, 0);
  plaza.receiveShadow = true;
  group.add(plaza);
  const plazaRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.4, 0.045, 8, 64),
    goldMat
  );
  plazaRing.rotation.x = Math.PI / 2;
  plazaRing.position.set(0, 0.1, 0);
  group.add(plazaRing);

  // ============================================================ THE GATE
  // z=+14: two dark stone pillars 1.5 x 8.6 x 1.5 at x=+/-4.1, caps, thin
  // gold trim, lintel across the top with gold trim.
  const gate = new THREE.Group();
  gate.position.z = 14;
  group.add(gate);
  [-4.1, 4.1].forEach((px) => {
    box(1.5, 8.6, 1.5, stoneDarkMat, px, 4.3, 0, gate);            // pillar
    box(1.9, 0.5, 1.9, stoneMat, px, 8.85, 0, gate);               // cap
    box(1.62, 0.14, 1.62, goldMat, px, 8.28, 0, gate);            // gold trim band
    box(1.62, 0.14, 1.62, goldMat, px, 0.6, 0, gate);             // low trim band
    box(2.0, 0.6, 2.0, stoneDarkMat, px, 0.3, 0, gate);           // footing
  });
  box(9.9, 1.1, 1.7, stoneDarkMat, 0, 9.65, 0, gate);              // lintel
  box(10.1, 0.16, 1.86, goldMat, 0, 10.28, 0, gate);               // lintel gold trim (top)
  box(10.1, 0.16, 1.86, goldMat, 0, 9.02, 0, gate);                // lintel gold trim (bottom)

  // The Captain's door: a dark wood door inset on the inner face of the
  // east pillar (the S2 lookAt target, 3.6 / ~2 / 13.5).
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 2.3, 1.05),
    new THREE.MeshStandardMaterial({ color: 0x2e1f10, roughness: 0.85 })
  );
  door.position.set(3.32, 1.17, 14);
  group.add(door);
  const doorTrim = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.5, 1.25), goldMat);
  doorTrim.position.set(3.36, 1.27, 14);
  group.add(doorTrim);
  const doorGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 10),
    new THREE.MeshBasicMaterial({ color: PALETTE.goldPale })
  );
  doorGlow.position.set(3.2, 1.9, 14.35);
  group.add(doorGlow);

  // ============================================================ HOUSES
  // One built street, period truth (~4600 BC): stone base, timber upper,
  // pitched roofs. No modern objects, no names on houses.
  const roofGeoCache = new Map();
  function roofGeo(w, h, d) {
    const k = w + '/' + h + '/' + d;
    if (!roofGeoCache.has(k)) roofGeoCache.set(k, makePrismGeometry(w, h, d));
    return roofGeoCache.get(k);
  }
  function makeHouse(x, z, ry, s) {
    const h = new THREE.Group();
    h.position.set(x, 0, z);
    h.rotation.y = ry;
    h.scale.setScalar(s);
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.5, 4.2), stoneMat);
    base.position.y = 0.75;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.6, 3.9), woodMat);
    upper.position.y = 2.3;
    const roof = new THREE.Mesh(roofGeo(3.9, 1.5, 4.7), roofMat);
    roof.position.y = 3.1;
    // Timber beams on the upper storey.
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3.24, 0.16, 4.04), woodDarkMat);
    beam.position.y = 1.62;
    [base, upper, roof, beam].forEach((m) => {
      m.castShadow = true; m.receiveShadow = true; h.add(m);
    });
    group.add(h);
    return h;
  }
  // Five houses per side flanking the street, clear of gate/wall/square.
  const houseSpots = [
    [-7.6, 10.5, Math.PI / 2], [7.7, 9.0, -Math.PI / 2],
    [-7.9, 4.5, Math.PI / 2], [7.6, 2.0, -Math.PI / 2],
    [-7.5, -1.5, Math.PI / 2], [7.9, -4.0, -Math.PI / 2],
    [-7.8, -7.5, Math.PI / 2], [7.5, -10.0, -Math.PI / 2],
    [-7.6, -12.5, Math.PI / 2], [7.8, 13.0, -Math.PI / 2],
  ];
  houseSpots.forEach(([x, z, ry], i) => {
    makeHouse(x, z, ry, 0.92 + ((i * 37) % 20) / 100);
  });

  // ---------------------------------------------------------- kiln + salt
  // Kiln at about (6.5, 0, -4) with drifting smoke (ambient state only).
  const kiln = new THREE.Group();
  kiln.position.set(6.5, 0, -4);
  group.add(kiln);
  const kilnBody = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.35, 2.1, 12), stoneDarkMat);
  kilnBody.position.y = 1.05;
  kilnBody.castShadow = true; kilnBody.receiveShadow = true;
  kiln.add(kilnBody);
  const kilnTop = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 1.0, 0.9, 12), stoneMat);
  kilnTop.position.y = 2.5;
  kilnTop.castShadow = true;
  kiln.add(kilnTop);
  const kilnMouth = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 16),
    new THREE.MeshBasicMaterial({ color: 0xff9a3c })
  );
  kilnMouth.position.set(-0.95, 0.75, 0.55);
  kilnMouth.rotation.y = -Math.PI / 3.2;
  kiln.add(kilnMouth);

  // Smoke particles drifting up from the kiln.
  const SMOKE_N = 46;
  const smokePos = new Float32Array(SMOKE_N * 3);
  const smokeSeed = new Float32Array(SMOKE_N);
  for (let i = 0; i < SMOKE_N; i++) {
    smokeSeed[i] = (i / SMOKE_N);
    smokePos[i * 3] = 6.5; smokePos[i * 3 + 1] = 3 + smokeSeed[i] * 5; smokePos[i * 3 + 2] = -4;
  }
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  const smoke = new THREE.Points(smokeGeo, new THREE.PointsMaterial({
    size: 1.5, map: makeSoftSprite('rgba(200,192,178,0.55)', 'rgba(200,192,178,0.18)'),
    transparent: true, opacity: 0.34, depthWrite: false, color: 0xbfb7a8,
    sizeAttenuation: true,
  }));
  group.add(smoke);
  updaters.push((dt, t) => {
    const p = smokeGeo.attributes.position.array;
    for (let i = 0; i < SMOKE_N; i++) {
      let y = p[i * 3 + 1] + dt * 0.55;
      if (y > 8.5) y = 3.0;
      p[i * 3 + 1] = y;
      p[i * 3] = 6.5 + Math.sin(t * 0.5 + i * 1.7) * 0.22 + (y - 3) * 0.16;
      p[i * 3 + 2] = -4 + Math.cos(t * 0.4 + i * 2.3) * 0.18;
    }
    smokeGeo.attributes.position.needsUpdate = true;
  });

  // Stacked white salt bricks near the kiln (instanced).
  const saltBricks = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.62, 0.24, 0.34), saltMat, 30
  );
  saltBricks.castShadow = true; saltBricks.receiveShadow = true;
  {
    let bi = 0;
    for (let layer = 0; layer < 3; layer++) {
      for (let r = 0; r < 2; r++) {
        for (let cx = 0; cx < 5; cx++) {
          if (bi >= 30) break;
          dummy.position.set(
            5.1 + cx * 0.66 + (layer % 2) * 0.12,
            0.14 + layer * 0.26,
            -6.3 + r * 0.4
          );
          dummy.rotation.set(0, (layer % 2) * 0.06, 0);
          dummy.updateMatrix();
          saltBricks.setMatrixAt(bi++, dummy.matrix);
        }
      }
    }
    dummy.rotation.set(0, 0, 0);
  }
  group.add(saltBricks);

  // ---------------------------------------------------------- lanterns
  // Emissive glows only, plus at most 2 real PointLights.
  const lanternMat = new THREE.MeshBasicMaterial({ color: PALETTE.goldPale });
  const postMat = woodDarkMat;
  [[-4.6, 10], [4.6, 5], [-4.6, -1], [4.6, -8], [-4.6, -13]].forEach(([x, z]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 6), postMat);
    post.position.set(x, 1.1, z);
    post.castShadow = true;
    group.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), lanternMat);
    lamp.position.set(x, 2.3, z);
    group.add(lamp);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeSoftSprite('rgba(255,239,193,0.85)', 'rgba(201,162,39,0.25)'),
      transparent: true, opacity: 0.5, depthWrite: false,
    }));
    halo.scale.setScalar(1.1);
    halo.position.set(x, 2.3, z);
    group.add(halo);
  });
  const lightGate = new THREE.PointLight(0xffc46b, 14, 11, 1.8);
  lightGate.position.set(0, 3.4, 12.5);
  group.add(lightGate);
  const lightSquare = new THREE.PointLight(0xffc46b, 12, 12, 1.8);
  lightSquare.position.set(0, 3.2, 1.5);
  group.add(lightSquare);
  updaters.push((dt, t) => {
    const f = 0.92 + 0.08 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.4);
    lightGate.intensity = 14 * f;
    lightSquare.intensity = 12 * (0.93 + 0.07 * Math.sin(t * 6.1 + 2.0));
  });

  // ============================================================ GHOST STREETS
  // Two FUTURE streets (x ~= +/-14), GHOSTED: translucent gold wireframe
  // plot outlines + flat house silhouettes. Potential, never built.
  const ghostLineMat = new THREE.LineBasicMaterial({
    color: PALETTE.gold, transparent: true, opacity: 0.4,
  });
  const ghostFillMat = new THREE.MeshBasicMaterial({
    color: PALETTE.gold, transparent: true, opacity: 0.07,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const ghostEdgeMat = new THREE.LineBasicMaterial({
    color: PALETTE.goldPale, transparent: true, opacity: 0.22,
  });
  [-14, 14].forEach((gx) => {
    // Long plot strip outline on the ground.
    const strip = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(gx - 3.4, 0.06, 24), new THREE.Vector3(gx + 3.4, 0.06, 24),
      new THREE.Vector3(gx + 3.4, 0.06, -14), new THREE.Vector3(gx - 3.4, 0.06, -14),
      new THREE.Vector3(gx - 3.4, 0.06, 24),
    ]);
    group.add(new THREE.Line(strip, ghostLineMat));
    // Flat house silhouettes + wireframe volumes.
    for (let i = 0; i < 5; i++) {
      const z = 16 - i * 7.5;
      const sil = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.4), ghostFillMat);
      sil.position.set(gx, 1.7, z);
      group.add(sil);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(3.2, 3.4, 4.0)),
        ghostEdgeMat
      );
      wire.position.set(gx, 1.7, z);
      group.add(wire);
      const plot = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(gx - 2.2, 0.06, z + 2.8), new THREE.Vector3(gx + 2.2, 0.06, z + 2.8),
        new THREE.Vector3(gx + 2.2, 0.06, z - 2.8), new THREE.Vector3(gx - 2.2, 0.06, z - 2.8),
        new THREE.Vector3(gx - 2.2, 0.06, z + 2.8),
      ]);
      group.add(new THREE.Line(plot, ghostLineMat));
    }
  });

  // ============================================================ GOLDEN WALL
  // z=-16: stone wall ~27 wide x ~7 high. Face carries a CanvasTexture
  // (2048x768) with EXACTLY 47 outlined brick slots (rows 12/12/12/11),
  // ALL EMPTY — 0 bricks laid, the true fact.
  const wallGroup = new THREE.Group();
  wallGroup.position.set(0, 0, -16);
  group.add(wallGroup);
  const wallBody = new THREE.Mesh(new THREE.BoxGeometry(27, 7, 1.1), stoneDarkMat);
  wallBody.position.y = 3.5;
  wallBody.castShadow = true; wallBody.receiveShadow = true;
  wallGroup.add(wallBody);
  const wallCap = new THREE.Mesh(new THREE.BoxGeometry(27.6, 0.45, 1.5), stoneMat);
  wallCap.position.y = 7.2;
  wallCap.castShadow = true;
  wallGroup.add(wallCap);
  const wallFace = new THREE.Mesh(
    new THREE.PlaneGeometry(27, 7),
    new THREE.MeshStandardMaterial({
      map: makeWallTexture(), roughness: 0.95, metalness: 0.0,
    })
  );
  wallFace.position.set(0, 3.5, 0.57);
  wallFace.receiveShadow = true;
  wallGroup.add(wallFace);

  // Slot #1 overlay: plane + EdgesGeometry outline, pulsing gently (sine).
  const slot1 = wallSlotRects()[0];
  const s1w = (slot1.w / WALL_CANVAS_W) * 27;
  const s1h = (slot1.h / WALL_CANVAS_H) * 7;
  const s1x = ((slot1.x + slot1.w / 2) / WALL_CANVAS_W - 0.5) * 27;
  const s1y = (0.5 - (slot1.y + slot1.h / 2) / WALL_CANVAS_H) * 7 + 3.5;
  const slot1Fill = new THREE.Mesh(
    new THREE.PlaneGeometry(s1w, s1h),
    new THREE.MeshBasicMaterial({
      color: PALETTE.gold, transparent: true, opacity: 0.14, depthWrite: false,
    })
  );
  slot1Fill.position.set(s1x, s1y, 0.6);
  wallGroup.add(slot1Fill);
  const slot1EdgeMat = new THREE.LineBasicMaterial({
    color: PALETTE.goldPale, transparent: true, opacity: 0.8,
  });
  const slot1Edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(s1w, s1h)),
    slot1EdgeMat
  );
  slot1Edge.position.set(s1x, s1y, 0.61);
  wallGroup.add(slot1Edge);
  updaters.push((dt, t) => {
    const s = 0.5 + 0.5 * Math.sin(t * 1.6);
    slot1EdgeMat.opacity = 0.45 + 0.45 * s;
    slot1Fill.material.opacity = 0.07 + 0.11 * s;
    const sc = 1 + 0.025 * Math.sin(t * 1.6);
    slot1Edge.scale.setScalar(sc);
  });

  // ============================================================ SALT DUST
  // ~380 Points, soft round sprite, salt white, drifting slowly upward.
  const DUST_N = 380;
  const dustPos = new Float32Array(DUST_N * 3);
  const dustSpeed = new Float32Array(DUST_N);
  for (let i = 0; i < DUST_N; i++) {
    const n1 = Math.sin(i * 12.9898) * 43758.5453;
    const n2 = Math.sin(i * 78.233) * 12543.123;
    const f1 = n1 - Math.floor(n1), f2 = n2 - Math.floor(n2);
    dustPos[i * 3] = -30 + f1 * 60;
    dustPos[i * 3 + 1] = f2 * 9;
    dustPos[i * 3 + 2] = -34 + ((f1 + f2) % 1) * 62;
    dustSpeed[i] = 0.12 + f1 * 0.25;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.32, map: makeSoftSprite('rgba(244,239,230,0.9)', 'rgba(244,239,230,0.35)'),
    transparent: true, opacity: 0.5, depthWrite: false, color: PALETTE.salt,
    sizeAttenuation: true,
  }));
  group.add(dust);
  updaters.push((dt, t) => {
    const p = dustGeo.attributes.position.array;
    for (let i = 0; i < DUST_N; i++) {
      let y = p[i * 3 + 1] + dt * dustSpeed[i];
      if (y > 9.5) y = 0.1;
      p[i * 3 + 1] = y;
      p[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.08;
    }
    dustGeo.attributes.position.needsUpdate = true;
  });

  // ============================================================ JOURNEY
  const posCurve = new THREE.CatmullRomCurve3(STATION_POS, false, 'catmullrom', 0.35);
  const lookCurve = new THREE.CatmullRomCurve3(STATION_LOOK, false, 'catmullrom', 0.35);

  let targetProgress = 0;      // scroll progress requested by host
  let smoothProgress = 0;      // damped journey progress actually used
  let shotMode = null;         // frozen progress for screenshots
  let elapsed = 0;             // seconds since createWorld (opening flight)
  let openingDone = false;
  let currentStation = -1;
  const stationCbs = [];

  const _pos = new THREE.Vector3();
  const _look = new THREE.Vector3();
  const _blendFrom = new THREE.Vector3();
  let blendT = 1; // 1 = fully on journey pose

  // Warp scroll progress through the station thresholds so that at
  // p = threshold[i] the camera sits exactly at station i, easing
  // (smootherstep) within each leg — stations get a natural dwell.
  function warpProgress(p) {
    p = Math.min(1, Math.max(0, p));
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let i = stationIndexFor(p);
    if (i >= STATION_NAMES.length - 1) i = STATION_NAMES.length - 2;
    const a = STATION_THRESHOLDS[i];
    const b = STATION_THRESHOLDS[i + 1];
    const local = smootherstep((p - a) / (b - a));
    return (i + local) / (STATION_NAMES.length - 1);
  }

  function journeyPose(u, outPos, outLook) {
    const t = warpProgress(u);
    posCurve.getPoint(t, outPos);
    lookCurve.getPoint(t, outLook);
  }

  function setJourneyProgress(p) {
    targetProgress = Math.min(1, Math.max(0, p || 0));
  }

  function setShotMode(p) {
    shotMode = (p === null || p === undefined || isNaN(p)) ? null : Math.min(1, Math.max(0, p));
    if (shotMode !== null) {
      smoothProgress = shotMode;
      targetProgress = shotMode;
      openingDone = true;
    }
  }

  function applyCamera(camera, dt) {
    // Frozen screenshot mode: exact journey pose, no opening, no damping.
    if (shotMode !== null) {
      journeyPose(shotMode, _pos, _look);
      camera.position.copy(_pos);
      camera.lookAt(_look);
      return;
    }

    // Opening flight (~7s, smootherstep): ride the journey curve from the
    // arrival overlook (u=0) through the gate to the coin square (u=0.36, station square).
    if (!openingDone) {
      const u = 0.36 * smootherstep(elapsed / 7);
      journeyPose(u, _pos, _look);
      camera.position.copy(_pos);
      camera.lookAt(_look);
      if (elapsed >= 7) {
        openingDone = true;
        _blendFrom.copy(camera.position);
        blendT = 0;
      }
      return;
    }

    // Scroll journey with lerp damping. While scroll is untouched (p=0)
    // after the opening, hold the square (u=0.36) the flight arrived at.
    const uTarget = targetProgress <= 0.001 ? 0.36 : targetProgress;
    smoothProgress += (uTarget - smoothProgress) * Math.min(1, dt * 3.2);
    if (Math.abs(uTarget - smoothProgress) < 0.0004) smoothProgress = uTarget;
    journeyPose(smoothProgress, _pos, _look);

    if (blendT < 1) {
      blendT = Math.min(1, blendT + dt / 1.2);
      const e = smootherstep(blendT);
      camera.position.lerpVectors(_blendFrom, _pos, e);
    } else {
      camera.position.copy(_pos);
    }
    camera.lookAt(_look);
  }

  // ---------------------------------------------------------- main update
  function update(dt, t, progress) {
    elapsed += dt;
    if (typeof progress === 'number') setJourneyProgress(progress);
    for (const fn of updaters) fn(dt, t);

    const pForStation = shotMode !== null ? shotMode : targetProgress;
    const idx = stationIndexFor(pForStation);
    if (idx !== currentStation) {
      currentStation = idx;
      const name = STATION_NAMES[idx];
      stationCbs.slice().forEach((cb) => { try { cb(name, idx); } catch (e) { /* host cb */ } });
    }
  }

  return {
    group,
    update,
    stations: STATION_NAMES.slice(),
    setJourneyProgress,
    applyCamera,
    getProgress: () => (shotMode !== null ? shotMode : targetProgress),
    getStation: () => STATION_NAMES[Math.max(0, currentStation)],
    onStation: (cb) => { if (typeof cb === 'function') stationCbs.push(cb); },
    setShotMode,
  };
}
