/**
 * WebVTT (.vtt) Parsing and Normalization Module
 * Specially designed to parse yt-dlp extracted YouTube caption tracks,
 * deduplicate auto-generated rolling caption lines,
 * and extract inline <c> word-level timing tags into words[].
 */

import { parseClockToSeconds } from './timestamps.js';
import { cleanSubtitleText } from './srt.js';

/**
 * Extracts inline <c> word timestamps from a VTT cue line
 * Example: "<c>Hello</c><00:00:01.500><c> beautiful</c><00:00:02.200><c> world</c>"
 *
 * @param {string} rawLine
 * @param {number} cueStartSec
 * @param {number} cueEndSec
 * @returns {Array<{ word: string, startSec: number, endSec: number }>}
 */
export function extractInlineWords(rawLine, cueStartSec, cueEndSec) {
  if (!rawLine || !rawLine.includes('<c>')) return [];

  const words = [];
  // Tokenize by timestamp tags <hh:mm:ss.ms> and <c> tags
  // Regex to match either a timestamp tag <00:00:00.000> or a word tag <c>word</c> or </c>
  const tagRegex = /(?:<(\d{1,2}:\d{2}:\d{2}[\.,]\d{3})>)|(?:<c>([^<]+)<\/c>)|(?:<c>(?:<\/c>)?)/g;

  let currentTime = cueStartSec;
  let match;

  while ((match = tagRegex.exec(rawLine)) !== null) {
    if (match[1]) {
      // Timestamp tag <00:00:01.500>
      currentTime = parseClockToSeconds(match[1]);
    } else if (match[2]) {
      // Word inside <c>word</c>
      const wordText = match[2].trim();
      if (wordText) {
        words.push({
          word: wordText,
          startSec: currentTime,
          endSec: cueEndSec // Will be refined by next word start
        });
      }
    }
  }

  // Refine endSec of each word to match next word's startSec
  for (let i = 0; i < words.length; i++) {
    if (i + 1 < words.length) {
      words[i].endSec = Math.max(words[i].startSec + 0.1, words[i + 1].startSec);
    } else {
      words[i].endSec = Math.max(words[i].startSec + 0.1, cueEndSec);
    }
  }

  return words;
}

/**
 * Parses WebVTT content into normalized dialogue segments
 * @param {string} content
 * @returns {Array<{startSec: number, endSec: number, text: string, words?: any[]}>}
 */
export function parseVtt(content) {
  if (!content || typeof content !== 'string') return [];

  // Normalize line endings
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const segments = [];

  let currentStart = null;
  let currentEnd = null;
  let currentRawLines = [];

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
      if (currentStart !== null && currentEnd !== null && currentRawLines.length > 0) {
        const rawJoined = currentRawLines.join(' ');
        const cleanText = cleanSubtitleText(rawJoined.replace(/<[^>]+>/g, ''));
        const inlineWords = extractInlineWords(rawJoined, currentStart, currentEnd);

        if (cleanText && currentEnd > currentStart) {
          segments.push({
            startSec: currentStart,
            endSec: currentEnd,
            text: cleanText,
            ...(inlineWords.length > 0 ? { words: inlineWords } : {})
          });
        }
      }

      currentStart = Math.round(parseClockToSeconds(match[1]) * 1000) / 1000;
      currentEnd = Math.round(parseClockToSeconds(match[2]) * 1000) / 1000;
      currentRawLines = [];
    } else if (currentStart !== null) {
      currentRawLines.push(line);
    }
  }

  // Push final cue
  if (currentStart !== null && currentEnd !== null && currentRawLines.length > 0) {
    const rawJoined = currentRawLines.join(' ');
    const cleanText = cleanSubtitleText(rawJoined.replace(/<[^>]+>/g, ''));
    const inlineWords = extractInlineWords(rawJoined, currentStart, currentEnd);

    if (cleanText && currentEnd > currentStart) {
      segments.push({
        startSec: currentStart,
        endSec: currentEnd,
        text: cleanText,
        ...(inlineWords.length > 0 ? { words: inlineWords } : {})
      });
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
        text: curr.text,
        words: curr.words || prev.words
      };
      continue;
    }

    deduplicated.push(curr);
  }

  return deduplicated.sort((a, b) => a.startSec - b.startSec);
}
