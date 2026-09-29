/**
 * kelly-js — Kelly Criterion & sports betting analytics library
 * by Ian Alloway <ian@allowayllc.com>
 * MIT License
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KellyResult {
  /** Fraction of bankroll to bet (0–1) */
  fraction: number;
  /** Half-Kelly fraction */
  halfKelly: number;
  /** Quarter-Kelly fraction */
  quarterKelly: number;
  /** Dollar amount at full Kelly given bankroll */
  dollars: (bankroll: number) => number;
  /** Dollar amount at half-Kelly given bankroll */
  halfDollars: (bankroll: number) => number;
  /** Expected value of the bet */
  ev: number;
  /** True edge percentage */
  edge: number;
  /** Whether this bet has positive expected value */
  hasEdge: boolean;
  /** Arbitrary fractional Kelly multiplier */
  fractionalKelly: (multiplier: number) => number;
  /** Dollar amount at arbitrary fractional Kelly given bankroll */
  fractionalDollars: (multiplier: number, bankroll: number) => number;
}

export interface CLVResult {
  /** Opening line (American odds) */
  openLine: number;
  /** Closing line (American odds) */
  closeLine: number;
  /** CLV in percentage points of implied probability */
  clvPercent: number;
  /** Whether you beat the closing line */
  beatClose: boolean;
  /** Interpretation */
  verdict: 'elite' | 'positive' | 'neutral' | 'negative';
}

export interface OddsConversion {
  american: number;
  decimal: number;
  fractional: string;
  impliedProbability: number;
  noVigProbability?: number;
}

export interface BetResult {
  stake: number;
  odds: number;
  result: 'win' | 'loss' | 'push';
  pnl: number;
  roi: number;
}

export interface BankrollStats {
  totalBets: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  totalStaked: number;
  netPnL: number;
  roi: number;
  peakBankroll: number;
  maxDrawdown: number;
  currentStreak: number;
  streakType: 'win' | 'loss' | 'none';
  /** Sharpe ratio of bet returns (annualised, assuming 365 bets/year) */
  sharpeRatio: number;
}

export interface ArbitrageResult {
  /** Whether a true arbitrage opportunity exists (guaranteed profit) */
  hasArb: boolean;
  /** Profit percentage if arb exists */
  profitPct: number;
  /** Optimal stake on side A to guarantee profit given totalStake */
  stakeA: number;
  /** Optimal stake on side B to guarantee profit given totalStake */
  stakeB: number;
  /** Total vig / overround in the market */
  overround: number;
}

export interface ParlayResult {
  /** Combined American odds of the parlay */
  combinedOdds: number;
  /** Combined decimal odds */
  combinedDecimal: number;
  /** True win probability (product of no-vig probs per leg) */
  trueWinProb: number;
  /** Implied win probability (includes vig) */
  impliedWinProb: number;
  /** Expected value per $100 staked */
  ev100: number;
  /** Whether the parlay has positive expected value */
  hasEdge: boolean;
  /** Number of legs */
  legs: number;
}

export interface SimulationResult {
  /** Median final bankroll across all simulations */
  medianFinal: number;
  /** 10th percentile final bankroll */
  p10: number;
  /** 25th percentile final bankroll */
  p25: number;
  /** 75th percentile final bankroll */
  p75: number;
  /** 90th percentile final bankroll */
  p90: number;
  /** Fraction of simulations where bankroll fell below 10% of start (practical ruin) */
  ruinRate: number;
  /** Median maximum drawdown across simulations */
  medianMaxDrawdown: number;
  /** Starting bankroll used */
  startingBankroll: number;
  /** Number of bets simulated per path */
  betsPerPath: number;
  /** Number of Monte Carlo paths run */
  paths: number;
}

export interface LineShopResult {
  /** The best available American odds */
  bestOdds: number;
  /** The book offering the best odds */
  bestBook: string;
  /** Implied probability at best odds (no-vig removed from market if 2+ sides provided) */
  impliedProbAtBest: number;
  /** All books sorted best-to-worst */
  ranked: Array<{ book: string; odds: number; impliedProb: number }>;
  /** Extra implied-probability edge vs worst book (how much shopping helped) */
  shoppingEdgePct: number;
}

// ─── Odds Conversion ──────────────────────────────────────────────────────────

/**
 * Convert American odds to implied probability (includes vig).
 * @example impliedProb(-110) // 0.5238
 */
export function impliedProb(american: number): number {
  if (!Number.isFinite(american) || american === 0) {
    throw new RangeError('american odds must be a finite non-zero number');
  }
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}

/**
 * Convert an implied (or fair/no-vig) probability to American odds.
 * Inverse of {@link impliedProb} for round-trips (subject to integer rounding).
 *
 * @example fromImpliedProb(0.5238) // -110
 * @example fromImpliedProb(0.4)    // +150
 */
export function fromImpliedProb(probability: number): number {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    throw new RangeError('probability must be a finite number strictly between 0 and 1');
  }
  return probToAmerican(probability);
}

/**
 * Convert American odds to decimal odds.
 * @example toDecimal(-110) // 1.909
 */
export function toDecimal(american: number): number {
  if (!Number.isFinite(american) || american === 0) {
    throw new RangeError('American odds must be a finite non-zero number');
  }
  if (american > 0) return american / 100 + 1;
  return 100 / Math.abs(american) + 1;
}

/**
 * Convert decimal odds to American odds.
 * @example toAmerican(1.909) // -110
 */
