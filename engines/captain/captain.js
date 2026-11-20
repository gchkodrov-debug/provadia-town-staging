/**
 * captain.js — The Captain at the Front Door · PROVADIA town engine
 * ------------------------------------------------------------------
 * Plain ES module, no framework. One mount call builds the whole chamber:
 *
 *   - THE FACE: a dedicated canvas (~440×540) rendering THREE.Points sampled
 *     from marks/mask.webp — the clay mask of the age, gold plates on eyes
 *     and mouth. Points are coloured by luminance through the gold ramp
 *     (#3D2A08 → #C9A227 → #FFEFC1) and pushed toward the visitor by
 *     luminance, so the bright gold pops out of the dark. Slow breathing,
 *     gentle pointer parallax. Golden, and never removed: if WebGL or the
 *     image fails, the mask itself is shown as a still image instead.
 *
 *   - THE GREETING + THE HONESTY SENTENCE (verbatim, by law).
 *
 *   - THE TALES: chips → panel. The Receipt Law governs his mouth — these
 *     five tales are the whole bank. PROVEN tales are told as fact. The one
 *     INTERPRETED tale is framed as attributed belief, never as fact.
 *     Nothing else may be claimed, and this module claims nothing else.
 *
 *   - THE LIVE SEAT: wiring only. The page head carries
 *       <meta name="captain-api" content="">
 *     Empty (this build) or unhealthy → the seat shows its honest state and
 *     the input stays DISABLED. No fake chat, no simulated reply, ever.
 *     Healthy → input enables; submit POSTs {api}/chat {message} and renders
 *     the returned {reply} under the Captain's nameplate. One probe on
 *     mount, no retry spam. See MODULE.md for the switch-on contract.
 *
 * Usage:
 *   import { mountCaptain } from './captain.js';
 *   const captain = mountCaptain(document.querySelector('[data-captain-root]'));
 *   // captain.destroy() tears the chamber down.
 *
 * Or simply place <div data-captain-root></div> in the page — the module
 * auto-mounts it on DOMContentLoaded.
 */

import * as THREE from '../../lib/three.module.min.js';

/* ------------------------------------------------------------------ */
/* THE NAME IN THE WORLD — SOLNIK (proposed by the captain; founder's  */
/* ear pending, George 2026-11-20 13:00 CT). ONE constant: rename here */
/* and the whole seat follows. The solniks were the salt-makers of     */
/* Provadia\u2013Solnitsata \u2014 the town's founding craft, who boiled the    */
/* brine and baked salt into bricks. He is the last of them, keeping   */
/* the works, the Wall, and the record. The mascot SOL is the silent   */
/* brick and never speaks \u2014 Solnik is the voice.                     */
/* ------------------------------------------------------------------ */

const CAPTAIN_NAME = 'SOLNIK';
const CAPTAIN_DISPLAY = 'Solnik';
const CAPTAIN_ROLE = 'Keeper of the Wall';

/* ------------------------------------------------------------------ */
/* The bank — the only words the Captain may speak as his own.         */
/* ------------------------------------------------------------------ */

export const GREETING =
  'Hail, traveller, and welcome to Provadia — a town that was old when Rome was a pasture. ' +
  'I am ' + CAPTAIN_DISPLAY + ' \u2014 last of the solniks, the salt-makers who founded this town \u2014 keeper of its Wall and its book. ' +
  'Ask me of the gold, of the salt, of the graves by the sea — for what I tell thee, I can show thee. ' +
  'One claim, one Witness, or it never happened.';

export const HONESTY_SENTENCE =
  'PROVADIA is a place, not an investment. Holding it names you a Bricklayer in the town registry ' +
  'and gives you a vote on the Wall\u2019s fate — and nothing else: no redemption, no yield, no rights, ' +
  'no expected return.';

export const OFFLINE_STATE =
  CAPTAIN_DISPLAY + '\u2019s living voice is being wired to this seat. Until it speaks, his tales above are true, and told.';

