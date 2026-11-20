// PROVADIA — COIN ENGINE (town module)
// The Fortress P coin with its Secret Side reverse: the town's living hero.
//
//   import { createCoin } from './engine.js';
//   const { group, api } = createCoin();
//   group.position.set(0, 2.35, 0);          // origin = coin centre
//   scene.add(group);
//   // per frame: api.update(dtSeconds, elapsedSeconds);
//
// Construction lifted from the two George-approved builds:
//   front  — design-bakeoff/pi-kimi gate winner (identical in the
//            Secret Side page): 5 brick courses, exactly 7 merlons,
//            exactly 47 rim beads. THE P LAW: the Fortress P is the
//            coin's name-sign; the P front is the home / rest pose.
//   reverse — provadia-secretside/index.html as on disk: a shader face
//            where four marks reveal by tilt angle theta, plus the
//            Fortress P emblem ghosted at the centre of the reverse
//            with a hard visibility floor (~0.25) — never fully gone.
//            Per George's 2026-11-20 refinement the ghost is the
//            ORIGINAL FORTRESS P LOGO (the brick-built P emblem from
//            the coin itself), not a plain letterform: the glyph below
//            is drawn as brick courses with a merlon crown, the same
//            construction as the emblem. A host may override it with
//            opts.textures.p / opts.pTextureUrl.
//
// Palette: #C9A227 gold · #FFEFC1 pale · #6B4A12 deep · #3D2A08 shadow,
// field #141210. Lighting law: ONE warm key (45 deg, upper-left) is the
// host scene's job (see MODULE.md); this module adds only the Coin Rush
// presence accents — a pulsing ember point light, a sheen sweep, idle
// sway/bob and a sparse salt-dust mote ring. No audio. No text or
// letters on the metal beyond the Fortress P emblem itself.

import * as THREE from '../../lib/three.module.min.js';

export const COIN_COLORS = {
  field: 0x141210,
  gold: 0xC9A227,
  paleGold: 0xFFEFC1,
  deepGold: 0x6B4A12,
  shadowGold: 0x3D2A08,
  salt: 0xF4EFE6
};

// theta (deg) each mark owns on the reverse, and its caption name.
export const COIN_MARK_CENTERS = [-42, -14, 14, 42];
export const COIN_MARK_NAMES = ['THE SCEPTRE', 'THE MASK', 'THE BULL', 'THE RING-IDOL'];

// Freeze poses (rotY radians), same set as the Secret Side page.
export const COIN_POSES = {
  front: 0,
  plain: Math.PI,
  sceptre: Math.PI - THREE.MathUtils.degToRad(42),
  mask: Math.PI - THREE.MathUtils.degToRad(14),
  bull: Math.PI + THREE.MathUtils.degToRad(14),
  ring: Math.PI + THREE.MathUtils.degToRad(42)
};

const REST_TILT_X = 0.05; // the approved builds' resting tilt
const FLIP_SECONDS = 1.5;

