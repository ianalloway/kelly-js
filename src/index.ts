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

// ─── Odds Conversion ──────────────────────────────────────────────────────────

/**
 * Convert American odds to implied probability (includes vig).
 * @example impliedProb(-110) // 0.5238
 */
export function impliedProb(american: number): number {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}

/**
 * Convert American odds to decimal odds.
 * @example toDecimal(-110) // 1.909
 */
export function toDecimal(american: number): number {
  if (american === 0) throw new RangeError('American odds cannot be zero');
  if (american > 0) return american / 100 + 1;
  return 100 / Math.abs(american) + 1;
}

/**
 * Convert decimal odds to American odds.
 * @example toAmerican(1.909) // -110
 */
export function toAmerican(decimal: number): number {
  if (decimal <= 1) throw new RangeError('Decimal odds must be greater than 1');
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

/**
 * Full odds conversion — American → decimal, fractional, implied prob.
 */
export function convertOdds(american: number, vigRemoval = false): OddsConversion {
  const implied = impliedProb(american);
  const decimal = toDecimal(american);
  const absAmerican = Math.abs(american);

  // Fractional approximation
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const num = american > 0 ? american : 100;
  const den = american > 0 ? 100 : absAmerican;
  const g = gcd(num, den);
  const fractional = `${num / g}/${den / g}`;

  return {
    american,
    decimal: Math.round(decimal * 1000) / 1000,
    fractional,
    impliedProbability: Math.round(implied * 10000) / 10000,
    ...(vigRemoval ? { noVigProbability: implied } : {}),
  };
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
  if (winProbability <= 0 || winProbability >= 1) {
    throw new RangeError('winProbability must be between 0 and 1 exclusive');
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
  };
}

/**
 * Kelly sizing with multiple simultaneous bets (fractional Kelly portfolio).
 * Scales each bet so the total portfolio exposure stays within max exposure.
 */
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
  if (edge <= 0) return 0;
  // Based on the formula: f = (2 * edge / variance) * (ln(riskOfDrawdown) / ln(1 - maxDrawdown))
  // Simplified version for betting: f = edge / variance
  const fullKelly = edge / variance;
  const multiplier = Math.log(riskOfDrawdown) / (Math.log(1 - maxDrawdown) * (2 * edge / variance));
  return Math.max(0, Math.min(1, multiplier));
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
  const b = toDecimal(americanOdds) - 1;
  const ev = stake * (b * winProbability - (1 - winProbability));
  return {
    ev: Math.round(ev * 100) / 100,
    evPercent: Math.round((ev / stake) * 10000) / 100,
    breakEvenProb: Math.round((1 / toDecimal(americanOdds)) * 10000) / 10000,
  };
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

/**
 * Summarize CLV across a set of bets.
 */
export function clvSummary(
  bets: Array<{ openLine: number; closeLine: number }>
): {
  avgCLV: number;
  beatCloseRate: number;
  verdict: string;
  totalBets: number;
} {
  if (bets.length === 0) {
    return {
      avgCLV: 0,
      beatCloseRate: 0,
      verdict: '⚪ Neutral — shopping more books may help',
      totalBets: 0,
    };
  }

  const results = bets.map((b) => clv(b.openLine, b.closeLine));
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
    totalBets: bets.length,
  };
}

// ─── Bankroll Tracking ────────────────────────────────────────────────────────

/**
 * Calculate P&L for a single bet result.
 */
export function betPnL(stake: number, americanOdds: number, result: 'win' | 'loss' | 'push'): BetResult {
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

// ─── Odds Conversion ──────────────────────────────────────────────────────────

/**
 * Convert American odds to implied probability (includes vig).
 * @example impliedProb(-110) // 0.5238
 */
export function impliedProb(american: number): number {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}

/**
 * Convert American odds to decimal odds.
 * @example toDecimal(-110) // 1.909
 */
export function toDecimal(american: number): number {
  if (american === 0) throw new RangeError('American odds cannot be zero');
  if (american > 0) return american / 100 + 1;
  return 100 / Math.abs(american) + 1;
}

/**
 * Convert decimal odds to American odds.
 * @example toAmerican(1.909) // -110
 */
export function toAmerican(decimal: number): number {
  if (decimal <= 1) throw new RangeError('Decimal odds must be greater than 1');
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

/**
 * Full odds conversion — American → decimal, fractional, implied prob.
 */
export function convertOdds(american: number, vigRemoval = false): OddsConversion {
  const implied = impliedProb(american);
  const decimal = toDecimal(american);
  const absAmerican = Math.abs(american);

  // Fractional approximation
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const num = american > 0 ? american : 100;
  const den = american > 0 ? 100 : absAmerican;
  const g = gcd(num, den);
  const fractional = `${num / g}/${den / g}`;

  return {
    american,
    decimal: Math.round(decimal * 1000) / 1000,
    fractional,
    impliedProbability: Math.round(implied * 10000) / 10000,
    ...(vigRemoval ? { noVigProbability: implied } : {}),
  };
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
  if (winProbability <= 0 || winProbability >= 1) {
    throw new RangeError('winProbability must be between 0 and 1 exclusive');
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
    dollars: (bankroll: number) => Math.round(bankroll * fraction * 100) / 100,
    halfDollars: (bankroll: number) => Math.round(bankroll * fraction * 50) / 100,
    ev: Math.round(ev * 10000) / 10000,
    edge: Math.round(edge * 10000) / 10000,
    hasEdge: ev > 0,
  };
}

/**
 * Kelly sizing with multiple simultaneous bets (fractional Kelly portfolio).
 * Scales each bet so the total portfolio exposure stays within max exposure.
 */
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
  if (edge <= 0) return 0;
  // Based on the formula: f = (2 * edge / variance) * (ln(riskOfDrawdown) / ln(1 - maxDrawdown))
  // Simplified version for betting: f = edge / variance
  const fullKelly = edge / variance;
  const multiplier = Math.log(riskOfDrawdown) / (Math.log(1 - maxDrawdown) * (2 * edge / variance));
  return Math.max(0, Math.min(1, multiplier));
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
  const b = toDecimal(americanOdds) - 1;
  const ev = stake * (b * winProbability - (1 - winProbability));
  return {
    ev: Math.round(ev * 100) / 100,
    evPercent: Math.round((ev / stake) * 10000) / 100,
    breakEvenProb: Math.round((1 / toDecimal(americanOdds)) * 10000) / 10000,
  };
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

/**
 * Summarize CLV across a set of bets.
 */
export function clvSummary(
  bets: Array<{ openLine: number; closeLine: number }>
): {
  avgCLV: number;
  beatCloseRate: number;
  verdict: string;
  totalBets: number;
} {
  if (bets.length === 0) {
    return {
      avgCLV: 0,
      beatCloseRate: 0,
      verdict: '⚪ Neutral — shopping more books may help',
      totalBets: 0,
    };
  }

  const results = bets.map((b) => clv(b.openLine, b.closeLine));
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
    totalBets: bets.length,
  };
}

// ─── Bankroll Tracking ────────────────────────────────────────────────────────

/**
 * Calculate P&L for a single bet result.
 */
export function betPnL(stake: number, americanOdds: number, result: 'win' | 'loss' | 'push'): BetResult {
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
