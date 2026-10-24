/**
 * Universal Transcript Parsing and Normalization Module
 * Normalizes YouTube captions, SRT, VTT, timestamped text, and plain text
 * into a single unified format: { startSec: number, endSec: number, text: string }
 */

import { formatSecondsToTimestamp, parseTimestampToSeconds } from './youtube.js';

/**
 * Cleans HTML entities and sound effect markers from subtitle strings
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
    .replace(/\[(?:Music|Applause|Laughter|Cheering|Audio)\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes raw YouTube transcript items
 * Handles seconds vs milliseconds offset detection automatically
 * @param {Array<{offset: number, duration: number, text: string}>} rawItems
 * @returns {Array<{startSec: number, endSec: number, text: string}>}
 */
export function normalizeYouTubeTranscript(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return [];

  // Determine if offsets are in milliseconds
  const isMilliseconds = rawItems.some(item => (item.duration > 50 || item.offset > 86400));
  const scale = isMilliseconds ? 0.001 : 1.0;

  const result = [];
  for (const item of rawItems) {
    const text = cleanSubtitleText(item.text);
    if (!text) continue;

    const startSec = Math.max(0, Math.round((Number(item.offset) * scale) * 100) / 100);
    const durSec = Math.max(0.4, Math.round((Number(item.duration) * scale) * 100) / 100);
    const endSec = Math.round((startSec + durSec) * 100) / 100;

    result.push({ startSec, endSec, text });
  }

  return result.sort((a, b) => a.startSec - b.startSec);
}

/**
 * Parses timestamp string like "00:01:23,450" or "01:23.450" into fractional seconds
 * @param {string} timeStr
 * @returns {number}
 */
export function parseClockToSeconds(timeStr) {
  if (!timeStr) return 0;
  const normalized = timeStr.trim().replace(',', '.');
  const parts = normalized.split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return Math.max(0, hours * 3600 + minutes * 60 + seconds);
  }
  if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return Math.max(0, minutes * 60 + seconds);
  }
  return Math.max(0, parseFloat(normalized) || 0);
}

/**
 * Parses SubRip (.srt) text content
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

    // Line 0 might be index number (e.g. "1") or timestamp line directly
    let timeLineIdx = lines.findIndex(l => l.includes('-->'));
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
 * Parses WebVTT (.vtt) text content
 * @param {string} content
 * @returns {Array<{startSec: number, endSec: number, text: string}>}
 */
export function parseVtt(content) {
  if (!content || typeof content !== 'string') return [];
  const normalized = content.replace(/^WEBVTT[^\n]*\n+/i, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return parseSrt(normalized);
}

/**
 * Parses text containing inline timestamps such as [01:23] or (00:01:45)
 * @param {string} content
 * @returns {Array<{startSec: number, endSec: number, text: string}>}
 */
export function parseTimestampedText(content) {
  if (!content || typeof content !== 'string') return [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const rawParsed = [];

  const timeRegex = /\[?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]?/;

  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const timeStr = match[0].replace(/[\[\]]/g, '');
      const sec = parseTimestampToSeconds(timeStr);
      const text = cleanSubtitleText(line.replace(match[0], ''));
      if (text) {
        rawParsed.push({ startSec: sec, text });
      }
    }
  }

  if (rawParsed.length === 0) return [];

  // Infer endSec from subsequent line or default duration
  const segments = [];
  for (let i = 0; i < rawParsed.length; i++) {
    const curr = rawParsed[i];
    const next = rawParsed[i + 1];
    let endSec = next ? next.startSec : curr.startSec + 4;
    if (endSec <= curr.startSec) {
      endSec = curr.startSec + 3;
    }
    segments.push({
      startSec: curr.startSec,
      endSec: Math.round(endSec * 100) / 100,
      text: curr.text
    });
  }

  return segments.sort((a, b) => a.startSec - b.startSec);
}

/**
 * Parses raw plain text without timestamps by chunking into readable speech segments
 * @param {string} content
 * @param {number} [totalDurationSec]
 * @returns {Array<{startSec: number, endSec: number, text: string}>}
 */
