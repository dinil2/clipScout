import { describe, it, expect } from 'vitest';
import { snapToSentenceBoundaries } from '../src/utils/snapping';

describe('snapping', () => {
  const segments = [
    { startSec: 0, endSec: 4.0, text: 'Hello and welcome everyone.' },
    { startSec: 4.8, endSec: 9.0, text: 'Today we discuss content rewards!' },
    { startSec: 9.5, endSec: 15.0, text: 'Here is the first secret you need.' },
    { startSec: 15.5, endSec: 22.0, text: 'Most creators fail because they rush.' },
    { startSec: 22.5, endSec: 30.0, text: 'If you focus on quality, you will win.' },
    { startSec: 30.5, endSec: 38.0, text: 'That is the entire lesson today.' }
  ];

  it('snaps raw boundaries to closest real sentence edges', () => {
    // Propose start 4.5, end 29.5
    const snapped = snapToSentenceBoundaries(4.5, 29.5, segments, 15, 58);
    expect(snapped.startSec).toBe(4.8);
    expect(snapped.endSec).toBe(30.0);
    expect(snapped.durationSec).toBe(25.2);
  });

  it('enforces campaign minimum duration constraint', () => {
    // Propose 5 seconds clip (4.8 to 9.0) with minSec = 15
    const snapped = snapToSentenceBoundaries(4.8, 9.0, segments, 15, 58);
    expect(snapped.durationSec).toBeGreaterThanOrEqual(15);
  });

  it('enforces campaign maximum duration constraint', () => {
    // Propose 70s clip with maxSec = 58
    const snapped = snapToSentenceBoundaries(0, 70, segments, 15, 58);
    expect(snapped.durationSec).toBeLessThanOrEqual(58);
  });
});
