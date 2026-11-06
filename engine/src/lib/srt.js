/**
 * SRT (SubRip) Parsing and Subtitle Generation
 */

import { secondsToSrtTime, parseClockToSeconds } from './timestamps.js';

/**
 * Cleans formatting artifacts, sound markers, and HTML entities from subtitle text
 * @param {string} str
 * @returns {string}
 */
export function cleanSubtitleText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]*>/g, '') // strip any html tags
    .replace(/\[(?:Music|Applause|Laughter|Cheering|Audio)\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses SRT subtitle text into normalized segments
 * @param {string} content
 * @returns {Array<{startSec: number, endSec: number, text: string}>}
 */
export function parseSrt(content) {
  if (!content || typeof content !== 'string') return [];
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);
  const segments = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const timeLineIdx = lines.findIndex(l => l.includes('-->'));
    if (timeLineIdx === -1) continue;

    const timeLine = lines[timeLineIdx];
    const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
    if (!startStr || !endStr) continue;

    const startSec = Math.round(parseClockToSeconds(startStr) * 100) / 100;
    const endSec = Math.round(parseClockToSeconds(endStr) * 100) / 100;

    const textLines = lines.slice(timeLineIdx + 1);
    const text = cleanSubtitleText(textLines.join(' '));
    if (text && endSec > startSec) {
      segments.push({ startSec, endSec, text });
    }
  }

  return segments.sort((a, b) => a.startSec - b.startSec);
}

/**
 * Generates an SRT file string for a specific clip slice, with relative timestamps starting at 0
 * @param {Array<{startSec: number, endSec: number, text: string}>} segments
 * @param {number} clipStartSec
 * @param {number} clipEndSec
 * @returns {string}
 */
export function generateSrtForClip(segments, clipStartSec, clipEndSec) {
  if (!Array.isArray(segments) || segments.length === 0) return '';
  const clipDur = Math.max(1, clipEndSec - clipStartSec);

  const overlapping = segments.filter(s => s.endSec > clipStartSec && s.startSec < clipEndSec);
  if (overlapping.length === 0) return '';

  const entries = [];
  overlapping.forEach((seg, idx) => {
    const relStart = Math.max(0, Math.round((seg.startSec - clipStartSec) * 100) / 100);
    const relEnd = Math.min(clipDur, Math.round((seg.endSec - clipStartSec) * 100) / 100);

    if (relEnd > relStart) {
      entries.push(`${idx + 1}\n${secondsToSrtTime(relStart)} --> ${secondsToSrtTime(relEnd)}\n${seg.text}\n`);
    }
  });

  return entries.join('\n').trim();
}

