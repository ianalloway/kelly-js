/**
 * kelly-js — Kelly Criterion & sports betting analytics library
 * by Ian Alloway <ian@allowayllc.com>
 * MIT License
 */
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
/**
 * Convert American odds to implied probability (includes vig).
 * @example impliedProb(-110) // 0.5238
 */
export declare function impliedProb(american: number): number;
/**
 * Convert American odds to decimal odds.
 * @example toDecimal(-110) // 1.909
 */
export declare function toDecimal(american: number): number;
/**
 * Convert decimal odds to American odds.
 * @example toAmerican(1.909) // -110
 */
export declare function toAmerican(decimal: number): number;
/**
 * Full odds conversion — American → decimal, fractional, implied prob.
 */
export declare function convertOdds(american: number, vigRemoval?: boolean): OddsConversion;
/**
 * Remove the vig from a two-sided market to get true probabilities.
 * @param side1 American odds for side 1
 * @param side2 American odds for side 2
 * @returns True probabilities for each side
 */
export declare function removeVig(side1: number, side2: number): {
    prob1: number;
    prob2: number;
    vig: number;
};
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
export declare function kelly(winProbability: number, americanOdds: number): KellyResult;
/**
 * Kelly sizing with multiple simultaneous bets (fractional Kelly portfolio).
 * Scales each bet so the total portfolio exposure stays within max exposure.
 */
export declare function kellyPortfolio(bets: Array<{
    winProbability: number;
    americanOdds: number;
    label?: string;
}>, maxExposure?: number): Array<{
    label: string;
    fraction: number;
    dollars: (bankroll: number) => number;
    ev: number;
}>;
/**
 * Calculate expected value of a bet.
 * @param winProbability Your estimated win probability
 * @param americanOdds  Offered odds
 * @param stake         Dollar amount wagered
 */
export declare function expectedValue(winProbability: number, americanOdds: number, stake?: number): {
    ev: number;
    evPercent: number;
    breakEvenProb: number;
};
/**
 * Measure Closing Line Value (CLV) — did you get better odds than closing?
 *
 * CLV is the strongest predictor of long-term betting profitability.
 * Consistently positive CLV = your line shopping / timing is beating the market.
 *
 * @param openLine   American odds when you bet
 * @param closeLine  American odds at market close
 */
export declare function clv(openLine: number, closeLine: number): CLVResult;
/**
 * Summarize CLV across a set of bets.
 */
export declare function clvSummary(bets: Array<{
    openLine: number;
    closeLine: number;
}>): {
    avgCLV: number;
    beatCloseRate: number;
    verdict: string;
    totalBets: number;
};
/**
 * Calculate P&L for a single bet result.
 */
export declare function betPnL(stake: number, americanOdds: number, result: 'win' | 'loss' | 'push'): BetResult;
/**
 * Compute comprehensive bankroll statistics from a history of bets.
 * Includes Sharpe ratio to measure risk-adjusted returns.
 */
export declare function bankrollStats(bets: Array<{
    stake: number;
    americanOdds: number;
    result: 'win' | 'loss' | 'push';
}>, startingBankroll?: number): BankrollStats;
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
export declare function arbitrage(oddsA: number, oddsB: number, totalStake?: number): ArbitrageResult;
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
export declare function parlayAnalysis(legs: Array<{
    americanOdds: number;
    oppOdds?: number;
}>): ParlayResult;
/**
 * Calculate ownership leverage score for DFS tournaments.
 * Higher score = more valuable as a contrarian play.
 */
export declare function ownershipLeverage(projectedPoints: number, ownershipPct: number): number;
/**
 * Stack correlation bonus for NFL DFS game stacks.
 */
export declare function stackBonus(qbProj: number, receiverProj: number, correlation?: number): number;
//# sourceMappingURL=index.d.ts.map