export function toAmerican(decimal: number): number {
  if (!Number.isFinite(decimal) || decimal <= 1) {
    throw new RangeError('Decimal odds must be a finite number greater than 1');
  }
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

/**
 * Full odds conversion — American → decimal, fractional, implied prob.
 *
 * Pass `oppositeOdds` (the other side of a two-way market) to include a real
 * no-vig probability for this side. The former `vigRemoval: true` boolean was
 * a no-op lie (it copied the vig-inclusive implied prob); use `removeVig` or
 * pass the opposite line here instead.
 */
export function convertOdds(
  american: number,
  oppositeOdds?: number | boolean
): OddsConversion {
  if (typeof oppositeOdds === 'boolean') {
    throw new TypeError(
      'convertOdds no longer accepts a vigRemoval boolean; pass oppositeOdds (number) for no-vig, or use removeVig()'
    );
  }
  const implied = impliedProb(american);
  const decimal = toDecimal(american);
  const absAmerican = Math.abs(american);

  // Fractional approximation
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const num = american > 0 ? american : 100;
  const den = american > 0 ? 100 : absAmerican;
  const g = gcd(num, den);
  const fractional = `${num / g}/${den / g}`;

  const result: OddsConversion = {
    american,
    decimal: Math.round(decimal * 1000) / 1000,
    fractional,
    impliedProbability: Math.round(implied * 10000) / 10000,
  };

  if (oppositeOdds !== undefined) {
    const { prob1 } = removeVig(american, oppositeOdds);
    result.noVigProbability = prob1;
  }

  return result;
}

/**
 * Remove the vig from a two-sided market to get true probabilities.
 * @param side1 American odds for side 1
 * @param side2 American odds for side 2
 * @returns True probabilities for each side
 */
export function removeVig(
  side1: number,
  side2: number
): { prob1: number; prob2: number; vig: number } {
  const p1 = impliedProb(side1);
  const p2 = impliedProb(side2);
  const total = p1 + p2;
  if (!(total > 0)) {
    throw new RangeError('combined implied probabilities must be positive');
  }
  const vig = total - 1;
  return {
    prob1: Math.round((p1 / total) * 10000) / 10000,
    prob2: Math.round((p2 / total) * 10000) / 10000,
    vig: Math.round(vig * 10000) / 10000,
  };
}

// ─── Kelly Criterion ──────────────────────────────────────────────────────────

/**
 * Calculate Kelly Criterion bet sizing.
 *
 * @param winProbability Your estimated win probability (0–1)
 * @param americanOdds  American odds being offered
 * @returns KellyResult with fractions, dollar amounts, and EV
 *
 * @example
 * const k = kelly(0.58, -110);
 * console.log(k.fraction);     // 0.0714
 * console.log(k.halfDollars(1000)); // 35.71
 */
export function kelly(winProbability: number, americanOdds: number): KellyResult {
  if (!Number.isFinite(winProbability) || winProbability <= 0 || winProbability >= 1) {
    throw new RangeError('winProbability must be a finite number between 0 and 1 exclusive');
  }
  if (!Number.isFinite(americanOdds) || americanOdds === 0) {
    throw new RangeError('americanOdds must be a finite non-zero number');
  }

  const b = toDecimal(americanOdds) - 1; // net odds (profit per unit staked)
  const p = winProbability;
  const q = 1 - p;

  // Full Kelly: f* = (bp - q) / b
  const fraction = Math.max(0, (b * p - q) / b);
  const ev = b * p - q;

  const implied = impliedProb(americanOdds);
  const edge = p - implied;

  return {
    fraction: Math.round(fraction * 10000) / 10000,
    halfKelly: Math.round((fraction / 2) * 10000) / 10000,
    quarterKelly: Math.round((fraction / 4) * 10000) / 10000,
    dollars: (bankroll: number) => {
      if (!Number.isFinite(bankroll) || bankroll < 0) throw new RangeError('bankroll must be a finite non-negative number');
      return Math.round(bankroll * fraction * 100) / 100;
    },
    halfDollars: (bankroll: number) => {
      if (!Number.isFinite(bankroll) || bankroll < 0) throw new RangeError('bankroll must be a finite non-negative number');
      return Math.round(bankroll * fraction * 50) / 100;
    },
    ev: Math.round(ev * 10000) / 10000,
    edge: Math.round(edge * 10000) / 10000,
    hasEdge: ev > 0,
    fractionalKelly: (multiplier: number) => {
      if (!Number.isFinite(multiplier) || multiplier < 0) throw new RangeError('multiplier must be a finite non-negative number');
      return Math.round((fraction * multiplier) * 10000) / 10000;
    },
    fractionalDollars: (multiplier: number, bankroll: number) => {
      if (!Number.isFinite(multiplier) || multiplier < 0) throw new RangeError('multiplier must be a finite non-negative number');
      if (!Number.isFinite(bankroll) || bankroll < 0) throw new RangeError('bankroll must be a finite non-negative number');
      return Math.round(bankroll * fraction * multiplier * 100) / 100;
    },
  };
}

/**
 * Kelly sizing with multiple simultaneous bets (fractional Kelly portfolio).
 * Scales each bet so the total portfolio exposure stays within max exposure.
 * Supports individual fractional Kelly multipliers per bet.
 */
export function kellyPortfolio(
  bets: Array<{ 
    winProbability: number; 
    americanOdds: number; 
    label?: string;
    multiplier?: number; // Optional fractional Kelly multiplier (e.g. 0.5 for half-Kelly)
  }>,
  maxExposure = 0.25
): Array<{ label: string; fraction: number; dollars: (bankroll: number) => number; ev: number }> {
  const results = bets.map((bet, i) => {
    const k = kelly(bet.winProbability, bet.americanOdds);
    const multiplier = bet.multiplier ?? 1;
    return {
      label: bet.label ?? `Bet ${i + 1}`,
      ...k,
      fraction: k.fraction * multiplier,
    };
  });

  const totalFraction = results.reduce((sum, r) => sum + r.fraction, 0);
  const scale = totalFraction > maxExposure ? maxExposure / totalFraction : 1;

  return results.map((r) => ({
    label: r.label,
    fraction: Math.round(r.fraction * scale * 10000) / 10000,
    dollars: (bankroll: number) => {
      if (!Number.isFinite(bankroll) || bankroll < 0) throw new RangeError('bankroll must be a finite non-negative number');
      return Math.round(bankroll * r.fraction * scale * 100) / 100;
    },
    ev: r.ev,
  }));
}

// ─── Simultaneous & Mutually Exclusive Kelly ──────────────────────────────────

/** Maximum number of independent bets for exact 2^n enumeration in {@link simultaneousKelly}. */
export const SIMULTANEOUS_KELLY_EXACT_MAX = 12;

export interface SimultaneousBetInput {
  /** Estimated win probability in (0, 1) */
  probability: number;
  /** Decimal odds (> 1), e.g. 1.91 or 2.5 */
  decimalOdds: number;
  /** Optional label for the bet */
  label?: string;
}

export interface SimultaneousKellyOpts {
  /**
   * Maximum sum of fractions across all bets (default `1`).
   * Fractions are projected onto this budget during optimization.
   */
  maxTotal?: number;
  /**
   * Fractional-Kelly multiplier applied after the full-Kelly solve
   * (default `1`). E.g. `0.5` for half-Kelly. After scaling, the sum is
   * re-capped at `maxTotal` if needed.
   */
  fraction?: number;
}

export interface SimultaneousKellyResult {
  /** Optimal bankroll fraction per bet (same order as inputs) */
  fractions: number[];
  /** Labels (provided or `Bet i`) */
  labels: string[];
  /** Sum of `fractions` */
  totalFraction: number;
  /** Expected log growth at the returned (pre-rounding) full-Kelly point, then scaled by `fraction` */
  logGrowth: number;
  /**
   * `'exact'` when n ≤ {@link SIMULTANEOUS_KELLY_EXACT_MAX} (full 2^n enumeration);
   * `'approximation'` when n is larger (independent Kelly + proportional scale).
   */
  method: 'exact' | 'approximation';
  /** Dollar stakes per bet for a given bankroll */
  dollars: (bankroll: number) => number[];
}

export interface MutuallyExclusiveOutcomeInput {
  /** Estimated win probability in (0, 1) */
  probability: number;
  /** Decimal odds (> 1) */
  decimalOdds: number;
  /** Optional label for the outcome */
  label?: string;
}

export interface MutuallyExclusiveKellyOpts {
  /** Maximum sum of fractions (default `1`) */
  maxTotal?: number;
  /** Fractional-Kelly multiplier (default `1`) */
  fraction?: number;
}

export interface MutuallyExclusiveKellyResult {
  /** Optimal bankroll fraction per outcome (same order as inputs; zero if not in the optimal set) */
  fractions: number[];
  /** Labels (provided or `Outcome i`) */
  labels: string[];
  /** Sum of `fractions` */
  totalFraction: number;
  /** Indices into the input array that form the Smoczynski/Tomkins optimal set */
  optimalSet: number[];
  /** Reserve rate R(S) for the optimal set (unallocated wealth share at the optimum) */
  reserveRate: number;
  /** Dollar stakes per outcome for a given bankroll */
  dollars: (bankroll: number) => number[];
}

/** Round a stake fraction to 4 decimal places (library convention). */
function roundFraction(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Round fractions to 4dp while guaranteeing Σ ≤ maxTotal (shave largest entries if needed).
 */
function roundFractionsRespectingCap(fractions: number[], maxTotal: number): number[] {
  let rounded = fractions.map(roundFraction);
  let sum = rounded.reduce((s, x) => s + x, 0);
  if (sum <= maxTotal + 1e-12) return rounded;

  rounded = projectOntoSimplexCap(rounded, maxTotal).map(roundFraction);
  sum = rounded.reduce((s, x) => s + x, 0);

  // Rounding can still overshoot by a few ULPs — shave the largest stakes
  while (sum > maxTotal + 1e-12) {
    let maxIdx = 0;
    for (let i = 1; i < rounded.length; i++) {
      if (rounded[i] > rounded[maxIdx]) maxIdx = i;
    }
    if (rounded[maxIdx] <= 0) break;
    rounded[maxIdx] = roundFraction(rounded[maxIdx] - 0.0001);
    sum = rounded.reduce((s, x) => s + x, 0);
  }
  return rounded;
}

/** Validate a win probability in (0, 1). */
function assertWinProbability(probability: number, label = 'probability'): void {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    throw new RangeError(`${label} must be a finite number between 0 and 1 exclusive`);
  }
}

/** Validate decimal odds (> 1). */
function assertDecimalOdds(decimalOdds: number): void {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) {
    throw new RangeError('decimalOdds must be a finite number greater than 1');
  }
}

/** Validate shared Kelly portfolio options. */
function normalizeKellyCapOpts(opts?: { maxTotal?: number; fraction?: number }): {
  maxTotal: number;
  fraction: number;
} {
  const maxTotal = opts?.maxTotal ?? 1;
  const fraction = opts?.fraction ?? 1;
  if (!Number.isFinite(maxTotal) || maxTotal <= 0 || maxTotal > 1) {
    throw new RangeError('maxTotal must be a finite number in (0, 1]');
  }
  if (!Number.isFinite(fraction) || fraction < 0) {
    throw new RangeError('fraction must be a finite non-negative number');
  }
  return { maxTotal, fraction };
}

/** Standalone Kelly fraction from probability + decimal odds (unrounded). */
function kellyFractionFromDecimal(probability: number, decimalOdds: number): number {
  const b = decimalOdds - 1;
  const q = 1 - probability;
  return Math.max(0, (b * probability - q) / b);
}

/**
 * Project `f` onto { f_i ≥ 0, Σ f_i ≤ maxTotal } via Euclidean projection.
 */
function projectOntoSimplexCap(f: number[], maxTotal: number): number[] {
  const n = f.length;
  const clamped = f.map((x) => Math.max(0, x));
  const sum = clamped.reduce((s, x) => s + x, 0);
  if (sum <= maxTotal) return clamped;
  // Soft-threshold: find τ such that Σ max(0, f_i − τ) = maxTotal
  const sorted = [...clamped].sort((a, b) => b - a);
  let cumsum = 0;
  let tau = 0;
  for (let i = 0; i < n; i++) {
    cumsum += sorted[i];
    const candidate = (cumsum - maxTotal) / (i + 1);
    if (i === n - 1 || sorted[i + 1] <= candidate) {
      tau = candidate;
      break;
    }
  }
  return clamped.map((x) => Math.max(0, x - tau));
}

