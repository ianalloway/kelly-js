# kelly-js

**The sports bettor's math toolkit.** Kelly Criterion, CLV, EV, bankroll stats, odds conversion — TypeScript, zero dependencies, tree-shakeable.

[![npm](https://img.shields.io/npm/v/@ianalloway/kelly-js?style=for-the-badge)](https://www.npmjs.com/package/@ianalloway/kelly-js)
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

```bash
npm install @ianalloway/kelly-js
# or
pnpm add @ianalloway/kelly-js
```

## API highlights

### Kelly Criterion

```ts
kelly(winProbability, americanOdds)
```

Returns Kelly sizing, half/quarter Kelly, dollar sizing, expected value, and edge.

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

## Why this repo matters

This is a compact, reusable package that turns betting math into something easy to import and test. It’s a better signal than a giant monorepo because the scope is clean and the API is obvious.

## Math notes

- Kelly formula: `f* = (bp - q) / b`
- CLV is the gap between your line and the close
- Full Kelly is optimal in theory; half Kelly is usually the practical default

## Testing

```bash
npm test
```

## Author

Ian Alloway

## License

MIT