function smootherstep(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function smooth01(x) {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}
function wrapDeg(deg) {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}
// Tilt-reveal weights, lifted verbatim from the Secret Side build:
// a gate keeps theta = 0 (straight on) plain; each mark owns an 18 deg
// half-band around its centre, shaped by a smoothstep.
function computeWeights(thetaDeg) {
  const gate = smooth01((Math.abs(thetaDeg) - 4) / 7);
  return COIN_MARK_CENTERS.map(center => {
    const raw = Math.max(0, 1 - Math.abs(thetaDeg - center) / 18);
    return (raw * raw * (3 - 2 * raw)) * gate;
  });
}

// The Fortress P emblem as a luminance glyph (white on black): a letter
// P built from brick courses — staggered mortar joints, a merlon crown
// along its top edge and the emblem's foot slab — drawn at 1024px so
// the shader's relief/emboss reads the brickwork, not a font outline.
function drawFortressP(canvas) {
  const S = canvas.width;
  const g = canvas.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  const u = S / 100; // unit space 0..100

  // --- silhouette mask (offscreen): stem + bowl - counter + foot ---
  const mask = document.createElement('canvas');
  mask.width = S; mask.height = S;
  const m = mask.getContext('2d');
  m.fillStyle = '#fff';
  m.fillRect(31 * u, 17 * u, 13.5 * u, 66 * u);            // stem
  m.beginPath();                                            // bowl
  m.ellipse(44.5 * u, 33.5 * u, 19.5 * u, 16.5 * u, 0, 0, Math.PI * 2);
  m.fill();
  m.fillRect(28.5 * u, 81 * u, 18.5 * u, 5.5 * u);          // foot slab
  m.globalCompositeOperation = 'destination-out';           // counter
  m.beginPath();
  m.ellipse(46 * u, 33.5 * u, 10.8 * u, 9.3 * u, 0, 0, Math.PI * 2);
  m.fill();
  m.globalCompositeOperation = 'source-over';

  // --- brick courses inside the silhouette ---
  const brick = document.createElement('canvas');
  brick.width = S; brick.height = S;
  const b = brick.getContext('2d');
  b.fillStyle = '#fff';
  b.fillRect(0, 0, S, S);
  b.strokeStyle = '#000';
  b.lineWidth = 0.55 * u;
  const courseH = 5.5 * u;
  let row = 0;
  for (let y = 14 * u; y < 90 * u; y += courseH, row++) {
    b.beginPath(); b.moveTo(0, y); b.lineTo(S, y); b.stroke();
    const off = row % 2 === 0 ? 0 : 4.5 * u;
    for (let x = 24 * u + off; x < 72 * u; x += 9 * u) {
      b.beginPath(); b.moveTo(x, y); b.lineTo(x, y + courseH); b.stroke();
    }
  }
  b.globalCompositeOperation = 'destination-in';
  b.drawImage(mask, 0, 0);
  g.drawImage(brick, 0, 0);

  // --- merlon crown along the top edge (the emblem's battlements) ---
  g.fillStyle = '#fff';
  const merlonW = 5.6 * u, merlonH = 5.2 * u;
  const crown = [
    [30.2, 11.8], [37.4, 11.8], [44.6, 11.8],           // over the stem
    [51.6, 13.4], [57.8, 16.6], [62.6, 21.6]            // following the bowl
  ];
  crown.forEach(([x, y], i) => {
    g.save();
    g.translate(x * u, y * u);
    g.rotate([0, 0, 0, 0.18, 0.38, 0.62][i]);
    g.fillRect(-merlonW / 2, -merlonH / 2, merlonW, merlonH);
    g.restore();
  });
  return canvas;
}

export function createCoin(opts = {}) {
  const anisotropy = opts.anisotropy ?? 8;
  const idleEnabled = opts.idle !== false;

  // ---------- groups: group (town-placed) > bob > spinner (the coin) --
  const group = new THREE.Group();
  group.name = 'ProvadiaCoin';
  const bobGroup = new THREE.Group();
  const spinner = new THREE.Group();
  bobGroup.add(spinner);
  group.add(bobGroup);

  // ---------- materials (lifted from the approved builds) ----------
  const gold = new THREE.MeshStandardMaterial({
    color: COIN_COLORS.gold,
    emissive: COIN_COLORS.shadowGold,
    emissiveIntensity: 0.2,
    metalness: 0.76,
    roughness: 0.29
  });
  const reliefGold = new THREE.MeshStandardMaterial({
    color: COIN_COLORS.gold,
    emissive: COIN_COLORS.shadowGold,
    emissiveIntensity: 0.16,
    metalness: 0.69,
    roughness: 0.32
  });
  const paleGold = new THREE.MeshStandardMaterial({
    color: COIN_COLORS.paleGold,
    emissive: COIN_COLORS.deepGold,
    emissiveIntensity: 0.13,
    metalness: 0.67,
    roughness: 0.26
  });

  // ---------- body: radius 2, thickness 0.36 ----------
  const coinBodyGeometry = new THREE.CylinderGeometry(2, 2, 0.36, 96, 1, false);
  coinBodyGeometry.rotateX(Math.PI / 2);
  const coinBody = new THREE.Mesh(coinBodyGeometry, gold);
  coinBody.castShadow = true;
  coinBody.receiveShadow = true;
  spinner.add(coinBody);

  // ---------- FRONT: the Fortress P ----------
  // George's ruling (2026-11-20 12:42 CT): when opts.frontArtworkUrl is
  // given, the P-side is the ORIGINAL PUBLISHED coin face — the canonical
  // artwork is the front's source of truth, carried on a face disc inside
  // the coin's own rim; the artwork carries its own bricks, merlons and
  // bead ring, so the procedural relief stands down. Without the opt, the
  // winner's procedural construction (verbatim) is built as before.
  const front = new THREE.Group();
  const beadGeometry = new THREE.SphereGeometry(0.047, 10, 8); // shared: front ring + reverse ring
  const useArtworkFront = typeof opts.frontArtworkUrl === 'string' && opts.frontArtworkUrl.length > 0;
  if (useArtworkFront) {
    const artTex = new THREE.TextureLoader().load(opts.frontArtworkUrl);
    artTex.colorSpace = THREE.SRGBColorSpace;
    artTex.anisotropy = anisotropy;
    // The published face fills ~94% of the artwork's frame — pull the
    // disc's UVs in so the disc edge lands on the artwork's own rim.
    artTex.repeat.set(0.94, 0.94);
    artTex.offset.set(0.03, 0.03);
    const artFace = new THREE.Mesh(
      new THREE.CircleGeometry(1.995, 96),
      new THREE.MeshStandardMaterial({
        map: artTex,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: artTex,
        emissiveIntensity: 0.22,
        metalness: 0.35,
        roughness: 0.42
      })
    );
    artFace.position.z = 0.183;
    artFace.receiveShadow = true;
    front.add(artFace);
  } else {
  const frontBrickGeometry = new THREE.BoxGeometry(0.39, 0.21, 0.085);
  for (let course = 0; course < 5; course++) {
    const count = course % 2 === 0 ? 5 : 6;
    for (let i = 0; i < count; i++) {
      const brickMesh = new THREE.Mesh(frontBrickGeometry, reliefGold);
      brickMesh.position.set((i - (count - 1) / 2) * 0.45, -0.82 + course * 0.29, 0.2325);
      brickMesh.castShadow = true;
      front.add(brickMesh);
    }
  }
  const merlonGeometry = new THREE.BoxGeometry(0.3, 0.24, 0.085);
  for (let i = 0; i < 7; i++) {
    const angle = THREE.MathUtils.degToRad(40 + i * (100 / 6));
    const merlon = new THREE.Mesh(merlonGeometry, reliefGold);
    merlon.position.set(Math.cos(angle) * 1.5, Math.sin(angle) * 1.5, 0.2325);
    merlon.rotation.z = angle - Math.PI / 2;
    merlon.castShadow = true;
    front.add(merlon);
  }
  for (let i = 0; i < 47; i++) {
    const angle = i / 47 * Math.PI * 2;
    const bead = new THREE.Mesh(beadGeometry, paleGold);
    bead.position.set(Math.cos(angle) * 1.76, Math.sin(angle) * 1.76, 0.225);
    front.add(bead);
  }
  }
  spinner.add(front);

  // ---------- front sheen sweep (Coin Rush presence) ----------
  const sheenUniforms = {
    uSweep: { value: 4 },
    uFace: { value: 1 },
    uPale: { value: new THREE.Color(COIN_COLORS.paleGold) }
  };
  const sheen = new THREE.Mesh(
    new THREE.CircleGeometry(1.92, 64),
    new THREE.ShaderMaterial({
      uniforms: sheenUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uSweep;
        uniform float uFace;
        uniform vec3 uPale;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          float band = exp(-pow((p.x * 1.2 + p.y * 0.38 - uSweep) * 2.6, 2.0));
          float a = band * smoothstep(1.0, 0.82, r) * 0.14 * uFace;
          gl_FragColor = vec4(uPale, a);
        }
      `
    })
  );
  sheen.position.z = useArtworkFront ? 0.2 : 0.282; // just above the face
  spinner.add(sheen);

  // ---------- REVERSE: the Secret Side shader face (lifted) ----------
  const marksBase = opts.marksBase ?? new URL('./marks/', import.meta.url).href;
  const loader = new THREE.TextureLoader();
  function loadMark(file, override) {
    if (override) return override;
    const tex = loader.load(marksBase + file);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    return tex;
  }
  const texOverrides = opts.textures ?? {};

  let pTexture = texOverrides.p ?? null;
  if (!pTexture && opts.pTextureUrl) {
    pTexture = loader.load(opts.pTextureUrl);
    pTexture.colorSpace = THREE.SRGBColorSpace;
    pTexture.anisotropy = anisotropy;
  }
  if (!pTexture) {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 1024;
    pCanvas.height = 1024;
    drawFortressP(pCanvas);
    pTexture = new THREE.CanvasTexture(pCanvas);
    pTexture.colorSpace = THREE.SRGBColorSpace;
    pTexture.anisotropy = anisotropy;
  }

  const secretUniforms = {
    tP: { value: pTexture },
    tSceptre: { value: loadMark('sceptre.webp', texOverrides.sceptre) },
    tMask: { value: loadMark('mask.webp', texOverrides.mask) },
    tBull: { value: loadMark('bull.webp', texOverrides.bull) },
    tRing: { value: loadMark('ring.webp', texOverrides.ring) },
    uW: { value: new THREE.Vector4(0, 0, 0, 0) },
    uSheen: { value: 0 },
    uGold: { value: new THREE.Color(COIN_COLORS.gold) },
    uPale: { value: new THREE.Color(COIN_COLORS.paleGold) },
    uDeep: { value: new THREE.Color(COIN_COLORS.deepGold) },
    uShadow: { value: new THREE.Color(COIN_COLORS.shadowGold) }
  };

  const secretMaterial = new THREE.ShaderMaterial({
    uniforms: secretUniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tP;
      uniform sampler2D tSceptre;
      uniform sampler2D tMask;
      uniform sampler2D tBull;
      uniform sampler2D tRing;
      uniform vec4 uW;
      uniform float uSheen;
      uniform vec3 uGold;
      uniform vec3 uPale;
      uniform vec3 uDeep;
      uniform vec3 uShadow;
      varying vec2 vUv;

      float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
      float reliefOf(sampler2D t, vec2 uv) {
        float l = lum(texture2D(t, uv).rgb);
        return smoothstep(0.03, 0.45, l);
      }
      float embossOf(sampler2D t, vec2 uv) {
        float l0 = lum(texture2D(t, uv).rgb);
        float l1 = lum(texture2D(t, uv + vec2(-0.0045, 0.0045)).rgb);
        return clamp((l0 - l1) * 2.4, -0.35, 1.0);
      }
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        // The reverse is viewed from behind the disc: un-mirror x so the
        // marks read correctly to the viewer of the back face.
        vec2 uv = vec2(1.0 - vUv.x, vUv.y);
        vec2 c = uv - 0.5;
        float r = length(c) * 2.0;

        // Base gold: warm centre, deep edge, fine circular brushing + grain.
        vec3 col = mix(uGold * 0.92, uDeep, smoothstep(0.05, 1.05, r));
        col = mix(col, uShadow, smoothstep(0.86, 1.0, r) * 0.55);
        col *= 1.0 + 0.028 * sin(r * 150.0) + (hash(floor(uv * 900.0)) - 0.5) * 0.03;
        // A quiet engraved double ring near the rim.
        float groove = smoothstep(0.012, 0.0, abs(r - 0.865)) + smoothstep(0.010, 0.0, abs(r - 0.905));
        col *= 1.0 - groove * 0.13;

        float fall = smoothstep(1.03, 0.80, r);
        float maxW = max(max(uW.x, uW.y), max(uW.z, uW.w));

        float relS = reliefOf(tSceptre, uv);
        float relM = reliefOf(tMask, uv);
        float relB = reliefOf(tBull, uv);
        float relR = reliefOf(tRing, uv);
        float embS = embossOf(tSceptre, uv);
        float embM = embossOf(tMask, uv);
        float embB = embossOf(tBull, uv);
        float embR = embossOf(tRing, uv);

        vec3 reveal = vec3(0.0);
        reveal += uW.x * (relS * uPale * 0.92 + embS * uPale * 0.34);
        reveal += uW.y * (relM * uPale * 0.92 + embM * uPale * 0.34);
        reveal += uW.z * (relB * uPale * 0.92 + embB * uPale * 0.34);
        reveal += uW.w * (relR * uPale * 0.92 + embR * uPale * 0.34);
        col += reveal * fall;

        // The name-sign never leaves the metal: the Fortress P emblem
        // relief at the centre of the reverse. Ghosted (0.36) while the
        // side hides its secrets; as a mark rises around it the P eases
        // down to a 0.25 floor — dimmer, never gone, at any angle.
        // (x flipped vs the marks: the emblem must read true, not mirrored.)
        vec2 uvP = (vec2(1.0 - uv.x, uv.y) - 0.5) * 1.9 + 0.5;
        float relP = reliefOf(tP, uvP);
        float embP = embossOf(tP, uvP);
        float pWeight = mix(0.36, 0.25, maxW);
        col += (relP * uPale * 0.95 + embP * uPale * 0.38) * pWeight * fall;

        // Travelling sheen, stronger while a secret is showing.
        float band = pow(max(0.0, 1.0 - abs((uv.x * 0.75 + uv.y * 0.55) - (0.62 + uSheen * 0.55))), 5.0);
        col += band * (0.045 + 0.15 * maxW) * uPale;

        // Seat the face into the rim.
        col *= 1.0 - 0.32 * smoothstep(0.93, 1.0, r);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });

  const secretFace = new THREE.Mesh(new THREE.CircleGeometry(1.94, 96), secretMaterial);
  secretFace.rotation.y = Math.PI;
  secretFace.position.z = -0.186;
  spinner.add(secretFace);

  // The 47-bead ring frames the secret face, as on the front.
  const back = new THREE.Group();
  for (let i = 0; i < 47; i++) {
    const angle = i / 47 * Math.PI * 2;
    const bead = new THREE.Mesh(beadGeometry, paleGold);
    bead.position.set(Math.cos(angle) * 1.76, Math.sin(angle) * 1.76, -0.225);
    back.add(bead);
  }
  spinner.add(back);

  // ---------- Coin Rush presence: ember light + salt-dust motes ------
  const ember = new THREE.PointLight(COIN_COLORS.gold, 1.6, 10, 2);
  ember.position.set(0, 0.4, 2.6);
  bobGroup.add(ember);

  const dustCanvas = document.createElement('canvas');
  dustCanvas.width = 64;
  dustCanvas.height = 64;
  const dustCtx = dustCanvas.getContext('2d');
  const dustGradient = dustCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  dustGradient.addColorStop(0, 'rgba(244,239,230,1)');
  dustGradient.addColorStop(0.22, 'rgba(244,239,230,0.85)');
  dustGradient.addColorStop(0.58, 'rgba(244,239,230,0.22)');
  dustGradient.addColorStop(1, 'rgba(244,239,230,0)');
  dustCtx.fillStyle = dustGradient;
  dustCtx.fillRect(0, 0, 64, 64);
  const dustTexture = new THREE.CanvasTexture(dustCanvas);

  let seed = 47;
  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const moteCount = 90; // sparse ring, not the gate's full dust field
  const motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    const a = random() * Math.PI * 2;
    const radius = 2.45 + random() * 0.75;
    motePositions[i * 3] = Math.cos(a) * radius;
    motePositions[i * 3 + 1] = (random() - 0.5) * 1.15;
    motePositions[i * 3 + 2] = Math.sin(a) * radius;
  }
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(
    moteGeometry,
    new THREE.PointsMaterial({
      color: COIN_COLORS.salt,
      size: 0.055,
      map: dustTexture,
      transparent: true,
      opacity: 0.5,
      alphaTest: 0.01,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    })
  );
  group.add(motes);

  // ---------- state machine ----------
  let rotY = 0;
  let rotX = REST_TILT_X;
  let rotYTarget = 0;
  let rotXTarget = REST_TILT_X;
  let flip = null; // { from, to, start }
  let external = false;
  let dragging = false;
  let clock = 0;
  let sheenFace = 1;
  let caption = 'THE FORTRESS P';
  let thetaDeg = -180;
  let weights = [0, 0, 0, 0];
  let abort = null; // AbortController for pointer listeners

  function refreshDerived() {
    thetaDeg = wrapDeg(THREE.MathUtils.radToDeg(rotY) - 180);
    weights = computeWeights(thetaDeg);
    const cosY = Math.cos(rotY);
    if (cosY < -0.2) {
      secretUniforms.uW.value.set(weights[0], weights[1], weights[2], weights[3]);
    } else {
      secretUniforms.uW.value.set(0, 0, 0, 0);
    }
    secretUniforms.uSheen.value = THREE.MathUtils.clamp(thetaDeg / 60, -1, 1);
    if (cosY > 0.35) {
      caption = 'THE FORTRESS P';
    } else if (cosY < -0.35) {
      let best = 0;
      let bestW = 0;
      for (let i = 0; i < 4; i++) {
        if (weights[i] > bestW) { bestW = weights[i]; best = i; }
      }
      caption = bestW > 0.38 ? COIN_MARK_NAMES[best] : 'THE SECRET SIDE';
    }
  }
  refreshDerived();

  const api = {
    // Per-frame drive. dt = seconds since last frame, t = elapsed seconds.
    update(dt, t) {
      const step = THREE.MathUtils.clamp(dt ?? 0, 0, 0.05);
      clock = t ?? clock + step;

      if (flip) {
        const p = THREE.MathUtils.clamp((clock - flip.start) / FLIP_SECONDS, 0, 1);
        rotY = THREE.MathUtils.lerp(flip.from, flip.to, smootherstep(p));
        if (p >= 1) {
          rotY = flip.to;
          rotYTarget = flip.to;
          flip = null;
        }
      } else {
        const blend = 1 - Math.exp(-step * 5.5);
        rotY += (rotYTarget - rotY) * blend;
        rotX += (rotXTarget - rotX) * blend;
      }

      // Idle sway/bob (Coin Rush presence): rotation +-0.04 rad, y +-0.05.
      const swayY = idleEnabled && !dragging ? Math.sin(clock * 0.45) * 0.04 : 0;
      const swayZ = idleEnabled && !dragging ? Math.sin(clock * 0.6) * 0.016 : 0;
      spinner.rotation.y = rotY + swayY;
      spinner.rotation.x = rotX;
      spinner.rotation.z = swayZ;
      bobGroup.position.y = idleEnabled ? Math.sin(clock * 0.85) * 0.05 : 0;

      ember.intensity = 1.6 + Math.sin(clock * 1.7) * 0.25;
      motes.rotation.y = clock * 0.05;
      motes.position.y = Math.sin(clock * 0.3) * 0.04;

      // Sheen sweep across the P front: a ~2.8s pass every ~9s, only
      // while the front actually faces the viewer.
      const cycle = clock % 9;
      sheenUniforms.uSweep.value = cycle < 2.8
        ? -1.7 + 3.4 * smootherstep(cycle / 2.8)
        : 4;
      const faceTarget = THREE.MathUtils.clamp(Math.cos(rotY), 0, 1);
      sheenFace += (faceTarget - sheenFace) * (1 - Math.exp(-step * 6));
      sheenUniforms.uFace.value = sheenFace;

      refreshDerived();
    },

    // External driver (gyro / town interaction): theta is the signed
    // angle between the reverse normal and the camera, in degrees.
    // -42 sceptre · -14 mask · 0 plain · +14 bull · +42 ring-idol.
    setReverseTilt(nextThetaDeg) {
      flip = null;
      external = true;
      const clamped = THREE.MathUtils.clamp(nextThetaDeg, -60, 60);
      rotYTarget = Math.PI + THREE.MathUtils.degToRad(clamped);
      rotXTarget = REST_TILT_X;
    },

    // Eased pi flip over ~1.5s. Calls made mid-flip are ignored.
    flip() {
      if (flip) return;
      external = false;
      flip = { from: rotY, to: rotY + Math.PI, start: clock };
    },

    // Ease back to the home pose: the Fortress P front.
    homePose() {
      flip = null;
      external = false;
      rotYTarget = Math.round(rotYTarget / (Math.PI * 2)) * Math.PI * 2;
      rotXTarget = REST_TILT_X;
    },

    // Snap instantly to a named pose (COIN_POSES key). Proof pages use
    // this for ?pose= freezes; the town normally won't.
    setPose(name) {
      if (!Object.prototype.hasOwnProperty.call(COIN_POSES, name)) return false;
      flip = null;
      external = false;
      rotY = rotYTarget = COIN_POSES[name];
      rotX = rotXTarget = REST_TILT_X;
      refreshDerived();
      return true;
    },

    // Pointer drag tilts the coin — the Secret Side page's interaction
    // model (dx -> rotY, dy -> rotX clamped +-0.55, double-click flips,
    // touch gestures claimed so Safari can't steal the drag).
    setInteractive(canvas, on) {
      if (abort) { abort.abort(); abort = null; dragging = false; }
      if (!on || !canvas) return;
      abort = new AbortController();
      const signal = abort.signal;
      let lastX = 0;
      let lastY = 0;
      canvas.addEventListener('pointerdown', event => {
        if (flip) return;
        event.preventDefault();
        external = false;
        dragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
        try { canvas.setPointerCapture(event.pointerId); } catch (err) { /* nicety */ }
      }, { signal });
      canvas.addEventListener('pointermove', event => {
        if (!dragging) return;
        event.preventDefault();
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;
        rotYTarget += dx * 0.0085;
        rotXTarget = THREE.MathUtils.clamp(rotXTarget + dy * 0.005, -0.55, 0.55);
      }, { signal });
      const endDrag = () => { dragging = false; };
      canvas.addEventListener('pointerup', endDrag, { signal });
      canvas.addEventListener('pointercancel', endDrag, { signal });
      canvas.addEventListener('dblclick', () => { api.flip(); }, { signal });
      canvas.addEventListener('touchstart', event => { event.preventDefault(); }, { signal, passive: false });
      canvas.addEventListener('touchmove', event => { event.preventDefault(); }, { signal, passive: false });
    },

    getState() {
      return {
        rotY,
        rotX,
        thetaDeg,
        weights: [...weights],
        side: Math.cos(rotY) > 0.35 ? 'front' : Math.cos(rotY) < -0.35 ? 'reverse' : 'edge',
        caption,
        flipping: flip !== null,
        external,
        dragging
      };
    },

    dispose() {
      if (abort) { abort.abort(); abort = null; }
      group.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(mat => {
            Object.values(mat.uniforms ?? {}).forEach(u => {
              if (u.value && u.value.isTexture) u.value.dispose();
            });
            if (mat.map) mat.map.dispose();
            mat.dispose();
          });
        }
      });
    }
  };

  return { group, api };
}