/**
 * Expected log growth and gradient for independent simultaneous bets over all 2^n masks.
 * Wealth multiplier for mask ω: 1 − Σ f_i + Σ_{i: win} f_i · decimalOdds_i
 */
function simultaneousLogGrowthAndGradient(
  fractions: number[],
  probabilities: number[],
  decimalOdds: number[]
): { growth: number; gradient: number[] } {
  const n = fractions.length;
  const nMasks = 1 << n;
  const gradient = new Array(n).fill(0);
  let growth = 0;

  for (let mask = 0; mask < nMasks; mask++) {
    let p = 1;
    let wealth = 1;
    for (let i = 0; i < n; i++) {
      const win = (mask >> i) & 1;
      p *= win ? probabilities[i] : 1 - probabilities[i];
      wealth += win ? fractions[i] * (decimalOdds[i] - 1) : -fractions[i];
    }
    if (!(wealth > 0) || !(p > 0)) {
      // Invalid region (bankrupt) — steep penalty via gradient away from boundary
      if (!(wealth > 0)) {
        return { growth: Number.NEGATIVE_INFINITY, gradient: fractions.map((f) => -f - 1) };
      }
      continue;
    }
    const invW = 1 / wealth;
    growth += p * Math.log(wealth);
    for (let i = 0; i < n; i++) {
      const win = (mask >> i) & 1;
      const payoff = win ? decimalOdds[i] - 1 : -1;
      gradient[i] += p * payoff * invW;
    }
  }
  return { growth, gradient };
}

/**
 * Exact simultaneous Kelly via projected gradient ascent on expected log growth.
 */
function exactSimultaneousKelly(
  probabilities: number[],
  decimalOdds: number[],
  maxTotal: number
): { fractions: number[]; logGrowth: number } {
  const n = probabilities.length;
  // Warm start: independent Kelly, projected onto the budget
  let f = projectOntoSimplexCap(
    probabilities.map((p, i) => kellyFractionFromDecimal(p, decimalOdds[i])),
    maxTotal
  );

  let step = 0.2;
  let { growth: bestGrowth } = simultaneousLogGrowthAndGradient(f, probabilities, decimalOdds);
  if (!Number.isFinite(bestGrowth)) {
    f = new Array(n).fill(0);
    bestGrowth = 0;
  }

  for (let iter = 0; iter < 2000; iter++) {
    const { gradient } = simultaneousLogGrowthAndGradient(f, probabilities, decimalOdds);
    let improved = false;
    let trialStep = step;
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = projectOntoSimplexCap(
        f.map((x, i) => x + trialStep * gradient[i]),
        maxTotal
      );
      const { growth } = simultaneousLogGrowthAndGradient(candidate, probabilities, decimalOdds);
      if (Number.isFinite(growth) && growth >= bestGrowth - 1e-15) {
        const delta = growth - bestGrowth;
        f = candidate;
        bestGrowth = growth;
        improved = delta > 1e-14;
        step = Math.min(1, trialStep * 1.2);
        break;
      }
      trialStep *= 0.5;
    }
    if (!improved) {
      // Check projected gradient norm for stationarity
      const { gradient: g } = simultaneousLogGrowthAndGradient(f, probabilities, decimalOdds);
      const projected = projectOntoSimplexCap(
        f.map((x, i) => x + g[i]),
        maxTotal
      );
      let move = 0;
      for (let i = 0; i < n; i++) move += Math.abs(projected[i] - f[i]);
      if (move < 1e-12) break;
      step = Math.max(1e-6, step * 0.5);
    }
  }

  return { fractions: f, logGrowth: bestGrowth };
}

/**
 * Large-n approximation: independent Kelly fractions, scaled to respect `maxTotal`.
 * Ignores simultaneous cross terms in the joint log-wealth objective.
 * `logGrowth` is left at 0 — full lattice evaluation is intractable at this n.
 */
function approximateSimultaneousKelly(
  probabilities: number[],
  decimalOdds: number[],
  maxTotal: number
): { fractions: number[]; logGrowth: number } {
  const raw = probabilities.map((p, i) => kellyFractionFromDecimal(p, decimalOdds[i]));
  return { fractions: projectOntoSimplexCap(raw, maxTotal), logGrowth: 0 };
}

/**
 * Simultaneous Kelly sizing for independent bets placed at the same time.
 *
 * Maximizes expected log bankroll growth over all 2^n win/loss combinations
 * when each bet is independent. Returned fractions never sum above `opts.maxTotal`
 * (default `1`).
 *
 * **Exact vs approximation:** for `n ≤ 12` the objective is optimized exactly over
 * the full outcome lattice (projected gradient ascent). For `n > 12`, enumerating
 * 2^n states is intractable, so the function falls back to computing each bet's
 * standalone Kelly fraction and scaling the vector proportionally onto the
 * `maxTotal` budget. That approximation ignores cross terms in the joint
 * log-wealth objective — prefer exact for small slates.
 *
 * @param bets Array of `{ probability, decimalOdds, label? }`
 * @param opts Optional `maxTotal` (default 1) and fractional-Kelly `fraction` (default 1)
 *
 * @example
 * simultaneousKelly([
 *   { probability: 0.55, decimalOdds: 2.1, label: 'Game A' },
 *   { probability: 0.60, decimalOdds: 1.9, label: 'Game B' },
 * ], { fraction: 0.5 });
 */
export function simultaneousKelly(
  bets: SimultaneousBetInput[],
  opts?: SimultaneousKellyOpts
): SimultaneousKellyResult {
  if (bets.length === 0) throw new RangeError('bets array must not be empty');
  const { maxTotal, fraction: kellyMult } = normalizeKellyCapOpts(opts);

  const probabilities: number[] = [];
  const decimalOdds: number[] = [];
  const labels: string[] = [];

  bets.forEach((bet, i) => {
    assertWinProbability(bet.probability);
    assertDecimalOdds(bet.decimalOdds);
    probabilities.push(bet.probability);
    decimalOdds.push(bet.decimalOdds);
    labels.push(bet.label ?? `Bet ${i + 1}`);
  });

  const n = bets.length;
  const method: 'exact' | 'approximation' =
    n <= SIMULTANEOUS_KELLY_EXACT_MAX ? 'exact' : 'approximation';

  const solved =
    method === 'exact'
      ? exactSimultaneousKelly(probabilities, decimalOdds, maxTotal)
      : approximateSimultaneousKelly(probabilities, decimalOdds, maxTotal);

  // Apply fractional Kelly, then re-cap at maxTotal
  let fractions = projectOntoSimplexCap(
    solved.fractions.map((f) => f * kellyMult),
    maxTotal
  );

  // Zero out tiny numerical noise
  fractions = fractions.map((f) => (f < 1e-12 ? 0 : f));

  const finalFractions = roundFractionsRespectingCap(fractions, maxTotal);
  const totalFraction = roundFraction(finalFractions.reduce((s, x) => s + x, 0));

  // Log growth at the fractional point (exact path only when n is small enough)
  let logGrowth = 0;
  if (method === 'exact') {
    const { growth } = simultaneousLogGrowthAndGradient(finalFractions, probabilities, decimalOdds);
    logGrowth = Number.isFinite(growth) ? Math.round(growth * 1e8) / 1e8 : 0;
  }

  return {
    fractions: finalFractions,
    labels,
    totalFraction,
    logGrowth,
    method,
    dollars: (bankroll: number) => {
      if (!Number.isFinite(bankroll) || bankroll < 0) {
        throw new RangeError('bankroll must be a finite non-negative number');
      }
      return finalFractions.map((f) => Math.round(bankroll * f * 100) / 100);
    },
  };
}

/**
 * Mutually exclusive Kelly sizing (Smoczynski / Tomkins optimal-set algorithm).
 *
 * For betting several outcomes of the **same** event (futures, horse races, etc.)
 * where exactly one outcome can win. Sorts by expected revenue rate
 * `er_i = probability × decimalOdds`, grows the optimal set while
 * `er_k > R(S)`, then sets
 * `f_i = p_i − R(S) / decimalOdds_i` for members of the set (else 0).
 *
 * Probabilities across inputs must sum to ≤ 1 (residual mass is the “field”
 * you are not betting). A single +EV outcome reduces to classic Kelly.
 *
 * @param outcomes Array of `{ probability, decimalOdds, label? }`
 * @param opts Optional `maxTotal` (default 1) and fractional-Kelly `fraction` (default 1)
 *
 * @example
 * mutuallyExclusiveKelly([
 *   { probability: 0.40, decimalOdds: 3.0, label: 'Team A' },
 *   { probability: 0.25, decimalOdds: 5.0, label: 'Team B' },
 *   { probability: 0.10, decimalOdds: 15.0, label: 'Team C' },
 * ]);
 */