export const RECEIPT_LINE = CAPTAIN_DISPLAY + ' speaks only what the record can witness.';

export const TALES = [
  {
    id: 'shoebox',
    title: 'THE SHOEBOX OF GOLD',
    kind: 'proven',
    text:
      'In October 1972, in Varna\u2019s western industrial zone, an excavator operator named Raycho Marinov ' +
      'struck something that glittered. He gathered it in a shoebox and carried it to the museum. He had found ' +
      'the oldest gold treasure on Earth — a cemetery of more than 300 graves, dug between about 4560 and ' +
      '4450 BC. The digging went on for nineteen years.',
  },
  {
    id: 'chief',
    title: 'THE GRAVE OF THE CHIEF',
    kind: 'proven',
    text:
      'One grave, dug in 1974, held a man of forty to fifty years, and with him over 990 objects of gold — a kilo ' +
      'and a half of it. Beads by the hundred, four great rings on his arms, a bow dressed in gold, and a sceptre: ' +
      'a polished stone axe on a gold-sheathed shaft. The museum calls him most likely a chief and a priest. His ' +
      'name is not written anywhere — his people had no writing. The sceptre was his name.',
  },
  {
    id: 'salt-town',
    title: 'THE TOWN OF SALT',
    kind: 'proven',
    text:
      'Forty kilometres inland stands Provadia-Solnitsata, where salt was made from about 5500 BC. They baked ' +
      'brine in thin-walled vessels until each load hardened — some twenty-five kilos at a time, later tons. And ' +
      'they guarded it: in the town\u2019s great age, 4700 to 4200 BC, it stood behind stone walls three metres ' +
      'thick, with bastions and a gate. Europe\u2019s first stone fortress — raised over salt.',
  },
  {
    id: 'faces',
    title: 'THE FACES OF THE AGE',
    kind: 'proven',
    text:
      'The age left no portraits — almost. In three graves with no bodies, clay masks were laid in the earth, ' +
      'with round gold plates for eyes, a gold plate for the mouth, and a diadem above. The only faces that ' +
      'world ever made of itself. You are looking at one now.',
  },
  {
    id: 'salt-money',
    title: 'WAS SALT MONEY?',
    kind: 'interpreted',
    text:
      'Here I tell thee what is BELIEVED, not what is proven. Professor Vasil Nikolov, who has dug the salt ' +
      'town since 2005, holds that the salt brick was money — that Provadia was Europe\u2019s first mint. He says ' +
      'it plainly himself: there is no direct proof of how the trade was done. No salt-money hoard has ever been ' +
      'found. The town grew rich beside the gold graves; that much the ground shows. The rest is the ' +
      'professor\u2019s reading — and in this town, we mark the difference.',
  },
];

/* ------------------------------------------------------------------ */
/* Palette (law)                                                       */
/* ------------------------------------------------------------------ */

const GOLD = '#C9A227';
const GOLD_PALE = '#FFEFC1';
const GOLD_DEEP = '#6B4A12';
const GOLD_DARK = '#3D2A08';
const FIELD = '#141210';
const SALT = '#F4EFE6';

/* ------------------------------------------------------------------ */
/* Styles — injected once, every class prefixed `cap-` so the module   */
/* can sit inside the town page without colliding with it.             */
/* ------------------------------------------------------------------ */

const STYLE_ID = 'captain-engine-styles';