export function parsePlainText(content, totalDurationSec = 0) {
  if (!content || typeof content !== 'string') return [];
  const cleaned = cleanSubtitleText(content);
  if (!cleaned) return [];

  // Split into sentences
  const sentenceMatches = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned];
  const segments = [];
  let currentTime = 0;

  // Average conversational speech rate: ~2.4 words per second
  const WORDS_PER_SEC = 2.4;

  for (const rawSentence of sentenceMatches) {
    const text = cleanSubtitleText(rawSentence);
    if (!text) continue;

    const words = text.split(/\s+/).length;
    const dur = Math.max(1.5, Math.round((words / WORDS_PER_SEC) * 10) / 10);
    const startSec = Math.round(currentTime * 10) / 10;
    const endSec = Math.round((startSec + dur) * 10) / 10;

    segments.push({ startSec, endSec, text });
    currentTime = endSec + 0.3; // brief pause between sentences
  }

  // If a known total duration was provided and differs significantly, normalize linearly
  if (totalDurationSec > 0 && segments.length > 0) {
    const calculatedTotal = segments[segments.length - 1].endSec;
    if (calculatedTotal > 0 && Math.abs(calculatedTotal - totalDurationSec) > 5) {
      const factor = totalDurationSec / calculatedTotal;
      return segments.map(s => ({
        startSec: Math.round(s.startSec * factor * 10) / 10,
        endSec: Math.round(s.endSec * factor * 10) / 10,
        text: s.text
      }));
    }
  }

  return segments;
}

/**
 * Universal detector and parser for any transcript input
 * @param {string} textContent
 * @param {string} [filenameOrType]
 * @param {number} [knownDurationSec]
 * @returns {Array<{startSec: number, endSec: number, text: string}>}
 */
export function parseUniversalTranscript(textContent, filenameOrType = '', knownDurationSec = 0) {
  if (!textContent || typeof textContent !== 'string') return [];
  const lowerHint = (filenameOrType || '').toLowerCase();

  if (lowerHint.endsWith('.srt') || textContent.includes('-->') && !textContent.includes('WEBVTT')) {
    const parsed = parseSrt(textContent);
    if (parsed.length > 0) return parsed;
  }

  if (lowerHint.endsWith('.vtt') || textContent.includes('WEBVTT')) {
    const parsed = parseVtt(textContent);
    if (parsed.length > 0) return parsed;
  }

  // Check for inline timestamps [mm:ss] or mm:ss
  const timestamped = parseTimestampedText(textContent);
  if (timestamped.length > 2) {
    return timestamped;
  }

  // Fallback to plain text segmenting
  return parsePlainText(textContent, knownDurationSec);
}

/**
 * Formats seconds into SRT timestamp: 00:00:00,000
 * @param {number} totalSec
 * @returns {string}
 */
export function formatSrtTime(totalSec) {
  const s = Math.max(0, totalSec);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Extracts and generates strict .SRT subtitles exclusively from real transcript segments
 * relative to the clip's startSec (startSec becomes 00:00:00,000)
 * @param {Array<{startSec: number, endSec: number, text: string}>} allSegments
 * @param {number} clipStartSec
 * @param {number} clipEndSec
 * @returns {string} Valid SRT formatted content
 */
export function generateSrtForClip(allSegments, clipStartSec, clipEndSec) {
  if (!Array.isArray(allSegments) || allSegments.length === 0) return '';
  const clipDur = Math.max(1, clipEndSec - clipStartSec);

  // Filter segments that overlap [clipStartSec, clipEndSec]
  const overlapping = allSegments.filter(s => s.endSec > clipStartSec && s.startSec < clipEndSec);
  if (overlapping.length === 0) return '';

  const srtEntries = [];
  overlapping.forEach((seg, idx) => {
    const relStart = Math.max(0, Math.round((seg.startSec - clipStartSec) * 100) / 100);
    const relEnd = Math.min(clipDur, Math.round((seg.endSec - clipStartSec) * 100) / 100);

    if (relEnd > relStart) {
      srtEntries.push(`${idx + 1}\n${formatSrtTime(relStart)} --> ${formatSrtTime(relEnd)}\n${seg.text}\n`);
    }
  });

  return srtEntries.join('\n').trim();
}
