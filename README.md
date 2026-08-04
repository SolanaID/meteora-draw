# Meteora × Solana ID — Grand Draw Verifier

The $5,000 Meteora campaign (campaign.solana.id/meteora) ends with a
provably-fair draw: **four winners, $1,000 USDC each.**

## How the draw works

1. **The entries froze when the campaign closed** (2026-08-03, 12:00 UTC).
   `entries.json` holds the full pool: one row per eligible wallet (active
   liquidity at close + at least one unspent ticket) with its ticket count.
   Every unspent ticket is one entry.
2. **The randomness comes from Solana itself.** Before the campaign even
   closed we committed to mainnet slot **437,169,000** (first block at or
   after it, should the slot be skipped). Nobody can know or influence a
   future blockhash.
3. **Winners are a pure function of that blockhash:** seed = first 4 bytes
   of SHA-256(blockhash), fed into a mulberry32 PRNG, four ticket-weighted
   picks without replacement (max one prize per wallet). The campaign
   backend records the same computation, and the campaign page runs it live
   in your browser.

## Verify it yourself

Requires Node 18+.

```bash
node draw.js
```

fetches the committed block from two independent mainnet RPCs
(genesis-hash-checked) and prints the four winners. Run it anywhere, any
time after the block is final (Tuesday 2026-08-04 ~11:42 UTC): the result
is always the same.

To audit a specific hash: `node draw.js <blockhash>`.
