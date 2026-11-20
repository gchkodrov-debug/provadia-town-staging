// PROVADIA — RECORD & MARKET layer (browser module)
// Three jobs, all receipted:
//  1. PRICE FACE — live figures from Dexscreener only; renders ONLY fields
//     the response actually carries. No placeholder numbers, ever.
//  2. VERIFIER — fetches daybook.json, recomputes every hash with
//     crypto.subtle in the visitor's own browser, renders the verdict.
//  3. ANCHOR DISPLAY — shows today's root + the exact Solana Memo payload.
//     No tx hash or signature is ever shown unless one exists. None does yet.
// No audio. No projections. No promises.

const CA = "9UE6NStA9pRZ5xagrK1FNy3vybmQVL2VaKB7BNpvpump";
const DEX_URL =
  "https://api.dexscreener.com/latest/dex/pairs/solana/2fvtfwcco71j8xepws7yrez3569u2gxu4fyhe2h8oxdy";
const DEX_TOKEN_URL = `https://api.dexscreener.com/latest/dex/tokens/${CA}`;
const PAIR_ADDRESS = "2fvtfwcco71j8xepws7yrez3569u2gxu4fyhe2h8oxdy";
const REFRESH_MS = 60_000;

const $ = (sel, root = document) => root.querySelector(sel);
const clock = (d = new Date()) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------------- 1 · PRICE FACE ---------------- */

const priceState = { lastGood: null, lastGoodAt: null };

function fmtUsd(v, digits = 2) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtPrice(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  // Small prices need their real precision, not a rounded zero.
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 10 });
}
function fmtNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString("en-US");
}

// Build figure rows ONLY from fields present in the response.
function rowsFromPair(pair) {
  if (!pair) return [];
  const rows = [];
  const price = fmtPrice(pair.priceUsd);
  if (price) rows.push(["Price", price]);
  const mc = fmtUsd(pair.marketCap ?? pair.fdv);
  if (mc) rows.push(["Market cap", mc]);
  const liq = pair.liquidity ? fmtUsd(pair.liquidity.usd) : null;
  if (liq) rows.push(["Liquidity", liq]);
  const vol = pair.volume ? fmtUsd(pair.volume.h24) : null;
  if (vol) rows.push(["Volume · 24h", vol]);
  if (pair.txns && pair.txns.h24) {
    const buys = fmtNum(pair.txns.h24.buys);
    const sells = fmtNum(pair.txns.h24.sells);
    if (buys !== null && sells !== null) rows.push(["Trades · 24h", `${buys} buys · ${sells} sells`]);
  }
  return rows;
}

function renderPrice(rows, sourceLabel) {
  const grid = $("[data-price-grid]");
  const src = $("[data-price-source]");
  if (!grid) return;
  grid.innerHTML = "";
  if (!rows.length) {
    const p = document.createElement("p");
    p.className = "rec-note";
    p.textContent = "reaching for its source…";
    grid.appendChild(p);
  } else {
    for (const [k, v] of rows) {
      const row = document.createElement("div");
      row.className = "rec-row";
      const ks = document.createElement("span"); ks.className = "rec-k"; ks.textContent = k;
      const vs = document.createElement("span"); vs.className = "rec-v"; vs.textContent = v;
      row.append(ks, vs);
      grid.appendChild(row);
    }
  }
  if (src) src.textContent = sourceLabel;
}

async function fetchPrice() {
  try {
    const res = await fetch(DEX_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    let pair = data.pair || (Array.isArray(data.pairs) ? data.pairs[0] : null);
    if (!pair) {
      // Fallback (coordinator, 2026-11-20): the pair endpoint currently
      // reports no pair for this coin. Ask the token endpoint instead and
      // take the recorded pair if it is listed, else the deepest-liquidity
      // pair the source reports. Still source data only — never invented.
      const tRes = await fetch(DEX_TOKEN_URL, { cache: "no-store" });
      if (tRes.ok) {
        const tData = await tRes.json();
        const pairs = Array.isArray(tData.pairs) ? tData.pairs : [];
        pair =
          pairs.find((p) => p.pairAddress === PAIR_ADDRESS) ||
          pairs
            .slice()
            .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0] ||
          null;
      }
    }
    const rows = rowsFromPair(pair);
    if (!rows.length) throw new Error("empty pair");
    priceState.lastGood = rows;
    priceState.lastGoodAt = new Date();
    renderPrice(rows, `Source: Dexscreener · fetched ${clock(priceState.lastGoodAt)}`);
  } catch {
    if (priceState.lastGood) {
      renderPrice(priceState.lastGood, `Source: Dexscreener · last receipted ${clock(priceState.lastGoodAt)}`);
    } else {
      renderPrice([], "Source: Dexscreener · reaching for its source…");
    }
  }
}