export function mutuallyExclusiveKelly(
  outcomes: MutuallyExclusiveOutcomeInput[],
  opts?: MutuallyExclusiveKellyOpts
): MutuallyExclusiveKellyResult {
  if (outcomes.length === 0) throw new RangeError('outcomes array must not be empty');
  const { maxTotal, fraction: kellyMult } = normalizeKellyCapOpts(opts);

  const probabilities: number[] = [];
  const decimalOdds: number[] = [];
  const labels: string[] = [];

  outcomes.forEach((o, i) => {
    assertWinProbability(o.probability);
    assertDecimalOdds(o.decimalOdds);
    probabilities.push(o.probability);
    decimalOdds.push(o.decimalOdds);
    labels.push(o.label ?? `Outcome ${i + 1}`);
  });

  const probSum = probabilities.reduce((s, p) => s + p, 0);
  if (probSum > 1 + 1e-12) {
    throw new RangeError('mutually exclusive probabilities must sum to at most 1');
  }

  // Expected revenue rates er_i = p_i * o_i; sort descending (stable by index)
  const order = probabilities
    .map((p, i) => ({ i, er: p * decimalOdds[i] }))
    .sort((a, b) => b.er - a.er || a.i - b.i);

  const inSet = new Array(outcomes.length).fill(false);
  let reserveRate = 1; // R(∅) = 1 when D = 1 (fixed-odds)
  const optimalSet: number[] = [];

  for (const { i, er } of order) {
    if (er > reserveRate) {
      inSet[i] = true;
      optimalSet.push(i);
      // R(S) = (1 − Σ_{k∈S} p_k) / (1 − Σ_{k∈S} 1/o_k)
      let sumP = 0;
      let sumBeta = 0;
      for (let j = 0; j < outcomes.length; j++) {
        if (!inSet[j]) continue;
        sumP += probabilities[j];
        sumBeta += 1 / decimalOdds[j];
      }
      const denom = 1 - sumBeta;
      if (!(denom > 0)) {
        // Degenerate book — back out this addition
        inSet[i] = false;
        optimalSet.pop();
        break;
      }
      reserveRate = (1 - sumP) / denom;
    } else {
      break; // subsequent candidates have even lower er
    }
  }

  let fractions = probabilities.map((p, i) => {
    if (!inSet[i]) return 0;
    return Math.max(0, p - reserveRate / decimalOdds[i]);
  });

  // Fractional Kelly + exposure cap
  fractions = projectOntoSimplexCap(
    fractions.map((f) => f * kellyMult),
    maxTotal
  ).map((f) => (f < 1e-12 ? 0 : f));

  const finalFractions = roundFractionsRespectingCap(fractions, maxTotal);

  // Drop from optimalSet any index that rounded to zero; return in input order
  const finalOptimalSet = optimalSet.filter((i) => finalFractions[i] > 0).sort((a, b) => a - b);

  return {
    fractions: finalFractions,
    labels,
    totalFraction: roundFraction(finalFractions.reduce((s, x) => s + x, 0)),
    optimalSet: finalOptimalSet,
    reserveRate: Math.round(reserveRate * 1e8) / 1e8,
    dollars: (bankroll: number) => {
      if (!Number.isFinite(bankroll) || bankroll < 0) {
        throw new RangeError('bankroll must be a finite non-negative number');
      }
      return finalFractions.map((f) => Math.round(bankroll * f * 100) / 100);
    },
  };
}

/**
 * Calculate the optimal fractional Kelly multiplier to maximize growth 
 * given a specific constraint on the probability of a drawdown.
 * 
 * @param edge The edge (EV per unit staked)
 * @param variance The variance of the returns
 * @param maxDrawdown The maximum drawdown allowed (e.g. 0.5 for 50%)
 * @param riskOfDrawdown The desired probability of hitting that drawdown (e.g. 0.1 for 10%)
 */
export function optimalFractionalKelly(
  edge: number,
  variance: number,
  maxDrawdown: number,
  riskOfDrawdown = 0.1
): number {
  if (!Number.isFinite(edge) || !Number.isFinite(variance) || !Number.isFinite(maxDrawdown) || !Number.isFinite(riskOfDrawdown)) {
    throw new RangeError('all arguments must be finite numbers');
  }
  if (edge <= 0) return 0;
  if (variance <= 0) {
    throw new RangeError('variance must be positive');
  }
  if (maxDrawdown <= 0 || maxDrawdown >= 1) {
    throw new RangeError('maxDrawdown must be between 0 and 1 exclusive');
  }
  if (riskOfDrawdown <= 0 || riskOfDrawdown >= 1) {
    throw new RangeError('riskOfDrawdown must be between 0 and 1 exclusive');
  }
  // Fractional Kelly multiplier constrained by drawdown risk:
  //   multiplier = ln(risk) / (ln(1 - maxDD) * (2 * edge / variance))
  const multiplier = Math.log(riskOfDrawdown) / (Math.log(1 - maxDrawdown) * (2 * edge / variance));
  return Math.max(0, Math.min(1, multiplier));
}

/**
 * Kelly sizing for a parlay (accumulator), treating all legs as a single bet.
 *
 * Combines each leg's true win probability and American odds into one
 * effective bet, then runs the standard Kelly formula against that combined
 * probability and combined odds. Legs are assumed independent.
 *
 * @param legs Array of `{ probability, americanOdds }` — your true win
 *             probability and the offered odds for each leg
 *
 * @example
 * kellyParlay([
 *   { probability: 0.55, americanOdds: -110 },
 *   { probability: 0.60, americanOdds: -120 },
 * ]);
 * // → { fraction: ..., combinedOdds: ..., trueWinProb: 0.33, ... }
 */
export function kellyParlay(
  legs: Array<{ probability: number; americanOdds: number }>
): KellyResult & { combinedOdds: number; combinedDecimal: number; trueWinProb: number } {
  if (legs.length === 0) throw new RangeError('legs array must not be empty');
  legs.forEach((leg) => {
    if (!Number.isFinite(leg.probability) || leg.probability <= 0 || leg.probability >= 1) {
      throw new RangeError('probability must be a finite number between 0 and 1 exclusive for every leg');
    }
  });

  const combinedDecimal = legs.reduce((acc, leg) => acc * toDecimal(leg.americanOdds), 1);
  const trueWinProb = legs.reduce((acc, leg) => acc * leg.probability, 1);
  const combinedOdds = toAmerican(combinedDecimal);

  const base = kelly(trueWinProb, combinedOdds);

  return {
    ...base,
    combinedOdds,
    combinedDecimal: Math.round(combinedDecimal * 1000) / 1000,
    trueWinProb: Math.round(trueWinProb * 10000) / 10000,
  };
}

// ─── Expected Value ───────────────────────────────────────────────────────────

/**
 * Calculate expected value of a bet.
 * @param winProbability Your estimated win probability
 * @param americanOdds  Offered odds
 * @param stake         Dollar amount wagered
 */
export function expectedValue(
  winProbability: number,
  americanOdds: number,
  stake = 1
): { ev: number; evPercent: number; breakEvenProb: number } {
  if (!Number.isFinite(winProbability) || winProbability < 0 || winProbability > 1) {
    throw new RangeError('winProbability must be a finite number between 0 and 1 inclusive');
  }
  if (!Number.isFinite(stake) || stake <= 0) {
    throw new RangeError('stake must be a positive finite number');
  }
  const decimal = toDecimal(americanOdds);
  const b = decimal - 1;
  const ev = stake * (b * winProbability - (1 - winProbability));
  return {
    ev: Math.round(ev * 100) / 100,
    evPercent: Math.round((ev / stake) * 10000) / 100,
    breakEvenProb: Math.round((1 / decimal) * 10000) / 10000,
  };
}

/**
 * Minimum win-probability edge over break-even needed for a target EV.
 *
 * Break-even win rate equals implied probability (`impliedProb`). This helper
 * answers the follow-up bettors ask constantly: how many probability points
 * above that line do I need for a given expected value per unit staked?
 *
 * @param americanOdds Offered American odds
 * @param targetEv     Desired EV as a fraction of stake (default 0 = break-even;
 *                     pass `0.05` for a 5% ROI target)
 * @returns Edge in probability points (0–1 scale), e.g. `0.0262` ≈ 2.62 pts
 *
 * @example
 * minEdge(-110)        // 0        — any edge beats break-even
 * minEdge(-110, 0.05)  // 0.0262   — need ~2.62 pts above implied for 5% EV
 * minEdge(+150, 0.10)  // 0.04     — need 4 pts above implied for 10% EV
 */
