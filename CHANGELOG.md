# Changelog

Notable changes to `@ianalloway/kelly-js`. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `simultaneousKelly(bets, opts?)`: Kelly sizing for independent bets placed at
  the same time. Maximizes expected log growth over all 2^n outcome combinations
  (exact for `n ≤ 12`); larger slates use a documented independent-Kelly +
  proportional-scale approximation. Returns per-bet fractions that never sum
  above `1` (or `opts.maxTotal`), with optional fractional-Kelly `fraction`.
  Inputs use decimal odds and win probabilities.
- `mutuallyExclusiveKelly(outcomes, opts?)`: Kelly sizing for several outcomes
  of the same event (futures, race markets) via the Smoczynski/Tomkins
  optimal-set algorithm. Same decimal-odds inputs, `maxTotal` / `fraction` opts,
  and bankroll `dollars()` helper.
- Exported types: `SimultaneousBetInput`, `SimultaneousKellyOpts`,
  `SimultaneousKellyResult`, `MutuallyExclusiveOutcomeInput`,
  `MutuallyExclusiveKellyOpts`, `MutuallyExclusiveKellyResult`, and
  `SIMULTANEOUS_KELLY_EXACT_MAX`.

## [1.1.0] - 2026-09-29

The `1.0.1` and `1.0.2` version bumps on `main` were never tagged or published
to npm. Everything they carried is included here. The last npm release is
`1.0.0` (published 2026-09-04).

### Added

- `minEdge(americanOdds, targetEv = 0)`: probability-point edge above
  break-even needed for a target EV per unit staked.
- `stakeForTargetProfit(americanOdds, targetProfit)`: stake needed to net a
  target profit on a win.
- `fromImpliedProb(probability)`: probability → American odds, the inverse of
  `impliedProb()`.
- `rollingClvSummary(bets, windowSize)` returning `RollingCLVWindow[]`: one
  `CLVSummary` per contiguous window, for tracking CLV over a season.
  `CLVSummary` is now an exported interface.
- `convertOdds(american, oppositeOdds)`: pass the other side of a two-way
  market to get a real `noVigProbability` for this side.

### Changed

- **`convertOdds()` no longer accepts the `vigRemoval` boolean.** It used to
  copy the vig-inclusive implied probability into `noVigProbability`, so the
  value it reported was wrong. Passing a boolean now throws a `TypeError`.
  Pass `oppositeOdds` or use `removeVig()` instead.
- Stricter input validation. Functions now throw `RangeError` where they
  previously returned `NaN` or nonsense:
  - `impliedProb`, `toDecimal`, `toAmerican`: non-finite or zero odds.
  - `kelly`, `kellyParlay`, `simulateGrowth`, `kellyGrowthRate`: non-finite
    probabilities or fractions.
  - `expectedValue`: probability outside [0, 1], or a non-positive stake.
  - `betPnL`: a non-positive stake, or an unknown `result`.
  - `parlayAnalysis`: an empty `legs` array.
  - `removeVig`: a non-positive combined probability.
  - `optimalFractionalKelly`: non-finite arguments, `variance <= 0`, and
    `maxDrawdown` / `riskOfDrawdown` outside (0, 1).

### Fixed

- A probability of exactly 0.5 now converts to fair odds of `+100` (even
  money) instead of `-100`. Affects the `fairOdds*` fields of
  `marketConsensus()` and `poissonModel()`.
- Removed an unused intermediate from `optimalFractionalKelly()` and
  documented the formula it actually applies.

### Maintenance

- Publish workflow (`publish.yml`) targets npm Trusted Publishing with
  provenance and runs on GitHub release (`published`) or manual dispatch.
  `NPM_TOKEN` is an optional fallback.
- README: version-lag note and docs for the new helpers. Dependency bumps
  (`actions/setup-node`, dev dependencies).

## [1.0.0] - 2026-09-04

First npm release of `@ianalloway/kelly-js`. The `v1.0.0` git tag (2026-02-25)
predates this publish. The npm tarball was built from a later `main` and
already included `arbitrage`, `parlayAnalysis`, `simulateGrowth`, `lineShop`,
`marketConsensus`, `poissonModel`, `kellyGrowthRate`, `dutching`,
`kellyParlay`, `hedgeBet`, `optimalFractionalKelly`, and
`KellyResult.fractionalKelly` / `fractionalDollars`, along with the
TypeScript 7 / vitest toolchain and the `files: ["dist"]` tarball.