function startPriceFace() {
  if (!$("[data-price-grid]")) return;
  renderPrice([], "Source: Dexscreener · reaching for its source…");
  fetchPrice();
  setInterval(fetchPrice, REFRESH_MS);
}

/* ---------------- 2 · VERIFIER + 3 · ANCHOR ---------------- */

async function verifyDaybook() {
  const verdictEl = $("[data-verify-verdict]");
  const listEl = $("[data-daybook-list]");
  const rootEl = $("[data-anchor-root]");
  const payloadEl = $("[data-anchor-payload]");
  if (!verdictEl) return;
  verdictEl.textContent = "Recomputing every entry in your browser…";
  verdictEl.dataset.state = "working";
  try {
    const [bookRes, rootRes] = await Promise.all([
      fetch("daybook.json", { cache: "no-store" }),
      fetch("root.json", { cache: "no-store" }),
    ]);
    if (!bookRes.ok) throw new Error("daybook fetch failed");
    const entries = await bookRes.json();
    const rootDoc = rootRes.ok ? await rootRes.json() : null;

    let prev = "0".repeat(64);
    let ok = Array.isArray(entries) && entries.length > 0;
    if (listEl) listEl.innerHTML = "";
    for (const e of entries) {
      const recomputed = await sha256Hex(`${e.prev}|${e.date}|${e.title}|${e.text}`);
      const entryOk = e.prev === prev && recomputed === e.hash;
      if (!entryOk) ok = false;
      prev = e.hash;
      if (listEl) {
        const li = document.createElement("li");
        li.className = "rec-entry";
        const head = document.createElement("div");
        head.className = "rec-entry-head";
        const t = document.createElement("span");
        t.className = "rec-entry-title";
        t.textContent = `#${e.n} · ${e.title}`;
        const d = document.createElement("span");
        d.className = "rec-entry-date";
        d.textContent = e.date;
        head.append(t, d);
        const body = document.createElement("p");
        body.className = "rec-entry-text";
        body.textContent = e.text;
        const hash = document.createElement("code");
        hash.className = "rec-hash";
        hash.textContent = `hash ${e.hash} ${entryOk ? "✓ recomputed match" : "✗ MISMATCH"}`;
        li.append(head, body, hash);
        listEl.appendChild(li);
      }
    }

    // Root check: SHA-256 of the last entry's hash must equal root.json.
    let rootOk = false;
    let root = "";
    let rootDate = "2026-11-20";
    if (ok && rootDoc && rootDoc.root) {
      root = rootDoc.root;
      rootDate = rootDoc.date || rootDate;
      rootOk = (await sha256Hex(prev)) === rootDoc.root;
    }

    if (ok && rootOk) {
      verdictEl.textContent = "CHAIN INTACT — every entry recomputed and matched in your browser";
      verdictEl.dataset.state = "ok";
    } else if (ok && !rootDoc) {
      verdictEl.textContent = "CHAIN INTACT — every entry recomputed and matched in your browser (root file not loaded)";
      verdictEl.dataset.state = "ok";
    } else {
      verdictEl.textContent = "CHAIN BROKEN — an entry did not recompute. Do not trust this copy of the record.";
      verdictEl.dataset.state = "fail";
    }

    if (rootEl && root) rootEl.textContent = root;
    if (payloadEl && root) {
      payloadEl.textContent = `PROVADIA DAYBOOK ROOT · ${rootDate} · ${root}`;
    }
  } catch {
    verdictEl.textContent = "The record could not be loaded, so nothing was verified. No verdict is shown rather than a false one.";
    verdictEl.dataset.state = "fail";
  }
}

/* ---------------- boot ---------------- */

function boot() {
  startPriceFace();
  verifyDaybook();
}
// Works both as a static <script> and when injected after DOMContentLoaded
// (the proof page mounts the fragments first, then loads this module).
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

export { CA, DEX_URL };
