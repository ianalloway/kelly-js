# kelly-js

**The sports bettor's math toolkit.** Kelly Criterion, CLV, EV, bankroll stats, odds conversion — TypeScript, zero dependencies, tree-shakeable.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-Jest-success?style=for-the-badge)](jest.config.js)

```ts
import { kelly, clv, bankrollStats } from '@ianalloway/kelly-js';

const k = kelly(0.58, -110);
console.log(k.fraction);         // 0.0714
console.log(k.halfDollars(1000)) // $35.71

const c = clv(-108, -115);
console.log(c.verdict);          // 'positive'

const stats = bankrollStats(myBets, 1000);
console.log(stats.roi);
console.log(stats.maxDrawdown);
```

## Install

> npm registry publish pending (needs granular token with **Bypass 2FA**). Until then:

```bash
npm install github:ianalloway/kelly-js
# or
pnpm add github:ianalloway/kelly-js
```

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

### Odds conversion

```ts
impliedProb(american)
toDecimal(american)
toAmerican(decimal)
convertOdds(american)
removeVig(side1, side2)
```

### Expected value

```ts
expectedValue(winProbability, americanOdds, stake?)
```

### Closing Line Value

```ts
clv(openLine, closeLine)
clvSummary(bets)
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
optimalFractionalKelly(edge, variance, maxDrawdown, riskOfDrawdown?)
kellyGrowthRate(winProbability, americanOdds, fraction) // compare growth rate at any staking fraction
parlayAnalysis(legs)                    // true EV/win prob for a multi-leg parlay
arbitrage(oddsA, oddsB, totalStake?)    // guaranteed-profit stake split across two books
dutching(outcomes, totalStake?)         // guaranteed-profit stake split across 3+ outcomes
marketConsensus(books)                  // de-vig and average odds across books
poissonModel(lambda1, lambda2, maxGoals?) // win/draw/loss + totals model for scoring sports
ownershipLeverage(projectedPoints, ownershipPct) // DFS contrarian-play score
stackBonus(qbProj, receiverProj, correlation?)   // DFS game-stack correlation bonus
```

## Why this repo matters

This is a compact, reusable package that turns betting math into something easy to import and test. It’s a better signal than a giant monorepo because the scope is clean and the API is obvious.

## Math notes

- Kelly formula: `f* = (bp - q) / b`
- CLV is the gap between your line and the close
- Full Kelly is optimal in theory; half Kelly is usually the practical default

## Testing

```bash
npm run lint       # Type-check source and tests
npm test           # Run Jest tests
npm run test:dist  # Rebuild dist/ and verify published exports
```

## Author

Ian Alloway

## License

MIT
