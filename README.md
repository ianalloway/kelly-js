# kelly-js

**The sports bettor's math toolkit.** Kelly Criterion, CLV, EV, bankroll stats, odds conversion — TypeScript, zero dependencies, tree-shakeable.

[![npm](https://img.shields.io/npm/v/@ianalloway/kelly-js?style=for-the-badge)](https://www.npmjs.com/package/@ianalloway/kelly-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

```ts
import { kelly, clv, bankrollStats } from '@ianalloway/kelly-js';

// Size a bet
const k = kelly(0.58, -110);
console.log(k.fraction);         // 0.0714
console.log(k.halfDollars(1000)) // $35.71

// Measure your edge
const c = clv(-108, -115);       // you bet -108, closed -115
console.log(c.verdict);          // 'positive' — you beat the market

// Bankroll health check
const stats = bankrollStats(myBets, 1000);
console.log(stats.roi);          // +0.054 (+5.4%)
console.log(stats.maxDrawdown);  // 0.12 (12% max drawdown)
```

## Install

```bash
npm install @ianalloway/kelly-js
# or
pnpm add @ianalloway/kelly-js
```

## API

### Kelly Criterion

#### `kelly(winProbability, americanOdds): KellyResult`

Calculate optimal bet sizing using the Kelly Criterion.

```ts
const k = kelly(0.60, +120);  // 60% win prob at +120

k.fraction       // 0.1167  — bet 11.67% of bankroll
k.halfKelly      // 0.0583  — recommended for most bettors
k.quarterKelly   // 0.0292  — ultra-conservative
k.dollars(1000)  // $116.67 — full Kelly on $1,000 bankroll
k.halfDollars(1000) // $58.33
k.ev             // 0.12    — expected value per unit
k.edge           // 0.0545  — 5.45% edge over implied prob
k.hasEdge        // true
```

> **Rule:** Use half-Kelly in practice. Full Kelly maximizes log-growth but variance is brutal.

#### `kellyPortfolio(bets, maxExposure?): PortfolioResult[]`

Size multiple simultaneous bets, scaling so total exposure stays within `maxExposure` (default 25%).

```ts
const portfolio = kellyPortfolio([
  { winProbability: 0.58, americanOdds: -110, label: 'Chiefs ML' },
  { winProbability: 0.62, americanOdds: +105, label: 'Warriors ATS' },
], 0.20);
```

### Odds Conversion

#### `impliedProb(american): number`
```ts
impliedProb(-110) // 0.5238
impliedProb(+150) // 0.4000
```

#### `toDecimal(american): number`
```ts
toDecimal(-110)   // 1.909
toDecimal(+150)   // 2.500
```

#### `toAmerican(decimal): number`
```ts
toAmerican(1.909) // -110
```

#### `convertOdds(american): OddsConversion`
```ts
convertOdds(-110)
// { american: -110, decimal: 1.909, fractional: '10/11', impliedProbability: 0.5238 }
```

#### `removeVig(side1, side2): { prob1, prob2, vig }`
```ts
removeVig(-110, -110)
// { prob1: 0.5, prob2: 0.5, vig: 0.0476 }
```

### Expected Value

#### `expectedValue(winProbability, americanOdds, stake?)`
```ts
expectedValue(0.58, -110, 100)
// { ev: 9.09, evPercent: 9.09, breakEvenProb: 0.5238 }
```

### Closing Line Value (CLV)

CLV is the #1 predictor of long-term betting success. If you consistently get better odds than closing, your process is sound.

#### `clv(openLine, closeLine): CLVResult`
```ts
clv(-108, -115)
// { openLine: -108, closeLine: -115, clvPercent: 0.45, beatClose: true, verdict: 'positive' }
```

| Verdict | Avg CLV | Meaning |
|---------|---------|---------|
| `elite` | ≥ +2.0% | World-class line shopping |
| `positive` | ≥ +0.5% | Real edge in timing/shopping |
| `neutral` | ≥ -0.5% | No significant edge either way |
| `negative` | < -0.5% | Consistently getting bad lines |

#### `clvSummary(bets): SummaryResult`
```ts
clvSummary([
  { openLine: -108, closeLine: -115 },
  { openLine: +102, closeLine: +100 },
  { openLine: -120, closeLine: -118 },
]);
// { avgCLV: 0.58, beatCloseRate: 0.67, verdict: '✅ Positive — beating the market consistently', totalBets: 3 }
```

### Bankroll Tracking

#### `betPnL(stake, americanOdds, result): BetResult`
```ts
betPnL(100, -110, 'win')  // { pnl: 90.91, roi: 0.9091 }
betPnL(100, -110, 'loss') // { pnl: -100, roi: -1 }
```

#### `bankrollStats(bets, startingBankroll?): BankrollStats`
```ts
bankrollStats(myBets, 1000)
// {
//   totalBets: 150, wins: 84, losses: 63, pushes: 3,
//   winRate: 0.5714, totalStaked: 15000, netPnL: 823.50,
//   roi: 0.0549, peakBankroll: 1901.23, maxDrawdown: 0.089,
//   currentStreak: 4, streakType: 'win'
// }
```

### DFS Helpers

#### `ownershipLeverage(projectedPoints, ownershipPct)`
```ts
ownershipLeverage(52.4, 8.2)  // 5.98 — high leverage
ownershipLeverage(58.1, 38.5) // 1.48 — chalk
```

#### `stackBonus(qbProj, receiverProj, correlation?)`
```ts
stackBonus(33.8, 29.8) // 1.04 — extra projected pts from correlation
```

## The Math

**Kelly Formula:** `f* = (bp - q) / b`
- `b` = net decimal odds (profit per unit)
- `p` = your estimated win probability
- `q` = 1 - p (loss probability)

**CLV Formula:** `CLV% = (P_close - P_open) × 100`
- Positive = you got better implied prob than close (beat the market)

**EV Formula:** `EV = (b × p) - q`

## Author

[Ian Alloway](https://github.com/ianalloway) — Data Scientist, sports analytics & AI.

## License

MIT
