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
  simulateGrowth,
  lineShop,
  marketConsensus,
  poissonModel,
  kellyGrowthRate,
  dutching,
  kellyParlay,
  hedgeBet,
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

  describe('kellyParlay()', () => {
    it('combines leg probabilities and odds into one Kelly bet', () => {
      const result = kellyParlay([
        { probability: 0.55, americanOdds: -110 },
        { probability: 0.6, americanOdds: -120 },
      ]);
      expect(result.trueWinProb).toBeCloseTo(0.55 * 0.6, 4);
      expect(result.combinedDecimal).toBeCloseTo(toDecimal(-110) * toDecimal(-120), 2);
      expect(result.fraction).toBeGreaterThanOrEqual(0);
      expect(typeof result.combinedOdds).toBe('number');
    });

    it('matches single-leg kelly() for a one-leg parlay', () => {
      const single = kelly(0.58, -110);
      const parlay = kellyParlay([{ probability: 0.58, americanOdds: -110 }]);
      expect(parlay.fraction).toBe(single.fraction);
      expect(parlay.trueWinProb).toBe(0.58);
    });

    it('returns zero fraction when the combined parlay has no edge', () => {
      // Both legs priced at exactly their implied probability — no edge anywhere
      const result = kellyParlay([
        { probability: 0.5238, americanOdds: -110 },
        { probability: 0.5238, americanOdds: -110 },
      ]);
      expect(result.fraction).toBe(0);
      expect(result.hasEdge).toBe(false);
    });

    it('throws on an empty legs array', () => {
      expect(() => kellyParlay([])).toThrow(RangeError);
    });

    it('throws when any leg probability is out of range', () => {
      expect(() =>
        kellyParlay([{ probability: 1, americanOdds: -110 }])
      ).toThrow(RangeError);
      expect(() =>
        kellyParlay([{ probability: 0, americanOdds: -110 }])
      ).toThrow(RangeError);
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

  // ────────────────────────────────────────────────────────────────────────────
  // simulateGrowth() — Monte Carlo bankroll simulation
  // ────────────────────────────────────────────────────────────────────────────

  describe('simulateGrowth()', () => {
    it('returns valid SimulationResult shape', () => {
      const result = simulateGrowth(0.55, -110, 200, 500, 1000, 0.5, 42);
      expect(result.paths).toBe(500);
      expect(result.betsPerPath).toBe(200);
      expect(result.startingBankroll).toBe(1000);
      expect(typeof result.medianFinal).toBe('number');
      expect(typeof result.ruinRate).toBe('number');
      expect(typeof result.medianMaxDrawdown).toBe('number');
    });

    it('percentiles are ordered p10 ≤ p25 ≤ median ≤ p75 ≤ p90', () => {
      const r = simulateGrowth(0.55, -110, 300, 1000, 1000, 0.5, 7);
      expect(r.p10).toBeLessThanOrEqual(r.p25);
      expect(r.p25).toBeLessThanOrEqual(r.medianFinal);
      expect(r.medianFinal).toBeLessThanOrEqual(r.p75);
      expect(r.p75).toBeLessThanOrEqual(r.p90);
    });

    it('ruin rate is between 0 and 1', () => {
      const r = simulateGrowth(0.55, -110, 200, 500, 1000, 0.5, 99);
      expect(r.ruinRate).toBeGreaterThanOrEqual(0);
      expect(r.ruinRate).toBeLessThanOrEqual(1);
    });

    it('positive-edge bet grows median bankroll over 500 bets (half-Kelly)', () => {
      // 55% win at -110 is a strong edge; median should grow with half-Kelly
      const r = simulateGrowth(0.55, -110, 500, 2000, 1000, 0.5, 123);
      expect(r.medianFinal).toBeGreaterThan(1000);
    });

    it('zero-edge bet (break-even) does not grow', () => {
      // Implied prob of -110 is ~52.38%; betting at exactly that prob is zero EV
      const r = simulateGrowth(0.5238, -110, 500, 1000, 1000, 0.5, 5);
      // Kelly fraction ≈ 0 at break-even, so bankroll stays flat
      expect(r.medianFinal).toBeCloseTo(1000, -1);
    });

    it('is reproducible with same seed', () => {
      const a = simulateGrowth(0.56, -110, 300, 500, 1000, 0.5, 42);
      const b = simulateGrowth(0.56, -110, 300, 500, 1000, 0.5, 42);
      expect(a.medianFinal).toBe(b.medianFinal);
      expect(a.ruinRate).toBe(b.ruinRate);
    });

    it('throws on invalid winProbability', () => {
      expect(() => simulateGrowth(0, -110)).toThrow(RangeError);
      expect(() => simulateGrowth(1, -110)).toThrow(RangeError);
      expect(() => simulateGrowth(1.5, -110)).toThrow(RangeError);
    });

    it('throws on invalid americanOdds', () => {
      expect(() => simulateGrowth(0.55, 0)).toThrow(RangeError);
      expect(() => simulateGrowth(0.55, Infinity)).toThrow(RangeError);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // lineShop() — best odds across sportsbooks
  // ────────────────────────────────────────────────────────────────────────────

  describe('lineShop()', () => {
    it('identifies the best book among negative lines', () => {
      const result = lineShop([
        { book: 'DraftKings', odds: -112 },
        { book: 'FanDuel',    odds: -108 },
        { book: 'BetMGM',     odds: -115 },
      ]);
      expect(result.bestBook).toBe('FanDuel');
      expect(result.bestOdds).toBe(-108);
    });

    it('identifies the best book among positive lines', () => {
      const result = lineShop([
        { book: 'DraftKings', odds: +130 },
        { book: 'FanDuel',    odds: +135 },
        { book: 'PointsBet',  odds: +128 },
      ]);
      expect(result.bestBook).toBe('FanDuel');
      expect(result.bestOdds).toBe(135);
    });

    it('ranked array is sorted best-to-worst', () => {
      const result = lineShop([
        { book: 'A', odds: -115 },
        { book: 'B', odds: -108 },
        { book: 'C', odds: -120 },
      ]);
      expect(result.ranked[0].book).toBe('B');
      expect(result.ranked[result.ranked.length - 1].book).toBe('C');
    });

    it('shoppingEdgePct is non-negative and reasonable', () => {
      const result = lineShop([
        { book: 'X', odds: -108 },
        { book: 'Y', odds: -115 },
      ]);
      expect(result.shoppingEdgePct).toBeGreaterThanOrEqual(0);
      expect(result.shoppingEdgePct).toBeLessThan(10); // sanity cap
    });

    it('returns zero shopping edge when all books are the same', () => {
      const result = lineShop([
        { book: 'A', odds: -110 },
        { book: 'B', odds: -110 },
      ]);
      expect(result.shoppingEdgePct).toBe(0);
    });

    it('handles a single book without error', () => {
      const result = lineShop([{ book: 'Solo', odds: +200 }]);
      expect(result.bestBook).toBe('Solo');
      expect(result.shoppingEdgePct).toBe(0);
    });

    it('throws on empty books array', () => {
      expect(() => lineShop([])).toThrow(RangeError);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // marketConsensus() — multi-book no-vig consensus probability
  // ────────────────────────────────────────────────────────────────────────────

  describe('marketConsensus()', () => {
    const books = [
      { book: 'Pinnacle',   side1Odds: -108, side2Odds: -104 },
      { book: 'DraftKings', side1Odds: -112, side2Odds: +100 },
      { book: 'FanDuel',    side1Odds: -110, side2Odds: -102 },
    ];

    it('returns correct bookCount', () => {
      expect(marketConsensus(books).bookCount).toBe(3);
    });

    it('prob1 + prob2 === 1', () => {
      const r = marketConsensus(books);
      expect(r.prob1 + r.prob2).toBeCloseTo(1, 4);
    });

    it('prob1 > 0.5 when side1 is clearly favoured', () => {
      const r = marketConsensus([
        { book: 'A', side1Odds: -200, side2Odds: +170 },
        { book: 'B', side1Odds: -195, side2Odds: +165 },
      ]);
      expect(r.prob1).toBeGreaterThan(0.5);
    });

    it('fairOdds1 and fairOdds2 are opposite in sign for close markets', () => {
      const r = marketConsensus([{ book: 'X', side1Odds: -110, side2Odds: -110 }]);
      // 50/50 market → both sides should be around +/-100
      expect(Math.sign(r.fairOdds1)).toBe(-1);
      expect(Math.sign(r.fairOdds2)).toBe(-1);
    });

    it('disagreement is 0 when all books show identical de-vigged probs', () => {
      const same = [
        { book: 'A', side1Odds: -110, side2Odds: -110 },
        { book: 'B', side1Odds: -110, side2Odds: -110 },
        { book: 'C', side1Odds: -110, side2Odds: -110 },
      ];
      expect(marketConsensus(same).disagreement).toBe(0);
    });

    it('disagreement is non-zero when books differ', () => {
      expect(marketConsensus(books).disagreement).toBeGreaterThan(0);
    });

    it('per-book breakdown has correct length', () => {
      expect(marketConsensus(books).books).toHaveLength(3);
    });

    it('throws on empty books array', () => {
      expect(() => marketConsensus([])).toThrow(RangeError);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // poissonModel() — Poisson match outcome and totals model
  // ────────────────────────────────────────────────────────────────────────────

  describe('poissonModel()', () => {
    it('win + draw + loss probabilities sum to ~1', () => {
      const m = poissonModel(1.6, 1.1);
      expect(m.winProb + m.drawProb + m.lossProb).toBeCloseTo(1, 3);
    });

    it('favoured side (higher lambda) has higher winProb', () => {
      const m = poissonModel(2.0, 0.8);
      expect(m.winProb).toBeGreaterThan(m.lossProb);
    });

    it('equal lambdas → winProb ≈ lossProb', () => {
      const m = poissonModel(1.5, 1.5);
      expect(m.winProb).toBeCloseTo(m.lossProb, 2);
    });

    it('overProb(2.5) + underProb(2.5) ≈ 1 (no push on half-goal line)', () => {
      const m = poissonModel(1.6, 1.1);
      expect(m.overProb(2.5) + m.underProb(2.5)).toBeCloseTo(1, 3);
    });

    it('overProb decreases as the line increases', () => {
      const m = poissonModel(1.6, 1.1);
      expect(m.overProb(1.5)).toBeGreaterThan(m.overProb(2.5));
      expect(m.overProb(2.5)).toBeGreaterThan(m.overProb(4.5));
    });

    it('modeScore is the highest-probability cell in the matrix', () => {
      const m = poissonModel(1.6, 1.1);
      const { home, away, prob } = m.modeScore;
      // modeScore.prob is rounded to 4dp; raw matrix entry is unrounded
      expect(prob).toBeCloseTo(m.scoreMatrix[home][away], 4);
      // Verify no other cell exceeds the mode cell
      const maxCell = Math.max(...m.scoreMatrix.flat());
      expect(m.scoreMatrix[home][away]).toBeCloseTo(maxCell, 6);
    });

    it('fairOdds1 reflects heavy favourite correctly', () => {
      const m = poissonModel(3.0, 0.5);
      // Side 1 wins ~90%+ → fairOdds1 should be very negative (large favourite)
      expect(m.fairOdds1).toBeLessThan(-300);
    });

    it('scoreMatrix dimensions are (maxGoals+1) × (maxGoals+1)', () => {
      const m = poissonModel(1.5, 1.2, 6);
      expect(m.scoreMatrix.length).toBe(7);
      expect(m.scoreMatrix[0].length).toBe(7);
    });

    it('throws on non-positive lambda', () => {
      expect(() => poissonModel(0, 1.5)).toThrow(RangeError);
      expect(() => poissonModel(1.5, -1)).toThrow(RangeError);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // kellyGrowthRate() — theoretical log bankroll growth per bet
  // ────────────────────────────────────────────────────────────────────────────

  describe('kellyGrowthRate()', () => {
    it('returns 0 log growth at fraction=0 (no bet)', () => {
      expect(kellyGrowthRate(0.55, -110, 0).logGrowthRate).toBe(0);
    });

    it('positive-edge bet at full Kelly has positive log growth', () => {
      const fullK = kelly(0.55, -110).fraction;
      expect(kellyGrowthRate(0.55, -110, fullK).logGrowthRate).toBeGreaterThan(0);
    });

    it('full Kelly has higher log growth than half Kelly for edge bet', () => {
      const fullK = kelly(0.55, -110).fraction;
      const gFull = kellyGrowthRate(0.55, -110, fullK).logGrowthRate;
      const gHalf = kellyGrowthRate(0.55, -110, fullK / 2).logGrowthRate;
      expect(gFull).toBeGreaterThan(gHalf);
    });

    it('overbetting 2x Kelly produces lower growth than full Kelly', () => {
      const fullK = kelly(0.55, -110).fraction;
      const gFull = kellyGrowthRate(0.55, -110, fullK).logGrowthRate;
      const twoX = Math.min(fullK * 2, 0.99);
      const gOver = kellyGrowthRate(0.55, -110, twoX).logGrowthRate;
      expect(gFull).toBeGreaterThan(gOver);
    });

    it('isOverbetting is false at half Kelly', () => {
      const fullK = kelly(0.55, -110).fraction;
      expect(kellyGrowthRate(0.55, -110, fullK / 2).isOverbetting).toBe(false);
    });

    it('isOverbetting is true beyond full Kelly', () => {
      const fullK = kelly(0.55, -110).fraction;
      const over = Math.min(fullK * 1.5, 0.99);
      expect(kellyGrowthRate(0.55, -110, over).isOverbetting).toBe(true);
    });

    it('projectedBankroll grows correctly over N bets', () => {
      const fullK = kelly(0.55, -110).fraction;
      const gr = kellyGrowthRate(0.55, -110, fullK);
      const projected = gr.projectedBankroll(100, 1000);
      const expected = Math.round(1000 * Math.exp(gr.logGrowthRate * 100) * 100) / 100;
      expect(projected).toBe(expected);
    });

    it('growthMultiplier equals exp(logGrowthRate)', () => {
      const gr = kellyGrowthRate(0.55, -110, 0.05);
      expect(gr.growthMultiplier).toBeCloseTo(Math.exp(gr.logGrowthRate), 5);
    });

    it('throws on invalid inputs', () => {
      expect(() => kellyGrowthRate(0, -110, 0.1)).toThrow(RangeError);
      expect(() => kellyGrowthRate(0.55, 0, 0.1)).toThrow(RangeError);
      expect(() => kellyGrowthRate(0.55, -110, -0.1)).toThrow(RangeError);
      expect(() => kellyGrowthRate(0.55, -110, 1)).toThrow(RangeError);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // dutching() — equal-profit staking across multiple outcomes
  // ────────────────────────────────────────────────────────────────────────────

  describe('dutching()', () => {
    const horseRace = [
      { label: 'Horse A', americanOdds: +200 },
      { label: 'Horse B', americanOdds: +350 },
      { label: 'Horse C', americanOdds: +500 },
    ];

    it('all outcomes return the same gross amount (within rounding)', () => {
      const r = dutching(horseRace, 1000);
      const returns = r.stakes.map((s) => s.returnIfWin);
      const maxDiff = Math.max(...returns) - Math.min(...returns);
      expect(maxDiff).toBeLessThanOrEqual(0.02); // rounding tolerance
    });

    it('stakes sum close to totalStake', () => {
      const r = dutching(horseRace, 1000);
      const sum = r.stakes.reduce((s, o) => s + o.stake, 0);
      expect(sum).toBeCloseTo(1000, 0);
    });

    it('isProfit true when combined implied prob < 1', () => {
      // +200, +350, +500 → implied probs 0.333 + 0.222 + 0.167 = 0.722 < 1
      expect(dutching(horseRace).isProfit).toBe(true);
    });

    it('isProfit false for standard two-sided market with vig', () => {
      const result = dutching([
        { label: 'Team A', americanOdds: -110 },
        { label: 'Team B', americanOdds: -110 },
      ]);
      expect(result.isProfit).toBe(false);
    });

    it('overround matches sum of implied probabilities', () => {
      const r = dutching(horseRace);
      const impliedSum = horseRace
        .map((o) => 1 / toDecimal(o.americanOdds))
        .reduce((s, p) => s + p, 0);
      expect(r.overround).toBeCloseTo(impliedSum, 4);
    });

    it('single outcome: entire stake on one runner', () => {
      const r = dutching([{ label: 'Only Horse', americanOdds: +300 }], 100);
      expect(r.stakes[0].stake).toBeCloseTo(100, 1);
    });

    it('throws on empty outcomes', () => {
      expect(() => dutching([])).toThrow(RangeError);
    });

    it('throws on non-positive totalStake', () => {
      expect(() => dutching(horseRace, 0)).toThrow(RangeError);
      expect(() => dutching(horseRace, -100)).toThrow(RangeError);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Hedge Bet Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('hedgeBet()', () => {
    it('locks in guaranteed profit when original odds were long', () => {
      // Bet $100 at +300 early; opposite now available at +100
      const result = hedgeBet(100, 300, 100);
      expect(result.hedgeStake).toBe(200);          // 100 * 4.0 / 2.0
      expect(result.grossReturn).toBe(400);          // 100 * 4.0
      expect(result.totalRisked).toBe(300);
      expect(result.guaranteedProfit).toBe(100);
      expect(result.isProfit).toBe(true);
      expect(result.roi).toBeCloseTo(1 / 3, 3);
    });

    it('breaks even when original and hedge odds are identical', () => {
      // Same odds on both sides: gross return exactly covers both stakes
      const result = hedgeBet(100, 100, 100);
      expect(result.guaranteedProfit).toBe(0);
      expect(result.isProfit).toBe(false);
      expect(result.hedgeStake).toBe(100); // equal odds → hedge = original stake
    });

    it('reflects a loss when hedge odds are shorter than original', () => {
      // Original at +100 (decimal 2.0), hedge at -200 (decimal 1.5)
      const result = hedgeBet(100, 100, -200);
      // hedgeStake = 100 * 2.0 / 1.5 ≈ 133.33
      // grossReturn = 200; totalRisked ≈ 233.33; profit ≈ -33.33
      expect(result.guaranteedProfit).toBeLessThan(0);
      expect(result.isProfit).toBe(false);
    });

    it('gross return is equal for both outcome scenarios', () => {
      // Property: hedgeStake * dHedge === originalStake * dOrig (equal gross)
      const r = hedgeBet(200, 250, 150);
      const dOrig = toDecimal(250);
      const dHedge = toDecimal(150);
      expect(r.hedgeStake * dHedge).toBeCloseTo(200 * dOrig, 1);
      expect(r.grossReturn).toBeCloseTo(200 * dOrig, 1);
    });

    it('throws on non-positive stake', () => {
      expect(() => hedgeBet(0, 200, -150)).toThrow(RangeError);
      expect(() => hedgeBet(-100, 200, -150)).toThrow(RangeError);
    });
  });
});
