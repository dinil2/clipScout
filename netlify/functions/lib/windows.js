/**
 * Sliding Window Segmentation & Heuristic Pre-Ranking
 * Uses 100% of the transcript without discarding or downsampling dialogue.
 */

import { scoreWindowHeuristic } from '../../../src/utils/scoring.js';
import { BACKEND_CONFIG } from './constants.js';

/**
 * Splits normalized transcript into overlapping candidate windows (default 90s duration, 30s stride)
 * and pre-ranks them using cheap in-code heuristics.
 *
 * @param {Array<{startSec: number, endSec: number, text: string}>} segments
 * @param {Object} [campaign]
 * @param {number} [windowDurationSec]
 * @param {number} [strideSec]
 * @returns {Array<{
 *   id: string,
 *   startSec: number,
 *   endSec: number,
 *   durationSec: number,
 *   text: string,
 *   heuristicScore: number
 * }>}
 */
export function generateAndPreRankWindows(
  segments,
  campaign = {},
  windowDurationSec = BACKEND_CONFIG.WINDOW_DURATION_SEC,
  strideSec = BACKEND_CONFIG.STRIDE_SEC
) {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  const timelineStart = segments[0].startSec;
  const timelineEnd = segments[segments.length - 1].endSec;
  const totalDuration = timelineEnd - timelineStart;

  // If entire video is shorter than window duration, return a single window
  if (totalDuration <= windowDurationSec) {
    const text = segments.map(s => s.text).join(' ');
    const heuristicScore = scoreWindowHeuristic(text, totalDuration, campaign);
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

    // Collect segments inside [winStart, winEnd]
    const slice = segments.filter(s => s.endSec > winStart && s.startSec < winEnd);
    if (slice.length === 0) continue;

    const text = slice.map(s => s.text).join(' ').trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // Must contain enough words to form a real clip
    if (wordCount < 15) continue;

    const heuristicScore = scoreWindowHeuristic(text, dur, campaign);

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
    if (selected.length >= BACKEND_CONFIG.TOP_PRE_RANK_LIMIT) break;

    // Check if heavily overlapping with an already selected window (within 20s start difference)
    const tooClose = selected.some(s => Math.abs(s.startSec - win.startSec) < 20);
    if (!tooClose || win.heuristicScore > 40) {
      selected.push(win);
    }
  }

  // If diversity filter was too strict, backfill from remaining
  if (selected.length < BACKEND_CONFIG.TOP_PRE_RANK_LIMIT && windows.length > selected.length) {
    for (const win of windows) {
      if (!selected.includes(win)) {
        selected.push(win);
        if (selected.length >= BACKEND_CONFIG.TOP_PRE_RANK_LIMIT) break;
      }
    }
  }

  // Re-sort selected candidates chronologically so LLM processes the flow logically
  return selected.sort((a, b) => a.startSec - b.startSec);
}