export function minEdge(americanOdds: number, targetEv = 0): number {
  if (!Number.isFinite(americanOdds) || americanOdds === 0) {
    throw new RangeError('americanOdds must be a finite non-zero number');
  }
  if (!Number.isFinite(targetEv)) {
    throw new RangeError('targetEv must be a finite number');
  }
  const decimal = toDecimal(americanOdds);
  // Max EV per unit stake is (decimal - 1); min is -1 (always lose)
  if (targetEv < -1 || targetEv > decimal - 1) {
    throw new RangeError(
      `targetEv must be between -1 and ${decimal - 1} (max EV at these odds) inclusive`
    );
  }
  // p* = (1 + targetEv) / decimal; edge = p* - 1/decimal = targetEv / decimal
  return Math.round((targetEv / decimal) * 10000) / 10000;
}

/**
 * Stake required to net a target profit if the bet wins.
 *
 * @param americanOdds Offered American odds
 * @param targetProfit Desired net profit on a win (dollars)
 * @returns Stake to place (dollars)
 *
 * @example
 * stakeForTargetProfit(-110, 100) // 110 — risk $110 to win $100 at -110
 * stakeForTargetProfit(+150, 75)  // 50  — risk $50 to win $75 at +150
 */
export function stakeForTargetProfit(americanOdds: number, targetProfit: number): number {
  if (!Number.isFinite(americanOdds) || americanOdds === 0) {
    throw new RangeError('americanOdds must be a finite non-zero number');
  }
  if (!Number.isFinite(targetProfit) || targetProfit <= 0) {
    throw new RangeError('targetProfit must be a positive finite number');
  }
  const b = toDecimal(americanOdds) - 1; // net odds
  return Math.round((targetProfit / b) * 100) / 100;
}

// ─── Closing Line Value ───────────────────────────────────────────────────────

/**
 * Measure Closing Line Value (CLV) — did you get better odds than closing?
 *
 * CLV is the strongest predictor of long-term betting profitability.
 * Consistently positive CLV = your line shopping / timing is beating the market.
 *
 * @param openLine   American odds when you bet
 * @param closeLine  American odds at market close
 */
export function clv(openLine: number, closeLine: number): CLVResult {
  const openProb = impliedProb(openLine);
  const closeProb = impliedProb(closeLine);
  const clvPercent = (closeProb - openProb) * 100; // positive = you got better line

  let verdict: CLVResult['verdict'];
  if (clvPercent >= 2) verdict = 'elite';
  else if (clvPercent >= 0.5) verdict = 'positive';
  else if (clvPercent >= -0.5) verdict = 'neutral';
  else verdict = 'negative';

  return {
    openLine,
    closeLine,
    clvPercent: Math.round(clvPercent * 100) / 100,
    beatClose: clvPercent > 0,
    verdict,
  };
}

export interface CLVSummary {
  avgCLV: number;
  beatCloseRate: number;
  verdict: string;
  totalBets: number;
}

function summarizeClvResults(results: CLVResult[]): CLVSummary {
  if (results.length === 0) {
    return {
      avgCLV: 0,
      beatCloseRate: 0,
      verdict: '⚪ Neutral — shopping more books may help',
      totalBets: 0,
    };
  }

  const avgCLV = results.reduce((sum, r) => sum + r.clvPercent, 0) / results.length;
  const beatCloseRate = results.filter((r) => r.beatClose).length / results.length;

  let verdict: string;
  if (avgCLV >= 2) verdict = '🏆 Elite — you are finding real edges before the market';
  else if (avgCLV >= 0.5) verdict = '✅ Positive — beating the market consistently';
  else if (avgCLV >= -0.5) verdict = '⚪ Neutral — shopping more books may help';
  else verdict = '🔴 Negative — your line timing and shopping needs work';

  return {
    avgCLV: Math.round(avgCLV * 100) / 100,
    beatCloseRate: Math.round(beatCloseRate * 10000) / 10000,
    verdict,
    totalBets: results.length,
  };
}

/**
 * Summarize CLV across a set of bets.
 */
export function clvSummary(
  bets: Array<{ openLine: number; closeLine: number }>
): CLVSummary {
  return summarizeClvResults(bets.map((b) => clv(b.openLine, b.closeLine)));
}

export interface RollingCLVWindow extends CLVSummary {
  /** Inclusive start index into the original bets array */
  startIndex: number;
  /** Inclusive end index into the original bets array */
  endIndex: number;
}

/**
 * Rolling-window CLV summary — one {@link CLVSummary} per contiguous window.
 *
 * Useful for spotting whether line-shopping edge is improving or eroding over
 * a season without waiting for the full sample.
 *
 * @param bets       Chronological open/close lines
 * @param windowSize Number of bets per window (must be ≥ 1)
 * @returns One entry per complete window; empty array if `bets.length < windowSize`
 *
 * @example
 * rollingClvSummary(seasonBets, 20);
 * // → [{ startIndex: 0, endIndex: 19, avgCLV: 0.8, ... }, ...]
 */
export function rollingClvSummary(
  bets: Array<{ openLine: number; closeLine: number }>,
  windowSize: number
): RollingCLVWindow[] {
  if (!Number.isInteger(windowSize) || windowSize < 1) {
    throw new RangeError('windowSize must be a positive integer');
  }
  if (bets.length < windowSize) return [];

  const windows: RollingCLVWindow[] = [];
  for (let start = 0; start <= bets.length - windowSize; start++) {
    const slice = bets.slice(start, start + windowSize);
    const summary = clvSummary(slice);
    windows.push({
      ...summary,
      startIndex: start,
      endIndex: start + windowSize - 1,
    });
  }
  return windows;
}

// ─── Bankroll Tracking ────────────────────────────────────────────────────────

/**
 * Calculate P&L for a single bet result.
 */
export function betPnL(stake: number, americanOdds: number, result: 'win' | 'loss' | 'push'): BetResult {
  if (!Number.isFinite(stake) || stake <= 0) {
    throw new RangeError('stake must be a positive finite number');
  }
  if (result !== 'win' && result !== 'loss' && result !== 'push') {
    throw new RangeError("result must be 'win', 'loss', or 'push'");
  }

  let pnl: number;
  if (result === 'win') {
    pnl = stake * (toDecimal(americanOdds) - 1);
  } else if (result === 'loss') {
    pnl = -stake;
  } else {
    pnl = 0;
  }

  return {
    stake,
    odds: americanOdds,
    result,
    pnl: Math.round(pnl * 100) / 100,
    roi: Math.round((pnl / stake) * 10000) / 10000,
  };
}

/**
 * Compute comprehensive bankroll statistics from a history of bets.
 * Includes Sharpe ratio to measure risk-adjusted returns.
 */
export function bankrollStats(
  bets: Array<{ stake: number; americanOdds: number; result: 'win' | 'loss' | 'push' }>,
  startingBankroll = 1000
): BankrollStats {
  let bankroll = startingBankroll;
  let peak = startingBankroll;
  let maxDrawdown = 0;
  let streak = 0;
  let streakType: 'win' | 'loss' | 'none' = 'none';

  const pnls = bets.map((b) => {
    const r = betPnL(b.stake, b.americanOdds, b.result);
    bankroll += r.pnl;
    if (bankroll > peak) peak = bankroll;
    const drawdown = (peak - bankroll) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    if (b.result === 'win') {
      streak = streakType === 'win' ? streak + 1 : 1;
      streakType = 'win';
    } else if (b.result === 'loss') {
      streak = streakType === 'loss' ? streak + 1 : 1;
      streakType = 'loss';
    }

    return r;
  });

  const wins = bets.filter((b) => b.result === 'win').length;
  const losses = bets.filter((b) => b.result === 'loss').length;
  const pushes = bets.filter((b) => b.result === 'push').length;
  const totalStaked = bets.reduce((sum, b) => sum + b.stake, 0);
  const netPnL = pnls.reduce((sum, r) => sum + r.pnl, 0);

  // Sharpe ratio: mean ROI per bet / std dev of ROI per bet, annualised
  const rois = pnls.map((r) => r.roi);
  const meanRoi = rois.reduce((s, r) => s + r, 0) / (rois.length || 1);
  const variance = rois.reduce((s, r) => s + Math.pow(r - meanRoi, 2), 0) / (rois.length || 1);
  const stdDev = Math.sqrt(variance);
  // Annualise assuming 365 bets per year
  const sharpeRatio = stdDev > 0
    ? Math.round((meanRoi / stdDev) * Math.sqrt(365) * 100) / 100
    : 0;

  return {
    totalBets: bets.length,
    wins,
    losses,
    pushes,
    winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 10000) / 10000 : 0,
    totalStaked: Math.round(totalStaked * 100) / 100,
    netPnL: Math.round(netPnL * 100) / 100,
    roi: totalStaked > 0 ? Math.round((netPnL / totalStaked) * 10000) / 10000 : 0,
    peakBankroll: Math.round(peak * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 10000) / 10000,
    currentStreak: streak,
    streakType,
    sharpeRatio,
  };
}

