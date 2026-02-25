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
  if (american > 0) return american / 100 + 1;
  return 100 / Math.abs(american) + 1;
}

/**
 * Convert decimal odds to American odds.
 * @example toAmerican(1.909) // -110
 */
export function toAmerican(decimal: number): number {
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
export function kellyPortfolio(
  bets: Array<{ winProbability: number; americanOdds: number; label?: string }>,
  maxExposure = 0.25
): Array<{ label: string; fraction: number; dollars: (bankroll: number) => number; ev: number }> {
  const results = bets.map((bet, i) => ({
    label: bet.label ?? `Bet ${i + 1}`,
    ...kelly(bet.winProbability, bet.americanOdds),
  }));

  const totalFraction = results.reduce((sum, r) => sum + r.fraction, 0);
  const scale = totalFraction > maxExposure ? maxExposure / totalFraction : 1;

  return results.map((r) => ({
    label: r.label,
    fraction: Math.round(r.fraction * scale * 10000) / 10000,
    dollars: (bankroll: number) => Math.round(bankroll * r.fraction * scale * 100) / 100,
    ev: r.ev,
  }));
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
