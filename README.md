# Meteora x Solana ID: Grand Draw Verifier

The Meteora campaign season 2 (campaign.ecosystemcall.com/meteora) ends
with a provably-fair draw: **one winner, $1,500 USDC.**

## How the draw works

1. **The entries froze when the campaign closed** (2026-09-03, 14:00 UTC).
   `entries.json` holds the full pool: one row per eligible wallet (active
   liquidity at close + at least one unspent ticket) with its ticket count.
   Every unspent ticket is one entry.
2. **The randomness comes from Solana itself.** Before the draw we
   committed to mainnet slot **444,262,900** (first block at or after it,
   should the slot be skipped). Nobody can know or influence a future
   blockhash.
3. **The winner is a pure function of that blockhash:** seed = first 4
   bytes of SHA-256(blockhash), fed into a mulberry32 PRNG, one
   ticket-weighted pick. The campaign page runs the same computation live
   in your browser.

## Verify it yourself

Requires Node 18+.

```bash
node draw.js
```

fetches the committed block from two independent mainnet RPCs
(genesis-hash-checked) and prints the winner. Run it anywhere, any time
after the block is final (Friday 2026-09-04 ~14:00 UTC): the result is
always the same.

To audit a specific hash: `node draw.js <blockhash>`.

## Season 1

The season 1 draw (August 2026, four winners, $1,000 USDC each) is
preserved in this repository's git history.
