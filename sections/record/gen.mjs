// PROVADIA — Day-Book generator (the record's tooling)
// Computes the signed, hash-chained public record.
// hash = SHA-256 hex of: prev + "|" + date + "|" + title + "|" + text
// genesis prev = 64 zero characters.
// Node built-in crypto only. Run: node gen.mjs
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const GENESIS_PREV = "0".repeat(64);
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

// Genesis entries — receipted facts only. Do not edit a published entry:
// changing any byte breaks the chain, by design. Append new entries instead.
const raw = [
  {
    n: 1,
    date: "2026-11-18",
    title: "The coin is struck",
    text: "PROVADIA launches on pump.fun — a fair launch, no presale, no team allocation. Contract: 9UE6NStA9pRZ5xagrK1FNy3vybmQVL2VaKB7BNpvpump. Supply 1,000,000,000, fixed.",
  },
  {
    n: 2,
    date: "2026-11-18",
    title: "The founder's buy, in the open",
    text: "The founder buys 0.1 SOL of his own coin — about 0.35% of supply — disclosed in the launch receipts before any story was told.",
  },
  {
    n: 3,
    date: "2026-11-18",
    title: "The Golden Wall Covenant is signed",
    text: "20% of creator fees buy physical 1g gold bars into a named third-party vault, forever. The counter opens at 0 / 47. The Wall belongs to no one.",
  },
  {
    n: 4,
    date: "2026-11-19",
    title: "The town gets its name in the world",
    text: "provadiacoin.com is registered and the town site stands live at its own address.",
  },
  {
    n: 5,
    date: "2026-11-20",
    title: "The town is rebuilt as one world",
    text: "Four engines and the Streets are fused into one body on provadiacoin.com — one DNA, front to back.",
  },
];

let prev = GENESIS_PREV;
const entries = raw.map((e) => {
  const hash = sha256(`${prev}|${e.date}|${e.title}|${e.text}`);
  const entry = { n: e.n, date: e.date, title: e.title, text: e.text, prev, hash };
  prev = hash;
  return entry;
});

const last = entries[entries.length - 1];
const root = sha256(last.hash);
const rootDoc = { date: "2026-11-20", root, entries: entries.length };

writeFileSync(`${here}/daybook.json`, JSON.stringify(entries, null, 2) + "\n");
writeFileSync(`${here}/root.json`, JSON.stringify(rootDoc, null, 2) + "\n");

console.log(`daybook.json — ${entries.length} entries chained`);
for (const e of entries) console.log(`  #${e.n} ${e.date} ${e.hash.slice(0, 16)}…`);
console.log(`root.json — root ${root}`);