// ─── Arbitrage Detection ──────────────────────────────────────────────────────

/**
 * Detect and calculate an arbitrage opportunity across two books.
 *
 * An arbitrage (arb) exists when the combined implied probabilities of both
 * sides sum to less than 1.0, guaranteeing profit regardless of outcome.
 *
 * @param oddsA  American odds for side A (best available)
 * @param oddsB  American odds for side B (best available)
 * @param totalStake Total amount to split across both sides
 *
 * @example
 * // BetMGM has Team A at +105, FanDuel has Team B at +102
 * arbitrage(105, 102, 1000);
 * // → { hasArb: true, profitPct: 1.7, stakeA: 488, stakeB: 512 }
 */
export function arbitrage(oddsA: number, oddsB: number, totalStake = 1000): ArbitrageResult {
  const pA = impliedProb(oddsA);
  const pB = impliedProb(oddsB);
  const overround = pA + pB;
  const hasArb = overround < 1.0;

  // Optimal stakes: stakeA / stakeB = decimalB / decimalA
  const dA = toDecimal(oddsA);
  const dB = toDecimal(oddsB);
  const stakeA = Math.round((totalStake * dB) / (dA + dB) * 100) / 100;
  const stakeB = Math.round((totalStake - stakeA) * 100) / 100;

  // Guaranteed profit = (1 / overround - 1) * totalStake
  const profitPct = hasArb
    ? Math.round(((1 / overround) - 1) * 10000) / 100
    : 0;

  return {
    hasArb,
    profitPct,
    stakeA,
    stakeB,
    overround: Math.round(overround * 10000) / 10000,
  };
}

// ─── Parlay Analysis ──────────────────────────────────────────────────────────

/**
 * Analyse a multi-leg parlay for true EV and win probability.
 *
 * Uses no-vig probabilities per leg to compute the true combined win
 * probability, then compares it against the parlay's implied probability
 * to surface whether the parlay has positive expected value.
 *
 * @param legs Array of objects with americanOdds and optional oppOdds for vig removal
 *
 * @example
 * parlayAnalysis([
 *   { americanOdds: -110, oppOdds: -110 },
 *   { americanOdds: +150, oppOdds: -175 },
 * ]);
 */
export function parlayAnalysis(
  legs: Array<{ americanOdds: number; oppOdds?: number }>
): ParlayResult {
  if (legs.length === 0) throw new RangeError('legs array must not be empty');

  // Combined decimal odds
  const combinedDecimal = legs.reduce((acc, leg) => acc * toDecimal(leg.americanOdds), 1);
  const combinedOdds = toAmerican(combinedDecimal);
  const impliedWinProb = 1 / combinedDecimal;

  // True win probability: product of no-vig probs per leg
  const trueWinProb = legs.reduce((acc, leg) => {
    if (leg.oppOdds !== undefined) {
      const { prob1 } = removeVig(leg.americanOdds, leg.oppOdds);
      return acc * prob1;
    }
    // Fallback: use implied prob (conservative)
    return acc * impliedProb(leg.americanOdds);
  }, 1);

  const ev100 = Math.round((trueWinProb * (combinedDecimal - 1) * 100 - (1 - trueWinProb) * 100) * 100) / 100;

  return {
    combinedOdds,
    combinedDecimal: Math.round(combinedDecimal * 1000) / 1000,
    trueWinProb: Math.round(trueWinProb * 10000) / 10000,
    impliedWinProb: Math.round(impliedWinProb * 10000) / 10000,
    ev100,
    hasEdge: ev100 > 0,
    legs: legs.length,
  };
}

// ─── DFS Helpers ──────────────────────────────────────────────────────────────

/**
 * Calculate ownership leverage score for DFS tournaments.
 * Higher score = more valuable as a contrarian play.
 */
export function ownershipLeverage(projectedPoints: number, ownershipPct: number): number {
  return Math.round((projectedPoints / (ownershipPct + 1)) * 100) / 100;
}

/**
 * Stack correlation bonus for NFL DFS game stacks.
 */
export function stackBonus(
  qbProj: number,
  receiverProj: number,
  correlation = 0.35
): number {
  return Math.round(correlation * Math.sqrt(qbProj * receiverProj) * 0.15 * 100) / 100;
}

// ─── Monte Carlo Simulation ───────────────────────────────────────────────────

/**
 * Simulate Kelly bankroll growth via Monte Carlo sampling.
 *
 * Runs `paths` independent sequences of `betsPerPath` bets, each staking
 * `kellyMultiplier` × full-Kelly fraction of the current bankroll per bet.
 * Returns percentile distribution of final bankrolls and the ruin rate
 * (fraction of paths that fell below 10% of starting bankroll at any point).
 *
 * @param winProbability  True win probability (0–1)
 * @param americanOdds    Offered odds
 * @param betsPerPath     Number of sequential bets per simulation path (default 500)
 * @param paths           Number of Monte Carlo paths (default 2000)
 * @param startingBankroll Starting bankroll in dollars (default 1000)
 * @param kellyMultiplier Fractional Kelly multiplier — 1.0 = full Kelly, 0.5 = half (default 0.5)
 * @param seed            Optional integer seed for reproducible results
 *
 * @example
 * const sim = simulateGrowth(0.55, -110, 500, 2000, 1000, 0.5);
 * console.log(sim.medianFinal);   // e.g. 2840
 * console.log(sim.ruinRate);      // e.g. 0.003
 */
export function simulateGrowth(
  winProbability: number,
  americanOdds: number,
  betsPerPath = 500,
  paths = 2000,
  startingBankroll = 1000,
  kellyMultiplier = 0.5,
  seed?: number
): SimulationResult {
  if (!Number.isFinite(winProbability) || winProbability <= 0 || winProbability >= 1) {
    throw new RangeError('winProbability must be a finite number between 0 and 1 exclusive');
  }
  if (!Number.isFinite(americanOdds) || americanOdds === 0) {
    throw new RangeError('americanOdds must be a finite non-zero number');
  }
  if (betsPerPath < 1 || !Number.isInteger(betsPerPath)) {
    throw new RangeError('betsPerPath must be a positive integer');
  }
  if (paths < 1 || !Number.isInteger(paths)) {
    throw new RangeError('paths must be a positive integer');
  }

  const b = toDecimal(americanOdds) - 1;
  const fullKellyFraction = Math.max(0, (b * winProbability - (1 - winProbability)) / b);
  const fraction = fullKellyFraction * kellyMultiplier;

  // Simple seeded pseudo-random (mulberry32) for reproducibility
  let s = seed !== undefined ? (seed | 0) : (Date.now() | 0);
  function rand(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  }

  const RUIN_THRESHOLD = 0.1; // bankroll < 10% of start = practical ruin
  const finals: number[] = [];
  const maxDrawdowns: number[] = [];
  let ruinCount = 0;

  for (let p = 0; p < paths; p++) {
    let bankroll = startingBankroll;
    let peak = startingBankroll;
    let maxDD = 0;
    let ruined = false;

    for (let bet = 0; bet < betsPerPath; bet++) {
      if (bankroll <= 0) { ruined = true; break; }
      const stake = bankroll * fraction;
      const win = rand() < winProbability;
      bankroll += win ? stake * b : -stake;
      if (bankroll > peak) peak = bankroll;
      const dd = (peak - bankroll) / peak;
      if (dd > maxDD) maxDD = dd;
      if (bankroll < startingBankroll * RUIN_THRESHOLD) { ruined = true; break; }
    }

    finals.push(Math.max(0, bankroll));
    maxDrawdowns.push(maxDD);
    if (ruined) ruinCount++;
  }

  finals.sort((a, b) => a - b);
  maxDrawdowns.sort((a, b) => a - b);

  const pct = (arr: number[], p: number) => arr[Math.floor(arr.length * p)];
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    medianFinal: round2(pct(finals, 0.5)),
    p10: round2(pct(finals, 0.1)),
    p25: round2(pct(finals, 0.25)),
    p75: round2(pct(finals, 0.75)),
    p90: round2(pct(finals, 0.9)),
    ruinRate: Math.round((ruinCount / paths) * 10000) / 10000,
    medianMaxDrawdown: Math.round(pct(maxDrawdowns, 0.5) * 10000) / 10000,
    startingBankroll,
    betsPerPath,
    paths,
  };
}

// ─── Line Shopping ────────────────────────────────────────────────────────────

