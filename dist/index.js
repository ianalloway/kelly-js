"use strict";
/**
 * kelly-js — Kelly Criterion & sports betting analytics library
 * by Ian Alloway <ian@allowayllc.com>
 * MIT License
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.impliedProb = impliedProb;
exports.toDecimal = toDecimal;
exports.toAmerican = toAmerican;
exports.convertOdds = convertOdds;
exports.removeVig = removeVig;
exports.kelly = kelly;
exports.kellyPortfolio = kellyPortfolio;
exports.expectedValue = expectedValue;
exports.clv = clv;
exports.clvSummary = clvSummary;
exports.betPnL = betPnL;
exports.bankrollStats = bankrollStats;
exports.arbitrage = arbitrage;
exports.parlayAnalysis = parlayAnalysis;
exports.ownershipLeverage = ownershipLeverage;
exports.stackBonus = stackBonus;
// ─── Odds Conversion ──────────────────────────────────────────────────────────
/**
 * Convert American odds to implied probability (includes vig).
 * @example impliedProb(-110) // 0.5238
 */
function impliedProb(american) {
    if (american > 0)
        return 100 / (american + 100);
    return Math.abs(american) / (Math.abs(american) + 100);
}
/**
 * Convert American odds to decimal odds.
 * @example toDecimal(-110) // 1.909
 */
function toDecimal(american) {
    if (american === 0)
        throw new RangeError('American odds cannot be zero');
    if (american > 0)
        return american / 100 + 1;
    return 100 / Math.abs(american) + 1;
}
/**
 * Convert decimal odds to American odds.
 * @example toAmerican(1.909) // -110
 */
function toAmerican(decimal) {
    if (decimal <= 1)
        throw new RangeError('Decimal odds must be greater than 1');
    if (decimal >= 2)
        return Math.round((decimal - 1) * 100);
    return Math.round(-100 / (decimal - 1));
}
/**
 * Full odds conversion — American → decimal, fractional, implied prob.
 */
function convertOdds(american, vigRemoval = false) {
    const implied = impliedProb(american);
    const decimal = toDecimal(american);
    const absAmerican = Math.abs(american);
    // Fractional approximation
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
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
function removeVig(side1, side2) {
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
function kelly(winProbability, americanOdds) {
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
        dollars: (bankroll) => Math.round(bankroll * fraction * 100) / 100,
        halfDollars: (bankroll) => Math.round(bankroll * fraction * 50) / 100,
        ev: Math.round(ev * 10000) / 10000,
        edge: Math.round(edge * 10000) / 10000,
        hasEdge: ev > 0,
    };
}
/**
 * Kelly sizing with multiple simultaneous bets (fractional Kelly portfolio).
 * Scales each bet so the total portfolio exposure stays within max exposure.
 */
function kellyPortfolio(bets, maxExposure = 0.25) {
    const results = bets.map((bet, i) => ({
        label: bet.label ?? `Bet ${i + 1}`,
        ...kelly(bet.winProbability, bet.americanOdds),
    }));
    const totalFraction = results.reduce((sum, r) => sum + r.fraction, 0);
    const scale = totalFraction > maxExposure ? maxExposure / totalFraction : 1;
    return results.map((r) => ({
        label: r.label,
        fraction: Math.round(r.fraction * scale * 10000) / 10000,
        dollars: (bankroll) => Math.round(bankroll * r.fraction * scale * 100) / 100,
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
function expectedValue(winProbability, americanOdds, stake = 1) {
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
function clv(openLine, closeLine) {
    const openProb = impliedProb(openLine);
    const closeProb = impliedProb(closeLine);
    const clvPercent = (closeProb - openProb) * 100; // positive = you got better line
    let verdict;
    if (clvPercent >= 2)
        verdict = 'elite';
    else if (clvPercent >= 0.5)
        verdict = 'positive';
    else if (clvPercent >= -0.5)
        verdict = 'neutral';
    else
        verdict = 'negative';
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
function clvSummary(bets) {
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
    let verdict;
    if (avgCLV >= 2)
        verdict = '🏆 Elite — you are finding real edges before the market';
    else if (avgCLV >= 0.5)
        verdict = '✅ Positive — beating the market consistently';
    else if (avgCLV >= -0.5)
        verdict = '⚪ Neutral — shopping more books may help';
    else
        verdict = '🔴 Negative — your line timing and shopping needs work';
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
function betPnL(stake, americanOdds, result) {
    let pnl;
    if (result === 'win') {
        pnl = stake * (toDecimal(americanOdds) - 1);
    }
    else if (result === 'loss') {
        pnl = -stake;
    }
    else {
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
function bankrollStats(bets, startingBankroll = 1000) {
    let bankroll = startingBankroll;
    let peak = startingBankroll;
    let maxDrawdown = 0;
    let streak = 0;
    let streakType = 'none';
    const pnls = bets.map((b) => {
        const r = betPnL(b.stake, b.americanOdds, b.result);
        bankroll += r.pnl;
        if (bankroll > peak)
            peak = bankroll;
        const drawdown = (peak - bankroll) / peak;
        if (drawdown > maxDrawdown)
            maxDrawdown = drawdown;
        if (b.result === 'win') {
            streak = streakType === 'win' ? streak + 1 : 1;
            streakType = 'win';
        }
        else if (b.result === 'loss') {
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
function arbitrage(oddsA, oddsB, totalStake = 1000) {
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
function parlayAnalysis(legs) {
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
function ownershipLeverage(projectedPoints, ownershipPct) {
    return Math.round((projectedPoints / (ownershipPct + 1)) * 100) / 100;
}
/**
 * Stack correlation bonus for NFL DFS game stacks.
 */
function stackBonus(qbProj, receiverProj, correlation = 0.35) {
    return Math.round(correlation * Math.sqrt(qbProj * receiverProj) * 0.15 * 100) / 100;
}
//# sourceMappingURL=index.js.map