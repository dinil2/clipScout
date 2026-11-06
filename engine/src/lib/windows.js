/**
 * Sliding Window Segmentation & Pre-Ranking
 * Scans full podcast transcript timeline without discarding dialogue.
 */

import { scoreWindowHeuristic } from './scoring.js';

/**
 * Splits normalized transcript into overlapping candidate windows and pre-ranks them.
 *
 * @param {Array<{startSec: number, endSec: number, text: string}>} segments
 * @param {Object} [options]
 * @param {number} [options.windowDurationSec=90]
 * @param {number} [options.strideSec=30]
 * @param {number} [options.maxCandidates=30]
 * @returns {Array<{
 *   id: string,
 *   startSec: number,
 *   endSec: number,
 *   durationSec: number,
 *   text: string,
 *   heuristicScore: number
 * }>}
 */
export function generateAndPreRankWindows(segments, options = {}) {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  const windowDurationSec = options.windowDurationSec || 90;
  const strideSec = options.strideSec || 30;
  const maxCandidates = options.maxCandidates || 30;

  const timelineStart = segments[0].startSec;
  const timelineEnd = segments[segments.length - 1].endSec;
  const totalDuration = timelineEnd - timelineStart;

  // Single window for very short podcasts
  if (totalDuration <= windowDurationSec) {
    const text = segments.map(s => s.text).join(' ');
    const heuristicScore = scoreWindowHeuristic(text, totalDuration);
    return [{
      id: 'win-1',
      startSec: timelineStart,
      endSec: timelineEnd,
      durationSec: totalDuration,
      text,
      heuristicScore
    }];
  }

  const windows = [];
  let winIndex = 1;

  for (let t = timelineStart; t < timelineEnd - 10; t += strideSec) {
    const winStart = Math.round(t * 10) / 10;
    const winEnd = Math.round(Math.min(timelineEnd, t + windowDurationSec) * 10) / 10;
    const dur = winEnd - winStart;

    if (dur < 15) continue;

    const slice = segments.filter(s => s.endSec > winStart && s.startSec < winEnd);
    if (slice.length === 0) continue;

    const text = slice.map(s => s.text).join(' ').trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    if (wordCount < 15) continue;

    const heuristicScore = scoreWindowHeuristic(text, dur);

    windows.push({
      id: `win-${winIndex++}`,
      startSec: winStart,
      endSec: winEnd,
      durationSec: dur,
      text,
      heuristicScore
    });
  }

  // Pre-rank: Sort descending by heuristic score
  windows.sort((a, b) => b.heuristicScore - a.heuristicScore);

  // Diversity filter: Prevent 5 nearly-identical windows from crowding out the list
  const selected = [];
  for (const win of windows) {
    if (selected.length >= maxCandidates) break;

    // Reject if too close to an already selected window (< 25s start diff) unless score is exceptionally high
    const tooClose = selected.some(s => Math.abs(s.startSec - win.startSec) < 25);
    if (!tooClose || win.heuristicScore > 50) {
      selected.push(win);
    }
  }

  // Backfill if diversity filter was too aggressive
  if (selected.length < maxCandidates && windows.length > selected.length) {
    for (const win of windows) {
      if (!selected.includes(win)) {
        selected.push(win);
        if (selected.length >= maxCandidates) break;
      }
    }
  }

  // Re-sort chronologically for coherent LLM processing
  return selected.sort((a, b) => a.startSec - b.startSec);
}

