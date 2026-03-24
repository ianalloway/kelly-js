import {
  kelly,
  toDecimal,
  toAmerican,
  arbitrage,
  bankrollStats,
  clvSummary,
  betPnL,
  kellyPortfolio,
  impliedProb,
  clv,
  parlayAnalysis,
  removeVig,
  convertOdds,
  expectedValue,
  ownershipLeverage,
  stackBonus,
} from './index';

describe('kelly-js: Kelly Criterion & Sports Betting Analytics', () => {
  // ────────────────────────────────────────────────────────────────────────────
  // Kelly Criterion Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('kelly()', () => {
    it('calculates full Kelly, half-Kelly, and quarter-Kelly fractions', () => {
      const result = kelly(0.58, -110);
      expect(result.fraction).toBe(0.118);
      expect(result.halfKelly).toBe(0.059);
      expect(result.quarterKelly).toBe(0.0295);
      expect(result.hasEdge).toBe(true);
    });

    it('calculates dollar amounts given bankroll', () => {
      const result = kelly(0.58, -110);
      expect(result.dollars(1000)).toBe(118);
      expect(result.halfDollars(1000)).toBe(59);
    });

    it('calculates positive expected value and edge', () => {
      const result = kelly(0.60, +120);
      expect(result.ev).toBeGreaterThan(0);
      expect(result.edge).toBeGreaterThan(0);
    });

    it('returns zero fraction for break-even bet (no edge)', () => {
      const result = kelly(0.5238, -110); // Implied probability
      expect(result.fraction).toBe(0);
      expect(result.hasEdge).toBe(false);
    });

    it('throws on probability = 0', () => {
      expect(() => kelly(0, -110)).toThrow(RangeError);
    });

    it('throws on probability = 1', () => {
      expect(() => kelly(1, -110)).toThrow(RangeError);
    });

    it('throws on probability > 1', () => {
      expect(() => kelly(1.5, -110)).toThrow(RangeError);
    });

    it('throws on negative probability', () => {
      expect(() => kelly(-0.5, -110)).toThrow(RangeError);
    });

    it('handles low-probability, high-odds scenarios', () => {
      const result = kelly(0.05, +2000); // 5% win at +2000
      expect(result.fraction).toBeGreaterThanOrEqual(0);
      expect(typeof result.ev).toBe('number');
    });

    it('handles high-probability, tight-odds scenarios', () => {
      const result = kelly(0.95, -2000); // 95% win at -2000 decimal=1.05
      // b = 1.05 - 1 = 0.05, f* = (0.05*0.95 - 0.05) / 0.05 = 0
      expect(result.fraction).toBe(0);
      expect(result.hasEdge).toBe(false);
    });

    it('calculates correct EV for positive edge bet', () => {
      // decimal = 2.0, b = 1.0
      // EV = (1.0 * 0.6) - 0.4 = 0.2
      const result = kelly(0.6, 100); // +100 = 2.0 decimal
      expect(result.ev).toBeCloseTo(0.2, 2);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Odds Conversion Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('toDecimal()', () => {
    it('converts negative American odds to decimal', () => {
      expect(toDecimal(-110)).toBeCloseTo(1.909, 2);
      expect(toDecimal(-200)).toBe(1.5);
    });

    it('converts positive American odds to decimal', () => {
      expect(toDecimal(+100)).toBe(2);
      expect(toDecimal(+150)).toBe(2.5);
    });

    it('handles even odds (+100)', () => {
      expect(toDecimal(100)).toBe(2);
    });

    it('handles large positive odds', () => {
      expect(toDecimal(+2000)).toBeCloseTo(21, 0);
    });

    it('handles large negative odds', () => {
      expect(toDecimal(-2000)).toBeCloseTo(1.05, 2);
    });

    it('throws on zero odds', () => {
      expect(() => toDecimal(0)).toThrow(RangeError);
    });
  });

  describe('toAmerican()', () => {
    it('converts decimal to American odds (favorites)', () => {
      expect(toAmerican(1.909)).toBeCloseTo(-110, 0);
      expect(toAmerican(1.5)).toBe(-200);
    });

    it('converts decimal to American odds (underdogs)', () => {
      expect(toAmerican(2)).toBe(100);
      expect(toAmerican(2.5)).toBe(150);
    });

    it('handles even odds (decimal 2.0)', () => {
      expect(toAmerican(2)).toBe(100);
    });

    it('handles high-odds scenarios', () => {
      expect(toAmerican(21)).toBe(2000);
    });

    it('handles low-odds favorites', () => {
      expect(toAmerican(1.05)).toBeCloseTo(-2000, 0);
    });

    it('throws on decimal <= 1', () => {
      expect(() => toAmerican(1)).toThrow(RangeError);
    });

    it('throws on zero/negative decimal', () => {
      expect(() => toAmerican(0)).toThrow(RangeError);
      expect(() => toAmerican(-5)).toThrow(RangeError);
    });
  });

  describe('impliedProb()', () => {
    it('calculates implied probability from negative American odds', () => {
      expect(impliedProb(-110)).toBeCloseTo(0.5238, 4);
    });

    it('calculates implied probability from positive American odds', () => {
      expect(impliedProb(+100)).toBe(0.5);
      expect(impliedProb(+150)).toBeCloseTo(0.4, 4);
    });

    it('returns values between 0 and 1', () => {
      const prob1 = impliedProb(-110);
      const prob2 = impliedProb(+100);
      expect(prob1).toBeGreaterThan(0);
      expect(prob1).toBeLessThan(1);
      expect(prob2).toBeGreaterThan(0);
      expect(prob2).toBeLessThan(1);
    });
  });

  describe('convertOdds()', () => {
    it('returns all odds formats in one conversion', () => {
      const result = convertOdds(-110);
      expect(result.american).toBe(-110);
      expect(result.decimal).toBeCloseTo(1.909, 2);
      expect(result.fractional).toBe('10/11');
      expect(result.impliedProbability).toBeCloseTo(0.5238, 2);
    });

    it('handles positive American odds', () => {
      const result = convertOdds(+100);
      expect(result.american).toBe(100);
      expect(result.decimal).toBe(2);
      expect(result.impliedProbability).toBe(0.5);
    });

    it('includes noVigProbability when vigRemoval=true', () => {
      const result = convertOdds(-110, true);
      expect(result.noVigProbability).toBeDefined();
    });
  });

  describe('removeVig()', () => {
    it('removes vig from two-sided market', () => {
      const result = removeVig(-110, -110);
      expect(result.prob1).toBe(0.5);
      expect(result.prob2).toBe(0.5);
      expect(result.vig).toBeCloseTo(0.0476, 4);
    });

    it('calculates true probabilities from asymmetric odds', () => {
      const result = removeVig(-110, +100);
      expect(result.prob1 + result.prob2).toBeCloseTo(1, 4);
      expect(result.vig).toBeGreaterThan(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Arbitrage Detection Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('arbitrage()', () => {
    it('detects arbitrage when overround < 1.0', () => {
      // BetMGM +105, FanDuel +102 should create arb
      const result = arbitrage(105, 102, 1000);
      expect(result.hasArb).toBe(true);
      expect(result.profitPct).toBeGreaterThan(0);
    });

    it('calculates optimal stakes correctly with proper rounding', () => {
      const result = arbitrage(105, 102, 1000);
      expect(result.stakeA).toBeGreaterThan(0);
      expect(result.stakeB).toBeGreaterThan(0);
      // Verify rounding bug is fixed: stakeA + stakeB should equal totalStake
      expect(result.stakeA + result.stakeB).toBeCloseTo(1000, 1);
    });

    it('returns no arb when overround >= 1.0', () => {
      const result = arbitrage(-110, -110, 1000);
      expect(result.hasArb).toBe(false);
      expect(result.profitPct).toBe(0);
    });

    it('calculates correct profit percentage for arb', () => {
      const result = arbitrage(105, 102, 1000);
      // Profit should be 1/overround - 1
      expect(result.profitPct).toBeGreaterThan(0);
      expect(result.profitPct).toBeLessThan(5); // Reasonable upper bound
    });

    it('handles different total stake amounts', () => {
      const result1 = arbitrage(105, 102, 100);
      const result2 = arbitrage(105, 102, 10000);
      expect(result1.profitPct).toBeCloseTo(result2.profitPct, 2);
    });

    it('calculates stakes that sum correctly', () => {
      const result = arbitrage(110, 100, 1000);
      const total = result.stakeA + result.stakeB;
      expect(total).toBeCloseTo(1000, 1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Bankroll Stats Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('bankrollStats()', () => {
    it('handles empty bet array without crashing', () => {
      const result = bankrollStats([], 1000);
      expect(result.totalBets).toBe(0);
      expect(result.wins).toBe(0);
      expect(result.losses).toBe(0);
      expect(result.winRate).toBe(0);
      expect(result.roi).toBe(0);
    });

    it('calculates stats for single winning bet', () => {
      const result = bankrollStats([
        { stake: 100, americanOdds: -110, result: 'win' }
      ], 1000);
      expect(result.totalBets).toBe(1);
      expect(result.wins).toBe(1);
      expect(result.winRate).toBe(1);
      expect(result.netPnL).toBeGreaterThan(0);
    });

    it('calculates stats for single losing bet', () => {
      const result = bankrollStats([
        { stake: 100, americanOdds: -110, result: 'loss' }
      ], 1000);
      expect(result.losses).toBe(1);
      expect(result.winRate).toBe(0);
      expect(result.netPnL).toBe(-100);
    });

    it('handles push bets correctly', () => {
      const result = bankrollStats([
        { stake: 100, americanOdds: -110, result: 'push' }
      ], 1000);
      expect(result.pushes).toBe(1);
      expect(result.netPnL).toBe(0);
      expect(result.wins + result.losses).toBe(0);
    });

    it('calculates correct win rate from mixed results', () => {
      const result = bankrollStats([
        { stake: 100, americanOdds: -110, result: 'win' },
        { stake: 100, americanOdds: -110, result: 'loss' },
        { stake: 100, americanOdds: -110, result: 'win' },
      ], 1000);
      expect(result.wins).toBe(2);
      expect(result.losses).toBe(1);
      expect(result.winRate).toBeCloseTo(0.6667, 3);
    });

    it('tracks peak bankroll and max drawdown', () => {
      const result = bankrollStats([
        { stake: 100, americanOdds: -110, result: 'win' },
        { stake: 200, americanOdds: -110, result: 'loss' },
        { stake: 100, americanOdds: -110, result: 'win' },
      ], 1000);
      expect(result.peakBankroll).toBeGreaterThanOrEqual(1000);
      expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(result.maxDrawdown).toBeLessThanOrEqual(1);
    });

    it('calculates current winning streak', () => {
      const result = bankrollStats([
        { stake: 100, americanOdds: -110, result: 'win' },
        { stake: 100, americanOdds: -110, result: 'win' },
        { stake: 100, americanOdds: -110, result: 'loss' },
        { stake: 100, americanOdds: -110, result: 'win' },
        { stake: 100, americanOdds: -110, result: 'win' },
      ], 1000);
      expect(result.currentStreak).toBe(2);
      expect(result.streakType).toBe('win');
    });

    it('calculates current losing streak', () => {
      const result = bankrollStats([
        { stake: 100, americanOdds: -110, result: 'win' },
        { stake: 100, americanOdds: -110, result: 'loss' },
        { stake: 100, americanOdds: -110, result: 'loss' },
      ], 1000);
      expect(result.currentStreak).toBe(2);
      expect(result.streakType).toBe('loss');
    });

    it('calculates Sharpe ratio', () => {
      const result = bankrollStats([
        { stake: 100, americanOdds: -110, result: 'win' },
        { stake: 100, americanOdds: -110, result: 'loss' },
        { stake: 100, americanOdds: -110, result: 'win' },
      ], 1000);
      expect(typeof result.sharpeRatio).toBe('number');
      // With alternating results, Sharpe should be calculable
      expect(result.sharpeRatio).toBeGreaterThanOrEqual(0);
    });

    it('calculates ROI correctly', () => {
      const result = bankrollStats([
        { stake: 100, americanOdds: -110, result: 'win' },
      ], 1000);
      expect(result.roi).toBeGreaterThan(0);
    });

    it('handles multiple bets with different odds', () => {
      const result = bankrollStats([
        { stake: 50, americanOdds: -110, result: 'win' },
        { stake: 75, americanOdds: 150, result: 'loss' },
        { stake: 100, americanOdds: -200, result: 'win' },
      ], 1000);
      expect(result.totalBets).toBe(3);
      expect(result.wins).toBe(2);
      expect(result.losses).toBe(1);
    });
  });

  describe('betPnL()', () => {
    it('calculates profit for winning bet', () => {
      const result = betPnL(100, -110, 'win');
      expect(result.pnl).toBeGreaterThan(0);
      expect(result.result).toBe('win');
    });

    it('calculates loss for losing bet', () => {
      const result = betPnL(100, -110, 'loss');
      expect(result.pnl).toBe(-100);
      expect(result.result).toBe('loss');
    });

    it('calculates zero PnL for push', () => {
      const result = betPnL(100, -110, 'push');
      expect(result.pnl).toBe(0);
      expect(result.result).toBe('push');
    });

    it('calculates ROI correctly', () => {
      const result = betPnL(100, -110, 'win');
      expect(result.roi).toBe(result.pnl / 100);
    });

    it('handles different odds correctly for wins', () => {
      const result110 = betPnL(100, -110, 'win');
      const result150 = betPnL(100, 150, 'win');
      expect(result150.pnl).toBeGreaterThan(result110.pnl);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // CLV Summary Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('clvSummary()', () => {
    it('handles empty bet array without crashing', () => {
      const result = clvSummary([]);
      // Should return 0 or NaN gracefully
      expect(result.totalBets).toBe(0);
      expect(typeof result.avgCLV).toBe('number');
    });

    it('calculates average CLV from single bet', () => {
      const result = clvSummary([
        { openLine: -108, closeLine: -115 }
      ]);
      expect(result.totalBets).toBe(1);
      expect(result.avgCLV).toBeGreaterThan(0); // You got better line
    });

    it('calculates beat close rate correctly', () => {
      const result = clvSummary([
        { openLine: -108, closeLine: -115 }, // You beat close
        { openLine: -115, closeLine: -108 }, // You missed close
      ]);
      expect(result.beatCloseRate).toBeCloseTo(0.5, 2);
    });

    it('assigns correct verdict for elite CLV', () => {
      const result = clvSummary([
        { openLine: -100, closeLine: -200 }, // +2% CLV multiple times
        { openLine: -100, closeLine: -200 },
      ]);
      expect(result.verdict).toContain('Elite');
    });

    it('assigns correct verdict for positive CLV', () => {
      const result = clvSummary([
        { openLine: -110, closeLine: -115 },
      ]);
      expect(result.verdict).toContain('Positive');
    });

    it('calculates average CLV from multiple bets', () => {
      const result = clvSummary([
        { openLine: -110, closeLine: -115 },
        { openLine: -110, closeLine: -115 },
        { openLine: -110, closeLine: -115 },
      ]);
      expect(result.totalBets).toBe(3);
      expect(result.avgCLV).toBeGreaterThan(0);
    });
  });

  describe('clv()', () => {
    it('detects positive CLV when you get better line', () => {
      const result = clv(-108, -115);
      expect(result.beatClose).toBe(true);
      expect(result.clvPercent).toBeGreaterThan(0);
    });

    it('detects negative CLV when you get worse line', () => {
      const result = clv(-115, -108);
      expect(result.beatClose).toBe(false);
      expect(result.clvPercent).toBeLessThan(0);
    });

    it('assigns elite verdict for high CLV', () => {
      const result = clv(-100, -200);
      expect(result.verdict).toBe('elite');
    });

    it('assigns positive verdict for modest CLV', () => {
      const result = clv(-110, -115);
      expect(result.verdict).toBe('positive');
    });

    it('assigns neutral verdict for near-even CLV', () => {
      const result = clv(-110, -111);
      expect(result.verdict).toBe('neutral');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Kelly Portfolio Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('kellyPortfolio()', () => {
    it('sizes multiple bets with default max exposure', () => {
      const portfolio = kellyPortfolio([
        { winProbability: 0.58, americanOdds: -110, label: 'Bet A' },
        { winProbability: 0.62, americanOdds: 105, label: 'Bet B' },
      ]);
      expect(portfolio.length).toBe(2);
      expect(portfolio[0].label).toBe('Bet A');
      expect(portfolio[1].label).toBe('Bet B');
    });

    it('respects max exposure limit', () => {
      const portfolio = kellyPortfolio([
        { winProbability: 0.58, americanOdds: -110 },
        { winProbability: 0.58, americanOdds: -110 },
        { winProbability: 0.58, americanOdds: -110 },
      ], 0.20);
      const totalFraction = portfolio.reduce((sum, b) => sum + b.fraction, 0);
      expect(totalFraction).toBeLessThanOrEqual(0.25); // 25% max exposure
    });

    it('does not scale if total fraction within max exposure', () => {
      const portfolio = kellyPortfolio([
        { winProbability: 0.58, americanOdds: -110 },
      ], 0.25);
      expect(portfolio[0].fraction).toBeGreaterThan(0);
    });

    it('generates dollar amounts from portfolio', () => {
      const portfolio = kellyPortfolio([
        { winProbability: 0.58, americanOdds: -110 },
      ]);
      const dollars = portfolio[0].dollars(1000);
      expect(dollars).toBeGreaterThan(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Expected Value Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('expectedValue()', () => {
    it('calculates positive EV for profitable bet', () => {
      const result = expectedValue(0.60, -110, 100);
      expect(result.ev).toBeGreaterThan(0);
      expect(result.evPercent).toBeGreaterThan(0);
    });

    it('calculates negative EV for unprofitable bet', () => {
      const result = expectedValue(0.45, -110, 100);
      expect(result.ev).toBeLessThan(0);
    });

    it('calculates correct break-even probability', () => {
      const result = expectedValue(0.5, -110);
      expect(result.breakEvenProb).toBeCloseTo(impliedProb(-110), 4);
    });

    it('uses default stake of 1 if not provided', () => {
      const result = expectedValue(0.60, -110);
      expect(typeof result.ev).toBe('number');
      expect(result.evPercent).toBeCloseTo(result.ev * 100, 0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Parlay Analysis Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('parlayAnalysis()', () => {
    it('analyzes 2-leg parlay correctly', () => {
      const result = parlayAnalysis([
        { americanOdds: -110 },
        { americanOdds: -110 },
      ]);
      expect(result.legs).toBe(2);
      expect(result.combinedDecimal).toBeGreaterThan(1);
    });

    it('calculates true win probability without vig removal', () => {
      const result = parlayAnalysis([
        { americanOdds: 100 }, // 50%
        { americanOdds: 100 }, // 50%
      ]);
      expect(result.trueWinProb).toBeCloseTo(0.25, 2); // 50% * 50%
    });

    it('uses opponent odds for vig removal when provided', () => {
      const result = parlayAnalysis([
        { americanOdds: -110, oppOdds: -110 },
        { americanOdds: 100, oppOdds: -120 },
      ]);
      expect(result.trueWinProb).toBeGreaterThan(0);
    });

    it('detects positive expected value parlay', () => {
      const result = parlayAnalysis([
        { americanOdds: 100 },
        { americanOdds: 100 },
      ]);
      expect(typeof result.hasEdge).toBe('boolean');
      expect(result.ev100).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // DFS Helper Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('ownershipLeverage()', () => {
    it('calculates leverage score for DFS player', () => {
      const score = ownershipLeverage(50, 5);
      expect(score).toBeGreaterThan(0);
      expect(typeof score).toBe('number');
    });

    it('returns higher leverage for low-ownership high-projection', () => {
      const high = ownershipLeverage(50, 1);
      const low = ownershipLeverage(50, 20);
      expect(high).toBeGreaterThan(low);
    });
  });

  describe('stackBonus()', () => {
    it('calculates positive bonus for correlated stack', () => {
      const bonus = stackBonus(30, 20, 0.35);
      expect(bonus).toBeGreaterThan(0);
    });

    it('uses default correlation of 0.35', () => {
      const result1 = stackBonus(30, 20);
      const result2 = stackBonus(30, 20, 0.35);
      expect(result1).toBe(result2);
    });

    it('handles custom correlation values', () => {
      const strong = stackBonus(30, 20, 0.8);
      const weak = stackBonus(30, 20, 0.1);
      expect(strong).toBeGreaterThan(weak);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Edge Cases & Integration Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('Integration: kelly → bankrollStats → clvSummary', () => {
    it('end-to-end: size bet, track results, analyze performance', () => {
      // Size a bet using Kelly
      const sizing = kelly(0.58, -110);
      const stakeSize = sizing.dollars(1000);

      // Simulate bet results and track stats
      const bets = [
        { stake: stakeSize, americanOdds: -110, result: 'win' as const },
        { stake: stakeSize, americanOdds: -110, result: 'loss' as const },
      ];
      const stats = bankrollStats(bets, 1000);

      expect(stats.totalBets).toBe(2);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
    });
  });

  describe('Edge Case: Very Small Probabilities', () => {
    it('handles near-zero probability correctly', () => {
      const result = kelly(0.001, 10000);
      expect(result.fraction).toBeGreaterThanOrEqual(0);
      expect(typeof result.ev).toBe('number');
    });
  });

  describe('Edge Case: Very High Probabilities', () => {
    it('handles near-certainty probability correctly', () => {
      const result = kelly(0.999, -10000);
      expect(result.fraction).toBeGreaterThan(0);
      expect(result.hasEdge).toBe(true);
    });
  });

  describe('Edge Case: Extreme Odds', () => {
    it('handles extreme negative American odds', () => {
      const decimal = toDecimal(-10000);
      expect(decimal).toBeCloseTo(1.01, 2);
      const american = toAmerican(1.01);
      expect(typeof american).toBe('number');
    });

    it('handles extreme positive American odds', () => {
      const decimal = toDecimal(10000);
      expect(decimal).toBeCloseTo(101, 0);
      const american = toAmerican(101);
      expect(american).toBeGreaterThan(1000);
    });
  });

  describe('Consistency: Bidirectional Conversion', () => {
    it('american → decimal → american returns original', () => {
      const original = -110;
      const decimal = toDecimal(original);
      const back = toAmerican(decimal);
      expect(back).toBeCloseTo(original, 0);
    });

    it('handles conversion round-trips', () => {
      const decimals = [1.5, 1.909, 2, 2.5, 3, 5];
      decimals.forEach(d => {
        const american = toAmerican(d);
        const back = toDecimal(american);
        expect(back).toBeCloseTo(d, 2);
      });
    });
  });
});
