/**
 * Sentence Boundary Snapping & Duration Constraint Enforcement
 * Snaps approximate clip boundaries to actual speech/sentence boundaries
 * within ~3 seconds from real transcript segments.
 */

/**
 * Checks if a segment end is likely a sentence ending
 * @param {string} text
 * @returns {boolean}
 */
function isSentenceEnding(text) {
  if (!text) return false;
  const trimmed = text.trim();
  return /[.!?]["']?$/.test(trimmed);
}

/**
 * Checks if a text segment looks like the start of a new sentence
 * @param {string} text
 * @returns {boolean}
 */
function isSentenceStart(text) {
  if (!text) return false;
  const trimmed = text.trim();
  return /^[A-Z0-9"']/.test(trimmed);
}

/**
 * Snaps start and end timestamps to real sentence boundaries in the transcript
 * while strictly honoring the campaign's min and max duration bounds.
 *
 * @param {number} rawStartSec
 * @param {number} rawEndSec
 * @param {Array<{startSec: number, endSec: number, text: string}>} segments
 * @param {number} [minSec=15]
 * @param {number} [maxSec=58]
 * @param {number} [toleranceSec=3.5]
 * @returns {{ startSec: number, endSec: number, durationSec: number }}
 */
export function snapToSentenceBoundaries(rawStartSec, rawEndSec, segments, minSec = 15, maxSec = 58, toleranceSec = 3.5) {
  if (!Array.isArray(segments) || segments.length === 0) {
    const dur = Math.min(maxSec, Math.max(minSec, rawEndSec - rawStartSec));
    return {
      startSec: Math.max(0, Math.round(rawStartSec)),
      endSec: Math.max(0, Math.round(rawStartSec + dur)),
      durationSec: Math.round(dur)
    };
  }

  const transcriptStart = segments[0].startSec;
  const transcriptEnd = segments[segments.length - 1].endSec;

  // 1. Find best start boundary near rawStartSec within tolerance
  let bestStart = rawStartSec;
  let bestStartScore = -Infinity;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const diff = Math.abs(seg.startSec - rawStartSec);
    if (diff <= toleranceSec) {
      // Score based on proximity and whether previous segment ended a sentence
      let score = 10 - diff;
      const prev = segments[i - 1];
      if (!prev || isSentenceEnding(prev.text)) {
        score += 8;
      }
      if (prev && (seg.startSec - prev.endSec) > 0.5) {
        score += 5; // speech pause
      }
      if (isSentenceStart(seg.text)) {
        score += 3;
      }
      if (score > bestStartScore) {
        bestStartScore = score;
        bestStart = seg.startSec;
      }
    }
  }

  // 2. Find best end boundary near rawEndSec within tolerance
  let bestEnd = rawEndSec;
  let bestEndScore = -Infinity;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const diff = Math.abs(seg.endSec - rawEndSec);
    if (diff <= toleranceSec) {
      let score = 10 - diff;
      if (isSentenceEnding(seg.text)) {
        score += 8;
      }
      const next = segments[i + 1];
      if (next && (next.startSec - seg.endSec) > 0.5) {
        score += 5; // speech pause
      }
      if (score > bestEndScore) {
        bestEndScore = score;
        bestEnd = seg.endSec;
      }
    }
  }

  // Fallback if no candidate within tolerance
  if (bestStartScore === -Infinity) {
    const closestSeg = segments.reduce((prev, curr) => 
      Math.abs(curr.startSec - rawStartSec) < Math.abs(prev.startSec - rawStartSec) ? curr : prev
    );
    bestStart = closestSeg.startSec;
  }
  if (bestEndScore === -Infinity) {
    const closestSeg = segments.reduce((prev, curr) => 
      Math.abs(curr.endSec - rawEndSec) < Math.abs(prev.endSec - rawEndSec) ? curr : prev
    );
    bestEnd = closestSeg.endSec;
  }

  // 3. Enforce min/max length constraints
  let dur = bestEnd - bestStart;

  if (dur > maxSec) {
    // Search for a sentence-ending boundary <= bestStart + maxSec
    let foundShorterEnd = null;
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      if (seg.endSec <= bestStart + maxSec && seg.endSec >= bestStart + minSec) {
        if (isSentenceEnding(seg.text) || !foundShorterEnd) {
          foundShorterEnd = seg.endSec;
          if (isSentenceEnding(seg.text)) break;
        }
      }
    }
    bestEnd = foundShorterEnd || Math.min(transcriptEnd, bestStart + maxSec);
    dur = bestEnd - bestStart;
  }

  if (dur < minSec) {
    // Search for next sentence boundary >= bestStart + minSec
    let foundLongerEnd = null;
    for (const seg of segments) {
      if (seg.endSec >= bestStart + minSec && seg.endSec <= bestStart + maxSec) {
        if (isSentenceEnding(seg.text) || !foundLongerEnd) {
          foundLongerEnd = seg.endSec;
          if (isSentenceEnding(seg.text)) break;
        }
      }
    }
    bestEnd = foundLongerEnd || Math.min(transcriptEnd, bestStart + minSec);
    dur = bestEnd - bestStart;
  }

  // Final sanity clamps
  bestStart = Math.max(0, Math.max(transcriptStart, Math.round(bestStart * 10) / 10));
  bestEnd = Math.min(transcriptEnd, Math.round(bestEnd * 10) / 10);
  dur = Math.round((bestEnd - bestStart) * 10) / 10;

  return {
    startSec: bestStart,
    endSec: bestEnd,
    durationSec: dur
  };
}