/**
 * Find the best available odds across multiple sportsbooks for a single side.
 *
 * Higher American odds = better for the bettor (more profit per dollar risked).
 * The function ranks all books, calculates how much edge you gain by shopping
 * vs. taking the worst available line, and surfaces the winner.
 *
 * @param books Array of `{ book, odds }` objects — one entry per sportsbook
 *
 * @example
 * lineShop([
 *   { book: 'DraftKings', odds: -112 },
 *   { book: 'FanDuel',    odds: -108 },
 *   { book: 'BetMGM',     odds: -115 },
 * ]);
 * // → { bestBook: 'FanDuel', bestOdds: -108, shoppingEdgePct: 0.74, ... }
 */
export function lineShop(
  books: Array<{ book: string; odds: number }>
): LineShopResult {
  if (books.length === 0) throw new RangeError('books array must not be empty');

  const ranked = books
    .map((b) => ({
      book: b.book,
      odds: b.odds,
      impliedProb: Math.round(impliedProb(b.odds) * 10000) / 10000,
    }))
    // Sort: higher odds = more favourable for bettor
    // For American odds: +200 > +150 > -110 > -200
    // Convert to decimal for comparison
    .sort((a, b) => toDecimal(b.odds) - toDecimal(a.odds));

  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  // Shopping edge: how much implied probability you saved vs. worst book
  const shoppingEdgePct =
    Math.round((worst.impliedProb - best.impliedProb) * 10000) / 100;

  return {
    bestOdds: best.odds,
    bestBook: best.book,
    impliedProbAtBest: best.impliedProb,
    ranked,
    shoppingEdgePct,
  };
}

// ─── Market Consensus ─────────────────────────────────────────────────────────

export interface MarketConsensusResult {
  /** Consensus no-vig probability for side 1, averaged across all books */
  prob1: number;
  /** Consensus no-vig probability for side 2, averaged across all books */
  prob2: number;
  /** Fair American odds implied by consensus prob1 */
  fairOdds1: number;
  /** Fair American odds implied by consensus prob2 */
  fairOdds2: number;
  /** Number of books included in the consensus */
  bookCount: number;
  /**
   * Standard deviation of per-book de-vigged prob1 across books.
   * Low = tight market consensus. High = books disagree (softer market).
   */
  disagreement: number;
  /** Per-book breakdown of de-vigged probabilities */
  books: Array<{ book: string; deVigProb1: number; deVigProb2: number; vig: number }>;
}

export interface PoissonResult {
  /** Win probability for side 1 (home / team A) */
  winProb: number;
  /** Draw / tie probability */
  drawProb: number;
  /** Win probability for side 2 (away / team B) */
  lossProb: number;
  /** P(combined total > n) — pass any real line, e.g. 2.5 */
  overProb: (n: number) => number;
  /** P(combined total < n) */
  underProb: (n: number) => number;
  /** Joint score probability matrix indexed [home_goals][away_goals] */
  scoreMatrix: number[][];
  /** Most likely exact score under the model */
  modeScore: { home: number; away: number; prob: number };
  /** Vig-free American odds for side 1 win */
  fairOdds1: number;
  /** Vig-free American odds for draw */
  fairOddsDraw: number;
  /** Vig-free American odds for side 2 win */
  fairOdds2: number;
}

export interface GrowthRateResult {
  /**
   * Expected log bankroll growth per bet:
   *   g(f) = p·ln(1 + b·f) + (1−p)·ln(1 − f)
   * Positive = growing bankroll. Negative = overbetting (bankroll shrinks).
   */
  logGrowthRate: number;
  /** Per-bet bankroll multiplier: exp(logGrowthRate) */
  growthMultiplier: number;
  /** Expected bankroll after n bets: startingBankroll × exp(g × n) */
  projectedBankroll: (nBets: number, startingBankroll?: number) => number;
  /** Full-Kelly fraction — the theoretically optimal stake */
  optimalFraction: number;
  /** True if current fraction exceeds full Kelly (growth rate is falling) */
  isOverbetting: boolean;
  /** Current fraction expressed as a multiple of full Kelly (0.5 = half-Kelly) */
  fractionOfOptimal: number;
}

export interface DutchResult {
  /** True if dutching guarantees a net profit (combined implied prob < 1.0) */
  isProfit: boolean;
  /** Guaranteed return as a % of totalStake (+ve = profit, -ve = loss) */
  guaranteedReturnPct: number;
  /** Optimal stake per outcome so every winner pays back the same gross amount */
  stakes: Array<{
    label: string;
    stake: number;
    odds: number;
    /** Gross return if this outcome wins */
    returnIfWin: number;
  }>;
  /** Sum of stakes across all outcomes */
  totalStake: number;
  /**
   * Sum of implied probabilities across all outcomes.
   * < 1.0 → profitable dutch. > 1.0 → book has vig (dutch loses money).
   */
  overround: number;
}


/** Internal: convert a no-vig probability to American odds */
function probToAmerican(p: number): number {
  if (p <= 0) return 10000;
  if (p >= 1) return -10000;
  // Exactly 0.5 → +100 (even money); favorites use the negative form
  if (p > 0.5) return Math.round((-p / (1 - p)) * 100);
  return Math.round(((1 - p) / p) * 100);
}

/**
 * Build a consensus no-vig probability from multiple sportsbooks' two-sided lines.
 *
 * Each book's market is de-vigged independently, then probabilities are
 * averaged. The result is sharper than any single book's de-vigged number
 * because random and systematic biases across books cancel out.
 *
 * @example
 * marketConsensus([
 *   { book: 'Pinnacle',   side1Odds: -108, side2Odds: -104 },
 *   { book: 'DraftKings', side1Odds: -112, side2Odds: +100 },
 *   { book: 'FanDuel',    side1Odds: -110, side2Odds: -102 },
 * ]);
 * // → { prob1: 0.5208, prob2: 0.4792, fairOdds1: -109, fairOdds2: +109 }
 */
export function marketConsensus(
  books: Array<{ book: string; side1Odds: number; side2Odds: number }>
): MarketConsensusResult {
  if (books.length === 0) throw new RangeError('books array must not be empty');

  const bookResults = books.map((b) => {
    const { prob1, prob2, vig } = removeVig(b.side1Odds, b.side2Odds);
    return { book: b.book, deVigProb1: prob1, deVigProb2: prob2, vig };
  });

  const probs1 = bookResults.map((r) => r.deVigProb1);
  const avgProb1 = probs1.reduce((s, p) => s + p, 0) / probs1.length;
  const avgProb2 = 1 - avgProb1;

  const variance = probs1.reduce((s, p) => s + Math.pow(p - avgProb1, 2), 0) / probs1.length;
  const disagreement = Math.round(Math.sqrt(variance) * 10000) / 10000;

  return {
    prob1: Math.round(avgProb1 * 10000) / 10000,
    prob2: Math.round(avgProb2 * 10000) / 10000,
    fairOdds1: probToAmerican(avgProb1),
    fairOdds2: probToAmerican(avgProb2),
    bookCount: books.length,
    disagreement,
    books: bookResults,
  };
}

// ─── Poisson Model ────────────────────────────────────────────────────────────

/** Internal: Poisson probability mass function P(k; λ) */
function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let prob = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) prob = (prob * lambda) / i;
  return prob;
}

/**
 * Poisson model for match outcomes and totals betting.
 *
 * Models goals/runs/points for each side as independent Poisson random variables
 * with means lambda1 and lambda2. Returns win/draw/loss probabilities, over/under
 * functions for any line, the full score probability matrix, and fair odds.
 *
 * Inputs: season-average goals (or runs, points) per game per team.
 *
 * @param lambda1  Expected score for side 1 (home/team A), e.g. 1.6 goals
 * @param lambda2  Expected score for side 2 (away/team B), e.g. 1.1 goals
 * @param maxGoals Max goals per side to model (default 10 — tail probability < 0.01%)
 *
 * @example
 * const m = poissonModel(1.6, 1.1);
 * m.winProb           // 0.5001
 * m.overProb(2.5)     // 0.4638  (need ≥ 3 goals combined)
 * m.modeScore         // { home: 1, away: 0, prob: 0.1742 }
 * m.fairOdds1         // -200  (side 1 is a heavy favourite)
 */
