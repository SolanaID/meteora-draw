#!/usr/bin/env node
// Meteora × Solana ID grand-draw verifier.
//
//   node draw.js            → fetches the committed block from Solana mainnet
//                             and prints the winner
//   node draw.js <blockhash>→ recomputes winners from a given hash (audit)
//
// The winner derives purely from the blockhash of the committed slot
// over the frozen entries in entries.json. Same inputs, same winner, for
// everyone. Algorithm identical to the campaign backend
// (mulberry32 seeded with the first 4 bytes of SHA-256(blockhash),
// ticket-weighted pick without replacement) and to the on-page runner at
// https://campaign.ecosystemcall.com/meteora.

import { createHash } from "crypto";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const DATA = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "entries.json"), "utf8"),
);
const COMMITTED_SLOT = DATA.committed_slot; // committed before campaign close
const MAINNET_GENESIS_HASH = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
];
const MAX_SLOT_WALK = 120;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function deriveSeed32(seed) {
  return createHash("sha256").update(seed).digest().readUInt32BE(0);
}
function pickWeighted(entries, rng) {
  const total = entries.reduce((s, e) => s + Math.max(0, e.tickets), 0);
  if (total <= 0) return null;
  let target = rng() * total;
  for (const e of entries) {
    const w = Math.max(0, e.tickets);
    if (target < w) return e.wallet;
    target -= w;
  }
  return entries[entries.length - 1].wallet;
}
function pickWeightedWithoutReplacement(entries, k, rng) {
  const remaining = entries.map((e) => ({ ...e }));
  const winners = [];
  for (let i = 0; i < k; i++) {
    const w = pickWeighted(remaining, rng);
    if (!w) break;
    winners.push(w);
    remaining.splice(remaining.findIndex((e) => e.wallet === w), 1);
  }
  return winners;
}

async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  return res.json();
}

async function fetchDrawBlock() {
  let lastError = "all RPC endpoints failed";
  for (const url of RPC_ENDPOINTS) {
    try {
      const gen = await rpc(url, "getGenesisHash", []);
      if (gen.result !== MAINNET_GENESIS_HASH) throw new Error(`${url} is not Solana mainnet`);
      const tip = await rpc(url, "getSlot", [{ commitment: "finalized" }]);
      if (tip.result < COMMITTED_SLOT) {
        throw new Error(
          `draw slot not final yet (chain at ${tip.result}, committed ${COMMITTED_SLOT})`,
        );
      }
      for (let slot = COMMITTED_SLOT; slot < COMMITTED_SLOT + MAX_SLOT_WALK; slot++) {
        const block = await rpc(url, "getBlock", [
          slot,
          { transactionDetails: "none", rewards: false, maxSupportedTransactionVersion: 0 },
        ]);
        if (block?.result?.blockhash) return { slot, blockhash: block.result.blockhash, rpc: url };
      }
      throw new Error("no block found near the committed slot");
    } catch (e) {
      lastError = e.message;
    }
  }
  throw new Error(lastError);
}

const arg = process.argv[2];
let slot = COMMITTED_SLOT;
let blockhash = arg;
let source = "manual argument";
if (!blockhash) {
  try {
    const found = await fetchDrawBlock();
    slot = found.slot;
    blockhash = found.blockhash;
    source = found.rpc;
  } catch (e) {
    console.log(`Not yet: ${e.message}`);
    console.log("The committed block lands Friday 2026-09-04 around 14:00 UTC. Run this again after that.");
    process.exit(0);
  }
}

const winners = pickWeightedWithoutReplacement(DATA.entries, DATA.winners, mulberry32(deriveSeed32(blockhash)));
console.log(`entries : ${DATA.total_wallets} wallets, ${DATA.total_tickets} tickets (frozen at campaign close)`);
console.log(`block   : slot ${slot} (committed ${COMMITTED_SLOT})`);
console.log(`hash    : ${blockhash}`);
console.log(`source  : ${source}`);
console.log(`\nWinners (${DATA.winners} × $${DATA.prize_usd_each} USDC):`);
winners.forEach((w, i) => {
  const t = DATA.entries.find((e) => e.wallet === w).tickets;
  console.log(`  ${i + 1}. ${w}  (${t} tickets)`);
});
