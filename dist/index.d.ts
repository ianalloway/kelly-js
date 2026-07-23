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
    ranked: Array<{
        book: string;
        odds: number;
        impliedProb: number;
    }>;
    /** Extra implied-probability edge vs worst book (how much shopping helped) */
    shoppingEdgePct: number;
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
 * Supports individual fractional Kelly multipliers per bet.
 */
export declare function kellyPortfolio(bets: Array<{
    winProbability: number;
    americanOdds: number;
    label?: string;
    multiplier?: number;
}>, maxExposure?: number): Array<{
    label: string;
    fraction: number;
    dollars: (bankroll: number) => number;
    ev: number;
}>;
/**
 * Calculate the optimal fractional Kelly multiplier to maximize growth
 * given a specific constraint on the probability of a drawdown.
 *
 * @param edge The edge (EV per unit staked)
 * @param variance The variance of the returns
 * @param maxDrawdown The maximum drawdown allowed (e.g. 0.5 for 50%)
 * @param riskOfDrawdown The desired probability of hitting that drawdown (e.g. 0.1 for 10%)
 */
export declare function optimalFractionalKelly(edge: number, variance: number, maxDrawdown: number, riskOfDrawdown?: number): number;
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
export declare function kellyParlay(legs: Array<{
    probability: number;
    americanOdds: number;
}>): KellyResult & {
    combinedOdds: number;
    combinedDecimal: number;
    trueWinProb: number;
};
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
export declare function simulateGrowth(winProbability: number, americanOdds: number, betsPerPath?: number, paths?: number, startingBankroll?: number, kellyMultiplier?: number, seed?: number): SimulationResult;
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
export declare function lineShop(books: Array<{
    book: string;
    odds: number;
}>): LineShopResult;
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
    books: Array<{
        book: string;
        deVigProb1: number;
        deVigProb2: number;
        vig: number;
    }>;
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
    modeScore: {
        home: number;
        away: number;
        prob: number;
    };
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
export declare function marketConsensus(books: Array<{
    book: string;
    side1Odds: number;
    side2Odds: number;
}>): MarketConsensusResult;
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
export declare function poissonModel(lambda1: number, lambda2: number, maxGoals?: number): PoissonResult;
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
export declare function kellyGrowthRate(winProbability: number, americanOdds: number, fraction: number): GrowthRateResult;
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
export declare function dutching(outcomes: Array<{
    label: string;
    americanOdds: number;
}>, totalStake?: number): DutchResult;
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
export declare function hedgeBet(originalStake: number, originalAmericanOdds: number, hedgeAmericanOdds: number): HedgeResult;
//# sourceMappingURL=index.d.ts.map