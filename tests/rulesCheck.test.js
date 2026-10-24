import { describe, it, expect } from 'vitest';
import { validateClipAgainstRules } from '../src/utils/rulesCheck';

describe('rulesCheck', () => {
  const campaign = {
    minClipSec: 15,
    maxClipSec: 58,
    requiredHashtags: ['#ContentRewards', '#Shorts'],
    requiredMentions: ['@ContentRewards'],
    bannedWords: ['crypto', 'guaranteed profit', 'scam']
  };

  it('passes a fully compliant clip', () => {
    const clip = {
      durationSeconds: 30,
      title: 'How to scale clipping content @ContentRewards',
      description: 'Check out this strategy! #ContentRewards #Shorts',
      hashtags: ['#ContentRewards', '#Shorts'],
      hookText: 'The truth about creator rewards'
    };

    const res = validateClipAgainstRules(clip, campaign);
    expect(res.passed).toBe(true);
    expect(res.checks.duration.pass).toBe(true);
    expect(res.checks.hashtags.pass).toBe(true);
    expect(res.checks.mentions.pass).toBe(true);
    expect(res.checks.bannedWords.pass).toBe(true);
  });

  it('fails when duration violates campaign limits', () => {
    const clip = {
      durationSeconds: 10, // too short
      title: 'Title @ContentRewards',
      description: '#ContentRewards #Shorts',
      hashtags: ['#ContentRewards', '#Shorts']
    };

    const res = validateClipAgainstRules(clip, campaign);
    expect(res.passed).toBe(false);
    expect(res.checks.duration.pass).toBe(false);
  });

  it('fails when required hashtags are missing', () => {
    const clip = {
      durationSeconds: 25,
      title: 'Title @ContentRewards',
      description: 'Only #Shorts',
      hashtags: ['#Shorts']
    };

    const res = validateClipAgainstRules(clip, campaign);
    expect(res.passed).toBe(false);
    expect(res.checks.hashtags.pass).toBe(false);
    expect(res.checks.hashtags.missing).toContain('#ContentRewards');
  });

  it('fails when banned words are detected', () => {
    const clip = {
      durationSeconds: 25,
      title: 'How to get guaranteed profit in 2026',
      description: 'Check this @ContentRewards #ContentRewards #Shorts',
      hashtags: ['#ContentRewards', '#Shorts']
    };

    const res = validateClipAgainstRules(clip, campaign);
    expect(res.passed).toBe(false);
    expect(res.checks.bannedWords.pass).toBe(false);
    expect(res.checks.bannedWords.violations).toContain('guaranteed profit');
  });
});
