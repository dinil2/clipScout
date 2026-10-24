import { describe, it, expect } from 'vitest';
import { calculateTotalScore, calculateEarnings, calculateCampaignSummary, scoreWindowHeuristic } from '../src/utils/scoring';

describe('scoring', () => {
  it('calculates deterministic composite score from 4 sub-scores', () => {
    const result = calculateTotalScore({
      hook: 22,
      standaloneClarity: 20,
      emotionPayoff: 21,
      campaignFit: 25
    });

    expect(result.total).toBe(88);
    expect(result.hook).toBe(22);
    expect(result.standaloneClarity).toBe(20);
    expect(result.emotionPayoff).toBe(21);
    expect(result.campaignFit).toBe(25);
  });

  it('clamps sub-scores strictly between 0 and 25', () => {
    const result = calculateTotalScore({
      hook: 35, // above 25
      standaloneClarity: -10, // below 0
      emotionPayoff: 20,
      campaignFit: 20
    });

    expect(result.hook).toBe(25);
    expect(result.standaloneClarity).toBe(0);
    expect(result.total).toBe(65);
  });

  it('calculates CPM earnings capped at per-clip max', () => {
    // 10,000 views at $1.50 CPM = $15.00, cap is $50
    expect(calculateEarnings(10000, 1.50, 50.00)).toBe(15.00);

    // 100,000 views at $1.50 CPM = $150.00, capped at $50
    expect(calculateEarnings(100000, 1.50, 50.00)).toBe(50.00);

    // 0 views
    expect(calculateEarnings(0, 1.50, 50.00)).toBe(0.00);
  });

  it('calculates campaign summary with status counts and totals', () => {
    const clips = [
      { id: '1', status: 'posted', views: 20000 },
      { id: '2', status: 'submitted', views: 50000 },
      { id: '3', status: 'found', views: 0 }
    ];
    const campaign = { cpmRate: 2.00, perClipMax: 60.00 };

    const summary = calculateCampaignSummary(clips, campaign);
    expect(summary.totalClips).toBe(3);
    expect(summary.totalViews).toBe(70000);
    // Clip 1: 20k * 2/1000 = $40. Clip 2: 50k * 2/1000 = $100 -> capped at $60. Total = $100
    expect(summary.totalEarnings).toBe(100.00);
    expect(summary.byStatus.posted).toBe(1);
    expect(summary.byStatus.submitted).toBe(1);
    expect(summary.byStatus.found).toBe(1);
  });

  it('evaluates window heuristic score prioritizing dialogue density and cues', () => {
    const activeText = 'Why does this strategy work? The secret is focus! You will be shocked by the results.';
    const score = scoreWindowHeuristic(activeText, 10, {
      name: 'Strategy Focus',
      rules: 'Explain secrets and focus'
    });
    expect(score).toBeGreaterThan(30);
  });
});