export function poissonModel(
  lambda1: number,
  lambda2: number,
  maxGoals = 10
): PoissonResult {
  if (lambda1 <= 0 || lambda2 <= 0) {
    throw new RangeError('lambda values must be positive');
  }

  const pmf1 = Array.from({ length: maxGoals + 1 }, (_, k) => poissonPMF(k, lambda1));
  const pmf2 = Array.from({ length: maxGoals + 1 }, (_, k) => poissonPMF(k, lambda2));

  const scoreMatrix: number[][] = Array.from({ length: maxGoals + 1 }, (_, i) =>
    Array.from({ length: maxGoals + 1 }, (_, j) => pmf1[i] * pmf2[j])
  );

  let winProb = 0, drawProb = 0, lossProb = 0;
  let modeProb = 0, modeHome = 0, modeAway = 0;

  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const p = scoreMatrix[i][j];
      if (i > j) winProb += p;
      else if (i === j) drawProb += p;
      else lossProb += p;
      if (p > modeProb) { modeProb = p; modeHome = i; modeAway = j; }
    }
  }

  const round4 = (n: number) => Math.round(n * 10000) / 10000;

  return {
    winProb: round4(winProb),
    drawProb: round4(drawProb),
    lossProb: round4(lossProb),
    overProb: (n: number) => {
      let p = 0;
      for (let i = 0; i <= maxGoals; i++)
        for (let j = 0; j <= maxGoals; j++)
          if (i + j > n) p += scoreMatrix[i][j];
      return round4(p);
    },
    underProb: (n: number) => {
      let p = 0;
      for (let i = 0; i <= maxGoals; i++)
        for (let j = 0; j <= maxGoals; j++)
          if (i + j < n) p += scoreMatrix[i][j];
      return round4(p);
    },
    scoreMatrix,
    modeScore: { home: modeHome, away: modeAway, prob: round4(modeProb) },
    fairOdds1: probToAmerican(winProb),
    fairOddsDraw: probToAmerican(drawProb),
    fairOdds2: probToAmerican(lossProb),
  };
}

// ─── Kelly Growth Rate ────────────────────────────────────────────────────────

/**
 * Calculate the theoretical per-bet log bankroll growth rate for a given Kelly fraction.
 *
 * The formula g(f) = p·ln(1+b·f) + (1−p)·ln(1−f) is the expected log-growth
 * per bet. It peaks at full Kelly (f*) and decreases on either side — bets
 * above 2×f* produce negative expected log growth, meaning the bankroll shrinks.
 *
 * Use this to compare strategies: zero, quarter-Kelly, half-Kelly, full Kelly.
 *
 * @param winProbability True win probability (0–1)
 * @param americanOdds   Offered odds
 * @param fraction       Fraction of bankroll to stake per bet (0 to <1)
 *
 * @example
 * kellyGrowthRate(0.55, -110, 0.059)   // half-Kelly
 * // → { logGrowthRate: 0.00248, growthMultiplier: 1.00248, isOverbetting: false }
 * kellyGrowthRate(0.55, -110, 0.118)   // full Kelly (maximum)
 * // → { logGrowthRate: 0.00249, isOverbetting: false }
 * kellyGrowthRate(0.55, -110, 0.25)    // overbetting
 * // → { logGrowthRate: -0.003, isOverbetting: true }
 */
export function kellyGrowthRate(
  winProbability: number,
  americanOdds: number,
  fraction: number
): GrowthRateResult {
  if (!Number.isFinite(winProbability) || winProbability <= 0 || winProbability >= 1) {
    throw new RangeError('winProbability must be a finite number between 0 and 1 exclusive');
  }
  if (!Number.isFinite(americanOdds) || americanOdds === 0) {
    throw new RangeError('americanOdds must be a finite non-zero number');
  }
  if (!Number.isFinite(fraction) || fraction < 0 || fraction >= 1) {
    throw new RangeError('fraction must be a finite number in [0, 1)');
  }

  const b = toDecimal(americanOdds) - 1;
  const p = winProbability;
  const q = 1 - p;

  const g = fraction === 0
    ? 0
    : p * Math.log(1 + b * fraction) + q * Math.log(1 - fraction);

  const optimalFraction = Math.max(0, Math.round(((b * p - q) / b) * 10000) / 10000);

  return {
    logGrowthRate: Math.round(g * 1e8) / 1e8,
    growthMultiplier: Math.round(Math.exp(g) * 1e8) / 1e8,
    projectedBankroll: (nBets: number, startingBankroll = 1000) => {
      if (!Number.isFinite(nBets) || nBets < 0) {
        throw new RangeError('nBets must be a non-negative number');
      }
      return Math.round(startingBankroll * Math.exp(g * nBets) * 100) / 100;
    },
    optimalFraction,
    isOverbetting: fraction > optimalFraction && optimalFraction > 0,
    fractionOfOptimal: optimalFraction > 0
      ? Math.round((fraction / optimalFraction) * 10000) / 10000
      : 0,
  };
}

// ─── Dutching ─────────────────────────────────────────────────────────────────

/**
 * Calculate Dutch betting stakes — spread a total stake across N outcomes so
 * every winner pays back the same gross amount.
 *
 * Profitable when the combined implied probability across all outcomes < 1.0
 * (a multi-outcome arb). Common in horse racing and markets with many runners
 * when using best-available odds from multiple books.
 *
 * @param outcomes   `{ label, americanOdds }` per outcome — use best line per outcome
 * @param totalStake Budget to spread across all outcomes (default 1000)
 *
 * @example
 * dutching([
 *   { label: 'Horse A', americanOdds: +200 },
 *   { label: 'Horse B', americanOdds: +350 },
 *   { label: 'Horse C', americanOdds: +500 },
 * ], 1000);
 * // → { isProfit: true, guaranteedReturnPct: 12.5, stakes: [...] }
 */
export function dutching(
  outcomes: Array<{ label: string; americanOdds: number }>,
  totalStake = 1000
): DutchResult {
  if (outcomes.length === 0) throw new RangeError('outcomes array must not be empty');
  if (!Number.isFinite(totalStake) || totalStake <= 0) {
    throw new RangeError('totalStake must be a positive finite number');
  }

  const decimals = outcomes.map((o) => toDecimal(o.americanOdds));
  // overround = sum(1 / decimal_i) = sum of implied probabilities
  const overround = decimals.reduce((s, d) => s + 1 / d, 0);

  // Guaranteed gross return = totalStake / overround
  const guaranteedReturn = totalStake / overround;
  const guaranteedReturnPct = Math.round(((guaranteedReturn / totalStake) - 1) * 10000) / 100;

  const stakes = outcomes.map((o, i) => {
    const stake = Math.round((guaranteedReturn / decimals[i]) * 100) / 100;
    return {
      label: o.label,
      stake,
      odds: o.americanOdds,
      returnIfWin: Math.round(stake * decimals[i] * 100) / 100,
    };
  });

  return {
    isProfit: overround < 1.0,
    guaranteedReturnPct,
    stakes,
    totalStake,
    overround: Math.round(overround * 10000) / 10000,
  };
}

// ─── Hedge Bet ────────────────────────────────────────────────────────────────

export interface HedgeResult {
  /** Stake to place on the opposite side to lock in equal gross returns */
  hedgeStake: number;
  /** Guaranteed net profit regardless of which outcome wins */
  guaranteedProfit: number;
  /** True when the hedge produces a net positive return */
  isProfit: boolean;
  /** Combined ROI on all money committed (original + hedge) */
  roi: number;
  /** Total capital at risk across both legs */
  totalRisked: number;
  /** Gross payout from whichever side wins (identical for both scenarios) */
  grossReturn: number;
}

/**
 * Calculate the hedge stake that locks in an equal guaranteed return on an
 * existing bet when the opposite side is now available at better odds.
 *
 * The classic scenario: you placed an early-season bet on an underdog at +300;
 * they reach the final and the opposite side now offers +100. Hedging lets you
 * guarantee a profit no matter who wins.
 *
 * The formula equalises the gross payout for both outcomes:
 *   `hedgeStake = originalStake × decimal(originalOdds) / decimal(hedgeOdds)`
 *
 * Profit is positive when the original odds are long enough that gross return
 * exceeds combined stakes. See `arbitrage()` for the symmetric two-sided case.
 *
 * @param originalStake       Amount placed on your original bet
 * @param originalAmericanOdds American odds at which you placed the original bet
 * @param hedgeAmericanOdds   Current American odds on the opposite outcome
 *
 * @example
 * // Bet $100 at +300 pre-season; they made the final, opposite now at +100
 * hedgeBet(100, 300, 100);
 * // → { hedgeStake: 200, guaranteedProfit: 100, isProfit: true, roi: 0.333 }
 */
export function hedgeBet(
  originalStake: number,
  originalAmericanOdds: number,
  hedgeAmericanOdds: number,
): HedgeResult {
  if (!Number.isFinite(originalStake) || originalStake <= 0) {
    throw new RangeError('originalStake must be a positive finite number');
  }

  const dOrig = toDecimal(originalAmericanOdds);
  const dHedge = toDecimal(hedgeAmericanOdds);

  const grossReturn = Math.round(originalStake * dOrig * 100) / 100;
  const hedgeStake = Math.round((grossReturn / dHedge) * 100) / 100;
  const totalRisked = Math.round((originalStake + hedgeStake) * 100) / 100;
  const guaranteedProfit = Math.round((grossReturn - totalRisked) * 100) / 100;

  return {
    hedgeStake,
    guaranteedProfit,
    isProfit: guaranteedProfit > 0,
    roi: totalRisked > 0 ? Math.round((guaranteedProfit / totalRisked) * 10000) / 10000 : 0,
    totalRisked,
    grossReturn,
  };
}
