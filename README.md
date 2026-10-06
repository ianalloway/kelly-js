# kelly-js

**The sports bettor's math toolkit.** Kelly Criterion, CLV, EV, bankroll stats, odds conversion — TypeScript, zero dependencies, tree-shakeable.

[![npm version](https://img.shields.io/npm/v/@ianalloway/kelly-js.svg)](https://www.npmjs.com/package/@ianalloway/kelly-js)
[![License: MIT](https://img.shields.io/npm/l/@ianalloway/kelly-js.svg)](https://github.com/ianalloway/kelly-js/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![CI](https://github.com/ianalloway/kelly-js/actions/workflows/ci.yml/badge.svg)](https://github.com/ianalloway/kelly-js/actions/workflows/ci.yml)
[![Vitest](https://img.shields.io/badge/tested%20with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

**npm:** [@ianalloway/kelly-js](https://www.npmjs.com/package/@ianalloway/kelly-js) · **repo:** [github.com/ianalloway/kelly-js](https://github.com/ianalloway/kelly-js)

```ts
import { kelly, clv, bankrollStats } from '@ianalloway/kelly-js';

const k = kelly(0.58, -110);
console.log(k.fraction);         // 0.118
console.log(k.halfDollars(1000)) // 59

const c = clv(-108, -115);
console.log(c.verdict);          // 'positive'

const stats = bankrollStats([
  { stake: 100, americanOdds: -110, result: 'win' },
], 1000);
console.log(stats.roi);
console.log(stats.maxDrawdown);
```

## Install

```bash
npm install @ianalloway/kelly-js  # Published registry version (currently 1.0.0)

# To use the v1.2.0 examples while the npm release is pending:
npm install github:ianalloway/kelly-js#v1.2.0
```

Package page: [npmjs.com/package/@ianalloway/kelly-js](https://www.npmjs.com/package/@ianalloway/kelly-js)

The examples below use features introduced in v1.2.0. Once that version appears
on npm, you can install it with `npm install @ianalloway/kelly-js@^1.2.0`.
The npm version badge above tracks the registry release, which can lag behind
the Git tag until the publish workflow succeeds.

`dist/` is gitignored; a `prepare` script runs `tsc` on install so the package entrypoints resolve. From a checkout: `npm install && npm run build`.

## API highlights

### Kelly Criterion

```ts
kelly(winProbability, americanOdds)
```

Returns Kelly sizing, half/quarter Kelly, dollar sizing, expected value, and edge.

```ts
kellyParlay(legs)
```

Sizes a multi-leg parlay as one combined bet — multiplies leg probabilities and
odds together, then runs the same Kelly formula against the result.

```ts
kellyParlay([
  { probability: 0.55, americanOdds: -110 },
  { probability: 0.60, americanOdds: -120 },
]);
// { fraction: ..., combinedOdds: ..., combinedDecimal: ..., trueWinProb: 0.33, ... }
```

### Simultaneous & mutually exclusive Kelly

When several bets are live at once, independent single-bet Kelly overstates total
exposure. These helpers size a **portfolio** under a shared bankroll cap. Inputs
use **decimal odds** and win probabilities (convert with `toDecimal` if you start
from American lines).

```ts
simultaneousKelly(bets, opts?)
mutuallyExclusiveKelly(outcomes, opts?)
```

**Independent concurrent bets** — maximize expected log growth over all 2^n
win/loss combinations. Exact for `n ≤ 12`; for larger slates falls back to
independent Kelly fractions scaled onto `maxTotal` (documented approximation that
ignores joint cross terms). Fractions never sum above `1` (or `opts.maxTotal`).

```ts
import { simultaneousKelly, toDecimal } from '@ianalloway/kelly-js';

const slate = simultaneousKelly(
  [
    { probability: 0.55, decimalOdds: toDecimal(-110), label: 'Lakers ML' },
    { probability: 0.60, decimalOdds: 1.90, label: 'Over 220.5' },
  ],
  { fraction: 0.5, maxTotal: 0.25 } // half-Kelly, 25% book cap
);

slate.fractions;      // e.g. [0.04, 0.05]
slate.totalFraction;  // ≤ 0.25
slate.method;         // 'exact' | 'approximation'
slate.dollars(1000);  // per-bet stakes
```

**Mutually exclusive outcomes** (futures / same-event multi-bet) — Smoczynski &
Tomkins optimal-set algorithm: sort by expected revenue `p × decimalOdds`, grow
the set while revenue exceeds the reserve rate, then
`f_i = p_i − R(S) / decimalOdds_i`. Probabilities must sum to ≤ 1.

```ts
import { mutuallyExclusiveKelly } from '@ianalloway/kelly-js';

const futures = mutuallyExclusiveKelly([
  { probability: 0.40, decimalOdds: 3.0, label: 'Team A' },
  { probability: 0.25, decimalOdds: 5.0, label: 'Team B' },
  { probability: 0.10, decimalOdds: 15.0, label: 'Team C' },
]);

futures.fractions;    // stakes on A/B/C (zeros outside the optimal set)
futures.optimalSet;   // indices included in the optimal set
futures.reserveRate;  // R(S) unallocated wealth share
```

A single +EV input to either function matches plain `kelly()` (same probability
and equivalent decimal odds). No positive-edge inputs → all zeros.

### Odds conversion

```ts
impliedProb(american)
fromImpliedProb(probability)   // inverse of impliedProb (integer-rounded American)
toDecimal(american)
toAmerican(decimal)
convertOdds(american, oppositeOdds?)  // pass opposite side for real noVigProbability
removeVig(side1, side2)
```

### Expected value & break-even helpers

```ts
expectedValue(winProbability, americanOdds, stake?)
minEdge(americanOdds, targetEv?)           // prob points above break-even for a target EV/stake
stakeForTargetProfit(americanOdds, targetProfit) // stake needed to net $X on a win
```

Break-even win rate is `impliedProb(odds)` (also returned as `breakEvenProb` from
`expectedValue`). Use `minEdge` when you already know the line and want the edge
required for a target ROI — e.g. `minEdge(-110, 0.05)` → `0.0262` (~2.62 pts above
implied for a 5% EV). Use `stakeForTargetProfit` to size a bet to a dollar target:
`stakeForTargetProfit(-110, 100)` → `110`.

### Closing Line Value

```ts
clv(openLine, closeLine)
clvSummary(bets)
rollingClvSummary(bets, windowSize)  // contiguous window summaries over a season
```

### Bankroll tracking

```ts
betPnL(stake, americanOdds, result)
bankrollStats(bets, startingBankroll?)
```

### Monte Carlo growth simulation

```ts
simulateGrowth(winProbability, americanOdds, betsPerPath?, paths?, startingBankroll?, kellyMultiplier?, seed?)
```

Simulates many independent bankroll paths, each placing sequential fractional-Kelly
bets, and reports the distribution of outcomes — because a positive edge tells you
nothing about variance.

```ts
const sim = simulateGrowth(0.55, -110, 500, 2000, 1000, 0.5, 42);

sim.medianFinal       // 1675.81 — median final bankroll across 2000 paths
sim.p10               // 802.69  — 10% of paths ended at or below this
sim.p90               // 3498.68 — 10% of paths ended at or above this
sim.ruinRate          // 0       — fraction of paths that dropped below 10% of start
sim.medianMaxDrawdown // 0.3891  — median worst peak-to-trough drawdown (39%)
```

Reading the percentiles: `p10`/`p90` bracket the realistic range of outcomes.
In the example above, a genuine 55% edge at -110 with half-Kelly sizing still
loses money in over 10% of 500-bet runs and a typical run suffers a ~39% drawdown —
useful context before sizing up. Pass an integer `seed` for reproducible results
(seeded mulberry32 PRNG); omit it for a random run.

### Line shopping

```ts
lineShop(books)
```

Ranks American odds across sportsbooks for one side of a bet and quantifies how
much implied probability you save by taking the best line instead of the worst.

```ts
lineShop([
  { book: 'DraftKings', odds: -112 },
  { book: 'FanDuel',    odds: -108 },
  { book: 'BetMGM',     odds: -115 },
]);
// {
//   bestBook: 'FanDuel',
//   bestOdds: -108,
//   impliedProbAtBest: 0.5192,
//   shoppingEdgePct: 1.57,   // percentage points of implied prob saved vs. worst book
//   ranked: [...]            // all books sorted best-to-worst for the bettor
// }
```

A 1.57-point shopping edge is often the difference between a losing and a
break-even bettor — line shopping is the cheapest edge available.

### Advanced / extras

These cover more specialized use cases (portfolio sizing, arbitrage/dutching,
DFS, and a Poisson totals model). All are exported from the same package —
nothing here needs a separate install.

```ts
kellyPortfolio(bets, maxExposure?)      // size several simultaneous Kelly bets under one exposure cap
simultaneousKelly(bets, opts?)          // independent concurrent bets — exact log-growth (n≤12) or scaled approx
mutuallyExclusiveKelly(outcomes, opts?) // same-event / futures — Smoczynski–Tomkins optimal set
optimalFractionalKelly(edge, variance, maxDrawdown, riskOfDrawdown?)
kellyGrowthRate(winProbability, americanOdds, fraction) // compare growth rate at any staking fraction
parlayAnalysis(legs)                    // true EV/win prob for a multi-leg parlay
arbitrage(oddsA, oddsB, totalStake?)    // guaranteed-profit stake split across two books
dutching(outcomes, totalStake?)         // guaranteed-profit stake split across 3+ outcomes
hedgeBet(originalStake, originalOdds, hedgeOdds) // lock profit by staking the opposite side
marketConsensus(books)                  // de-vig and average odds across books
poissonModel(lambda1, lambda2, maxGoals?) // win/draw/loss + totals model for scoring sports
ownershipLeverage(projectedPoints, ownershipPct) // DFS contrarian-play score
stackBonus(qbProj, receiverProj, correlation?)   // DFS game-stack correlation bonus
```

## Why this repo matters

This is a compact, reusable package that turns betting math into something easy to import and test. It’s a better signal than a giant monorepo because the scope is clean and the API is obvious.

## Math notes

- Kelly formula: `f* = (bp - q) / b`
- Simultaneous independent Kelly maximizes `Σ_ω P(ω) ln(1 + Σ_i f_i · payoff_i(ω))` over the 2^n lattice
- Mutually exclusive Kelly (Smoczynski/Tomkins): `f_i = p_i − R(S)/o_i` on the optimal set
- CLV is the gap between your line and the close
- Full Kelly is optimal in theory; half Kelly is usually the practical default

## Testing

```bash
npm run lint       # Type-check source and tests
npm test           # Run Vitest tests
npm run test:dist  # Rebuild dist/ and verify published exports
bash scripts/smoke-registry.sh  # Clean-install the exact package version from npm
```

## Publishing

Releases go out via [`.github/workflows/publish.yml`](.github/workflows/publish.yml) on `release` or `workflow_dispatch`.

Publishing uses npm Trusted Publishing. The package's Trusted Publisher must
match GitHub owner `ianalloway`, repository `kelly-js`, workflow filename
`publish.yml`, and permit direct `npm publish`. The workflow has OIDC
`id-token: write` permission and verifies a clean registry install after upload.

Until that publish succeeds, install from npm may still resolve an older version than `main` carries.

## Links

- [npm package](https://www.npmjs.com/package/@ianalloway/kelly-js)
- [GitHub repository](https://github.com/ianalloway/kelly-js)
- [Issues](https://github.com/ianalloway/kelly-js/issues)

## Author

[Ian Alloway](https://github.com/ianalloway)

## License

[MIT](LICENSE)
