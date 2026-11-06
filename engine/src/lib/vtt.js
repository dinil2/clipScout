/**
 * WebVTT (.vtt) Parsing and Normalization Module
 * Specially designed to parse yt-dlp extracted YouTube caption tracks
 * and deduplicate auto-generated rolling caption lines.
 */

import { parseClockToSeconds } from './timestamps.js';
import { cleanSubtitleText } from './srt.js';

/**
 * Parses WebVTT content into normalized dialogue segments
 * @param {string} content
 * @returns {Array<{startSec: number, endSec: number, text: string}>}
 */
export function parseVtt(content) {
  if (!content || typeof content !== 'string') return [];

  // Normalize line endings
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const segments = [];

  let currentStart = null;
  let currentEnd = null;
  let currentTextLines = [];

  const timeRegex = /((?:\d{1,2}:)?\d{2}:\d{2}[\.,]\d{3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[\.,]\d{3})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip WEBVTT header and metadata lines
    if (!line || line.startsWith('WEBVTT') || line.startsWith('Kind:') || line.startsWith('Language:') || line.startsWith('NOTE')) {
      continue;
    }

    const match = line.match(timeRegex);
    if (match) {
      // Save previously accumulated cue if any
      if (currentStart !== null && currentEnd !== null && currentTextLines.length > 0) {
        const text = cleanSubtitleText(currentTextLines.join(' '));
        if (text && currentEnd > currentStart) {
          segments.push({ startSec: currentStart, endSec: currentEnd, text });
        }
      }

      currentStart = Math.round(parseClockToSeconds(match[1]) * 100) / 100;
      currentEnd = Math.round(parseClockToSeconds(match[2]) * 100) / 100;
      currentTextLines = [];
    } else if (currentStart !== null) {
      // Text line belonging to current cue
      // Strip formatting tags like <c> or <00:00:01.000>
      const cleanLine = line.replace(/<[^>]+>/g, '').trim();
      if (cleanLine) {
        currentTextLines.push(cleanLine);
      }
    }
  }

  // Push final cue
  if (currentStart !== null && currentEnd !== null && currentTextLines.length > 0) {
    const text = cleanSubtitleText(currentTextLines.join(' '));
    if (text && currentEnd > currentStart) {
      segments.push({ startSec: currentStart, endSec: currentEnd, text });
    }
  }

  // Deduplicate auto-generated rolling captions (where consecutive cues repeat the same sentence)
  const deduplicated = [];
  for (let i = 0; i < segments.length; i++) {
    const curr = segments[i];
    const prev = deduplicated[deduplicated.length - 1];

    if (!prev) {
      deduplicated.push(curr);
      continue;
    }

    // If current text is identical to previous, just extend previous end time
    if (curr.text === prev.text) {
      prev.endSec = Math.max(prev.endSec, curr.endSec);
      continue;
    }

    // If current text starts with previous text, replace previous with current
    if (curr.text.startsWith(prev.text) && Math.abs(curr.startSec - prev.startSec) < 4) {
      deduplicated[deduplicated.length - 1] = {
        startSec: prev.startSec,
        endSec: Math.max(prev.endSec, curr.endSec),
        text: curr.text
      };
      continue;
    }

    deduplicated.push(curr);
  }

  return deduplicated.sort((a, b) => a.startSec - b.startSec);
}