const CSS = `
.cap-chamber{--cap-gold:${GOLD};--cap-pale:${GOLD_PALE};--cap-deep:${GOLD_DEEP};
 --cap-dark:${GOLD_DARK};--cap-field:${FIELD};--cap-salt:${SALT};
 background:var(--cap-field);color:var(--cap-salt);
 font-family:'Inter',system-ui,sans-serif;padding:clamp(20px,4vw,48px);
 border:1px solid rgba(201,162,39,.28);border-radius:18px;box-sizing:border-box}
.cap-chamber *{box-sizing:border-box}
.cap-top{display:grid;grid-template-columns:440px 1fr;gap:clamp(20px,3.5vw,44px);align-items:start}
@media (max-width:920px){.cap-top{grid-template-columns:1fr}.cap-face-wrap{margin:0 auto}}
.cap-face-wrap{width:min(440px,100%);text-align:center}
.cap-face-frame{position:relative;width:100%;aspect-ratio:440/540;border-radius:14px;overflow:hidden;
 background:radial-gradient(ellipse 90% 70% at 50% 42%,#241b0c 0%,#171208 55%,#100d08 100%);
 border:1px solid rgba(201,162,39,.35);box-shadow:0 0 0 1px rgba(0,0,0,.6),0 18px 50px rgba(0,0,0,.55),
 inset 0 0 80px rgba(0,0,0,.65)}
.cap-face-canvas{display:block;width:100%;height:100%}
.cap-face-img{display:block;width:100%;height:100%;object-fit:cover}
.cap-face-name{margin:14px 0 2px;font-family:'Cinzel',serif;font-size:15px;letter-spacing:.34em;color:var(--cap-gold)}
.cap-face-role{margin:0;font-size:12.5px;letter-spacing:.08em;color:rgba(244,239,230,.62)}
.cap-weather{margin:9px 0 0;font-family:'Cinzel',serif;font-size:10.5px;letter-spacing:.3em;color:rgba(201,162,39,.8)}
.cap-face-canvas,.cap-face-img{transition:filter 1.1s ease}
.cap-chamber.cap-guard .cap-weather{color:#ddd6c6}
.cap-chamber.cap-guard .cap-face-name{color:#ece5d3}
.cap-chamber.cap-guard .cap-face-canvas,.cap-chamber.cap-guard .cap-face-img{filter:saturate(.42) brightness(.74) contrast(1.14)}
.cap-chamber.cap-guard .cap-face-frame{border-color:rgba(221,214,198,.6);
 box-shadow:0 0 0 1px rgba(221,214,198,.28),0 18px 50px rgba(0,0,0,.7),inset 0 0 90px rgba(0,0,0,.8)}
.cap-eyebrow{margin:6px 0 10px;font-size:12px;letter-spacing:.32em;color:var(--cap-gold)}
.cap-title{margin:0 0 16px;font-family:'Cinzel',serif;font-weight:700;
 font-size:clamp(30px,4vw,44px);line-height:1.08;color:var(--cap-pale)}
.cap-greeting{margin:0;font-size:clamp(16.5px,1.6vw,19px);line-height:1.75;color:var(--cap-salt);max-width:34em}
.cap-honesty{margin-top:22px;padding:14px 16px;border-left:3px solid var(--cap-gold);
 background:rgba(201,162,39,.07);font-size:14px;line-height:1.65;color:var(--cap-pale);max-width:38em}
.cap-tales{margin-top:clamp(26px,4vw,44px);border-top:1px solid rgba(201,162,39,.22);padding-top:22px}
.cap-tales-h,.cap-seat-h{margin:0 0 6px;font-family:'Cinzel',serif;font-size:19px;letter-spacing:.12em;color:var(--cap-pale)}
.cap-tales-sub{margin:0 0 16px;font-size:13.5px;color:rgba(244,239,230,.6)}
.cap-chips{display:flex;flex-wrap:wrap;gap:9px}
.cap-chip{appearance:none;cursor:pointer;font-family:'Cinzel',serif;font-size:12.5px;letter-spacing:.1em;
 padding:9px 13px;border-radius:999px;border:1px solid rgba(201,162,39,.45);
 background:rgba(201,162,39,.05);color:var(--cap-salt);transition:background .18s,border-color .18s,color .18s}
.cap-chip:hover{border-color:var(--cap-gold);background:rgba(201,162,39,.14)}
.cap-chip:focus-visible{outline:2px solid var(--cap-pale);outline-offset:2px}
.cap-chip[aria-selected="true"]{background:var(--cap-gold);color:#1c1503;border-color:var(--cap-gold)}
.cap-chip .cap-badge{font-family:'Inter',sans-serif;font-size:9.5px;font-weight:700;letter-spacing:.14em;
 margin-left:8px;padding:2px 6px;border-radius:99px;border:1px solid currentColor;vertical-align:2px;opacity:.85}
.cap-panel{margin-top:16px;padding:20px 22px;border:1px solid rgba(201,162,39,.3);border-radius:12px;
 background:linear-gradient(180deg,rgba(201,162,39,.06),rgba(201,162,39,.015))}
.cap-panel-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px 14px;margin-bottom:10px}
.cap-panel-title{margin:0;font-family:'Cinzel',serif;font-size:17px;letter-spacing:.1em;color:var(--cap-pale)}
.cap-stamp{font-size:10.5px;font-weight:700;letter-spacing:.18em;padding:4px 9px;border-radius:4px}
.cap-stamp-proven{color:#141210;background:var(--cap-gold)}
.cap-stamp-interpreted{color:var(--cap-pale);background:transparent;border:1px solid var(--cap-gold)}
.cap-panel-text{margin:0;font-size:16px;line-height:1.8;max-width:62em}
.cap-panel-kind{margin:12px 0 0;font-size:12.5px;letter-spacing:.05em;color:rgba(244,239,230,.58);font-style:italic}
.cap-seat{margin-top:clamp(26px,4vw,44px);border-top:1px solid rgba(201,162,39,.22);padding-top:22px}
.cap-state{margin:0 0 14px;font-size:14.5px;line-height:1.65;color:var(--cap-pale)}
.cap-thread{display:flex;flex-direction:column;gap:12px;margin-bottom:10px}
.cap-thread:empty{margin-bottom:0}
.cap-msg{max-width:44em;padding:12px 15px;border-radius:10px;font-size:15px;line-height:1.7}
.cap-msg .cap-who{display:block;font-family:'Cinzel',serif;font-size:11px;letter-spacing:.22em;margin-bottom:5px}
.cap-msg-cap{background:rgba(201,162,39,.09);border:1px solid rgba(201,162,39,.3);align-self:flex-start}
.cap-msg-cap .cap-who{color:var(--cap-gold)}
.cap-msg-you{background:rgba(244,239,230,.06);border:1px solid rgba(244,239,230,.18);align-self:flex-end}
.cap-msg-you .cap-who{color:rgba(244,239,230,.65)}
.cap-msg-note{background:transparent;border:1px dashed rgba(201,162,39,.4);color:rgba(244,239,230,.75);
 font-size:13.5px;align-self:stretch;max-width:none}
.cap-receipt{margin:4px 0 14px;font-size:12px;letter-spacing:.06em;color:rgba(244,239,230,.55);font-style:italic}
.cap-form{display:flex;gap:10px}
.cap-input{flex:1;min-width:0;padding:13px 15px;border-radius:10px;border:1px solid rgba(201,162,39,.4);
 background:#1d1913;color:var(--cap-salt);font:inherit;font-size:15px}
.cap-input::placeholder{color:rgba(244,239,230,.38)}
.cap-input:disabled{opacity:.45;cursor:not-allowed}
.cap-input:focus-visible{outline:2px solid var(--cap-pale);outline-offset:1px}
.cap-send{appearance:none;padding:13px 22px;border-radius:10px;border:1px solid var(--cap-gold);
 background:var(--cap-gold);color:#1c1503;font-family:'Cinzel',serif;font-size:14px;letter-spacing:.12em;cursor:pointer}
.cap-send:disabled{opacity:.45;cursor:not-allowed}
.cap-send:focus-visible{outline:2px solid var(--cap-pale);outline-offset:2px}
.cap-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/* Small DOM helper — all spoken text goes through textContent,        */
/* never innerHTML, so nothing the seat receives can inject markup.    */
/* ------------------------------------------------------------------ */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/* ------------------------------------------------------------------ */
/* Gold ramp: luminance → #3D2A08 → #C9A227 → #FFEFC1                  */
/* ------------------------------------------------------------------ */

const RAMP_DARK = new THREE.Color(GOLD_DARK);
const RAMP_MID = new THREE.Color(GOLD);
const RAMP_PALE = new THREE.Color(GOLD_PALE);
const _c = new THREE.Color();

function goldRamp(t, out) {
  if (t < 0.5) out.copy(RAMP_DARK).lerp(RAMP_MID, t * 2);
  else out.copy(RAMP_MID).lerp(RAMP_PALE, (t - 0.5) * 2);
  return out;
}

/* Round bead sprite so points read as beads/dust, not squares. */
function beadTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

/* ------------------------------------------------------------------ */
/* THE FACE — THREE.Points sampled from the mask.                      */
/* ------------------------------------------------------------------ */

function createFace(canvas, maskUrl) {
  const state = {
    raf: 0, running: true, visible: true,
    targetRX: 0, targetRY: 0, curRX: 0, curRY: 0,
    renderer: null, dust: null, group: null,
  };
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fallbackStill() {
    // The face is never removed: if the living dust cannot rise, the mask
    // itself stands in the frame as a still image.
    const img = document.createElement('img');
    img.className = 'cap-face-img';
    img.src = maskUrl;
    img.alt = CAPTAIN_DISPLAY + ' — clay mask of the age, with gold plates for eyes and mouth';
    canvas.replaceWith(img);
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    fallbackStill();
    return { destroy() {} };
  }
  state.renderer = renderer;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 440 / 540, 0.1, 50);
  camera.position.set(0, 0, 5.4);

  const group = new THREE.Group();
  state.group = group;
  scene.add(group);

  function resize() {
    const w = canvas.clientWidth || 440;
    const h = canvas.clientHeight || 540;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // Ambient dust — a sparse, dim drift of motes around the face.
  {
    const N = 420;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * 2.1;
      pos[i * 3 + 1] = (Math.random() * 2 - 1) * 2.6;
      pos[i * 3 + 2] = -0.6 + Math.random() * 0.5;
      goldRamp(0.12 + Math.random() * 0.3, _c);
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.02, map: beadTexture(), vertexColors: true, transparent: true,
      opacity: 0.5, depthWrite: false, sizeAttenuation: true,
    });
    state.dust = new THREE.Points(geo, mat);
    scene.add(state.dust);
  }

  // Sample the mask into the face cloud.
  const img = new Image();
  img.decoding = 'async';
  img.addEventListener('error', fallbackStill);
  img.addEventListener('load', () => {
    try {
      const S = 230; // sample grid — ~24k beads survive the ground cut
      const off = document.createElement('canvas');
      off.width = off.height = S;
      const ctx = off.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, S, S);
      const data = ctx.getImageData(0, 0, S, S).data;

      const positions = [];
      const colors = [];
      const SPAN = 1.45; // half-extent of the face disc in world units
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const i = (y * S + x) * 4;
          const lum =
            (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
          if (lum < 0.08) continue; // the dark ground is not the face
          const nx = (x / (S - 1)) * 2 - 1;
          const ny = 1 - (y / (S - 1)) * 2;
          const r2 = nx * nx + ny * ny;
          // The source mask is a dim photograph; stretch its luminance so
          // the clay reads as mid gold and the gold plates reach pale gold.
          const t = Math.pow(Math.min(1, Math.max(0, (lum - 0.04) / 0.6)), 0.8);
          // Pop-out: brightness walks toward the visitor; a gentle spherical
          // bulge keeps the disc reading as a face, not a poster.
          const z = Math.pow(t, 1.3) * 0.95 + (1 - Math.min(r2, 1)) * 0.15;
          positions.push(
            nx * SPAN + (Math.random() - 0.5) * 0.008,
            ny * SPAN + (Math.random() - 0.5) * 0.008,
            z
          );
          goldRamp(t, _c);
          colors.push(_c.r, _c.g, _c.b);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.037, map: beadTexture(), vertexColors: true, transparent: true,
        opacity: 0.96, depthWrite: false, sizeAttenuation: true,
      });
      group.add(new THREE.Points(geo, mat));
    } catch (err) {
      fallbackStill();
    }
  });
  img.src = maskUrl;

  // Pointer parallax — the face turns toward the visitor, ±0.12 rad.
  const wrap = canvas.closest('.cap-face-frame') || canvas;
  function onPointer(e) {
    const r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    state.targetRY = Math.max(-1, Math.min(1, nx)) * 0.12;
    state.targetRX = Math.max(-1, Math.min(1, ny)) * 0.12;
  }
  function onLeave() { state.targetRX = 0; state.targetRY = 0; }
  if (!reduced) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('pointerleave', onLeave);
  }

  // Pause off-screen / hidden — the Captain does not burn the visitor's lamp.
  let observer = null;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => { state.visible = entries[0].isIntersecting; },
      { threshold: 0.02 }
    );
    observer.observe(canvas);
  }

  const clock = new THREE.Clock();
  function tick() {
    state.raf = requestAnimationFrame(tick);
    if (!state.running || !state.visible || document.hidden) return;
    const t = clock.getElapsedTime();
    if (!reduced) {
      // Breathing: scale 1 ± 0.008 on a 4-second breath.
      const b = 1 + 0.008 * Math.sin((t * Math.PI * 2) / 4);
      group.scale.set(b, b, b);
      state.curRX += (state.targetRX - state.curRX) * 0.045;
      state.curRY += (state.targetRY - state.curRY) * 0.045;
      group.rotation.x = state.curRX + Math.sin(t * 0.31) * 0.008;
      group.rotation.y = state.curRY + Math.sin(t * 0.23) * 0.01;
      if (state.dust) state.dust.rotation.z = t * 0.008;
    }
    renderer.render(scene, camera);
  }
  tick();

  return {
    destroy() {
      state.running = false;
      cancelAnimationFrame(state.raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('pointerleave', onLeave);
      if (observer) observer.disconnect();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      });
      renderer.dispose();
    },
  };
}

/* ------------------------------------------------------------------ */
/* THE LIVE SEAT — one probe on mount; honest states; no fake chat.    */
/* ------------------------------------------------------------------ */

function readApiBase(optionBase) {
  if (typeof optionBase === 'string') return optionBase.trim().replace(/\/+$/, '');
  const meta = document.querySelector('meta[name="captain-api"]');
  const content = meta ? (meta.getAttribute('content') || '') : '';
  return content.trim().replace(/\/+$/, '');
}

function wireSeat(refs, apiBase) {
  const { form, input, send, stateLine, thread } = refs;
  let live = false;
  let busy = false;

  function goOffline() {
    live = false;
    input.disabled = true;
    send.disabled = true;
    input.placeholder = CAPTAIN_DISPLAY + '\u2019s voice is not yet wired to this seat.';
    stateLine.textContent = OFFLINE_STATE;
  }

  function goLive() {
    live = true;
    input.disabled = false;
    send.disabled = false;
    input.placeholder = 'Ask ' + CAPTAIN_DISPLAY + '\u2026';
    stateLine.textContent =
      CAPTAIN_DISPLAY + ' is seated and listening. Ask \u2014 he answers only what the record can witness.';
  }

  function addMessage(kind, who, text) {
    const box = el('div', 'cap-msg ' + (kind === 'cap' ? 'cap-msg-cap' : kind === 'you' ? 'cap-msg-you' : 'cap-msg-note'));
    if (who) box.appendChild(el('span', 'cap-who', who));
    box.appendChild(document.createTextNode(text));
    thread.appendChild(box);
    if (typeof box.scrollIntoView === 'function') {
      box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    return box;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!live || busy) return;
    const message = input.value.trim();
    if (!message) return;
    addMessage('you', 'TRAVELLER', message);
    input.value = '';
    busy = true;
    input.disabled = true;
    send.disabled = true;
    try {
      const res = await fetch(apiBase + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error('chat ' + res.status);
      const data = await res.json();
      if (!data || typeof data.reply !== 'string') throw new Error('chat shape');
      addMessage('cap', CAPTAIN_NAME, data.reply);
      // The weather turns with his temper (George, 2026-11-20 12:59 CT):
      // the host names the mode; the seat makes it FELT — face cools,
      // frame hardens to iron, the weather line speaks. Host mode restores.
      if (data.mode === 'guard' || data.mode === 'host') {
        const chamber = thread.closest('.cap-chamber');
        if (chamber) {
          const guard = data.mode === 'guard';
          chamber.classList.toggle('cap-guard', guard);
          const w = chamber.querySelector('.cap-weather');
          if (w) w.textContent = guard ? 'THE GUARD IS UP' : 'THE GATE IS WARM';
        }
      }
    } catch (err) {
      addMessage('note', null,
        CAPTAIN_DISPLAY + '\u2019s voice faltered \u2014 the line to his seat is down. His tales above remain true, and told.');
    } finally {
      busy = false;
      if (live) { input.disabled = false; send.disabled = false; input.focus(); }
    }
  });

  if (!apiBase) {
    goOffline();
    return;
  }

  // Exactly one probe, 2.5s timeout, no retries.
  stateLine.textContent = 'Waking ' + CAPTAIN_DISPLAY + '\u2026';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 2500);
  fetch(apiBase + '/health', { method: 'GET', signal: ctl.signal })
    .then((res) => { if (res.ok) goLive(); else goOffline(); })
    .catch(() => goOffline())
    .finally(() => clearTimeout(timer));
}

/* ------------------------------------------------------------------ */
/* MOUNT — build the whole chamber inside `root`.                      */
/* ------------------------------------------------------------------ */

export function mountCaptain(root, options = {}) {
  if (!root) throw new Error('mountCaptain: a root element is required');
  if (root.dataset.captainMounted === '1') return root._captainHandle;
  ensureStyles();

  const maskUrl = options.maskUrl || new URL('./marks/mask.webp', import.meta.url).href;

  const chamber = el('section', 'cap-chamber');
  chamber.setAttribute('aria-label', CAPTAIN_DISPLAY + ' of Provadia');

  /* --- Top: face left, greeting + honesty right --- */
  const top = el('div', 'cap-top');

  const faceWrap = el('div', 'cap-face-wrap');
  const frame = el('div', 'cap-face-frame');
  const canvas = document.createElement('canvas');
  canvas.className = 'cap-face-canvas';
  canvas.width = 440;
  canvas.height = 540;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label',
    CAPTAIN_DISPLAY + '\u2019s face \u2014 a golden mask of beads and dust, after the clay masks of the age');
  frame.appendChild(canvas);
  faceWrap.appendChild(frame);
  faceWrap.appendChild(el('p', 'cap-face-name', CAPTAIN_NAME));
  faceWrap.appendChild(el('p', 'cap-face-role', CAPTAIN_ROLE));
  faceWrap.appendChild(el('p', 'cap-weather', 'THE GATE IS WARM'));
  top.appendChild(faceWrap);

  const intro = el('div', 'cap-intro');
  intro.appendChild(el('p', 'cap-eyebrow', 'PROVADIA · THE FRONT DOOR'));
  intro.appendChild(el('h2', 'cap-title', CAPTAIN_DISPLAY));
  intro.appendChild(el('p', 'cap-greeting', GREETING));
  intro.appendChild(el('p', 'cap-honesty', HONESTY_SENTENCE));
  top.appendChild(intro);
  chamber.appendChild(top);

  /* --- Tales: chips → panel --- */
  const talesBox = el('div', 'cap-tales');
  talesBox.appendChild(el('h3', 'cap-tales-h', 'Tales the Ground Can Witness'));
  talesBox.appendChild(el('p', 'cap-tales-sub',
    'Every tale below carries its Witness. What is proven is told as fact; what is believed is marked as belief.'));

  const chips = el('div', 'cap-chips');
  chips.setAttribute('role', 'tablist');
  chips.setAttribute('aria-label', CAPTAIN_DISPLAY + '\u2019s tales');
  const panel = el('article', 'cap-panel');
  const panelHead = el('div', 'cap-panel-head');
  const panelTitle = el('h4', 'cap-panel-title');
  const panelStamp = el('span', 'cap-stamp');
  panelHead.appendChild(panelTitle);
  panelHead.appendChild(panelStamp);
  const panelText = el('p', 'cap-panel-text');
  const panelKind = el('p', 'cap-panel-kind');
  panel.appendChild(panelHead);
  panel.appendChild(panelText);
  panel.appendChild(panelKind);

  const chipButtons = TALES.map((tale, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cap-chip';
    b.setAttribute('role', 'tab');
    b.dataset.taleId = tale.id;
    b.appendChild(document.createTextNode(tale.title));
    b.appendChild(el('span', 'cap-badge', tale.kind === 'proven' ? 'PROVEN' : 'BELIEVED'));
    b.addEventListener('click', () => selectTale(i));
    chips.appendChild(b);
    return b;
  });

  function selectTale(i) {
    const tale = TALES[i];
    chipButtons.forEach((b, j) => b.setAttribute('aria-selected', j === i ? 'true' : 'false'));
    panelTitle.textContent = tale.title;
    panelStamp.textContent = tale.kind === 'proven' ? 'WITNESSED — TOLD AS FACT' : 'BELIEVED — NOT PROVEN';
    panelStamp.className = 'cap-stamp ' + (tale.kind === 'proven' ? 'cap-stamp-proven' : 'cap-stamp-interpreted');
    panelText.textContent = tale.text;
    panelKind.textContent = tale.kind === 'proven'
      ? 'Told as fact — the record witnesses it.'
      : 'Told as belief — attributed to its reader, never as fact.';
  }
  selectTale(0);

  talesBox.appendChild(chips);
  talesBox.appendChild(panel);
  chamber.appendChild(talesBox);

  /* --- The seat --- */
  const seat = el('div', 'cap-seat');
  seat.appendChild(el('h3', 'cap-seat-h', CAPTAIN_DISPLAY + '\u2019s Seat'));
  const stateLine = el('p', 'cap-state', OFFLINE_STATE);
  stateLine.setAttribute('role', 'status');
  const thread = el('div', 'cap-thread');
  thread.setAttribute('aria-live', 'polite');
  thread.setAttribute('aria-label', 'Conversation with ' + CAPTAIN_DISPLAY);
  const receipt = el('p', 'cap-receipt', RECEIPT_LINE);
  const form = el('form', 'cap-form');
  const label = el('label', 'cap-sr', 'Ask ' + CAPTAIN_DISPLAY);
  label.htmlFor = 'cap-input-' + Math.random().toString(36).slice(2, 8);
  const input = document.createElement('input');
  input.className = 'cap-input';
  input.id = label.htmlFor;
  input.type = 'text';
  input.autocomplete = 'off';
  input.disabled = true;
  const send = el('button', 'cap-send', 'ASK');
  send.type = 'submit';
  send.disabled = true;
  form.appendChild(label);
  form.appendChild(input);
  form.appendChild(send);
  seat.appendChild(stateLine);
  seat.appendChild(thread);
  seat.appendChild(receipt);
  seat.appendChild(form);
  chamber.appendChild(seat);

  root.appendChild(chamber);
  root.dataset.captainMounted = '1';

  const face = createFace(canvas, maskUrl);
  wireSeat({ form, input, send, stateLine, thread }, readApiBase(options.apiBase));

  const handle = {
    root,
    destroy() {
      face.destroy();
      chamber.remove();
      delete root.dataset.captainMounted;
      root._captainHandle = null;
    },
  };
  root._captainHandle = handle;
  return handle;
}

/* Auto-mount any [data-captain-root] present in the page. */
if (typeof document !== 'undefined') {
  const auto = () => {
    document.querySelectorAll('[data-captain-root]').forEach((node) => {
      if (node.dataset.captainMounted !== '1') mountCaptain(node);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();
}
