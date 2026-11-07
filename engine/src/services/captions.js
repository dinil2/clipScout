/**
 * Subtitle File Generation Service (.ass and .srt)
 * Builds 1-3 word chunked yellow ASS subtitles for the campaign-style Shorts look,
 * and matching clean .srt subtitles for YouTube Studio upload.
 */

import path from 'path';
import fs from 'fs';
import { generateYellowAssSubtitles, cleanSubtitleToken } from '../lib/ass.js';
import { generateSrtForClip } from '../lib/srt.js';
import { censorText } from '../lib/censor.js';
import { CONFIG } from '../config.js';

export { cleanSubtitleToken as cleanCaptionToken };

/**
 * Extracts and synthesizes a flat list of normalized words with timing
 */
function extractNormalizedWords(source, clipStartSec, clipEndSec) {
  if (!Array.isArray(source) || source.length === 0) return [];

  // 1. Direct array of word objects
  if (source[0] && (source[0].word !== undefined || source[0].text !== undefined && !source[0].words)) {
    if (source[0].word !== undefined) {
      return source
        .filter(w => {
          const s = w.startSec !== undefined ? w.startSec : (w.start || 0);
          const e = w.endSec !== undefined ? w.endSec : (w.end || s + 0.3);
          return e > clipStartSec && s < clipEndSec;
        })
        .map(w => ({
          raw: w.word,
          start: w.startSec !== undefined ? w.startSec : (w.start || 0),
          end: w.endSec !== undefined ? w.endSec : (w.end || (w.startSec || 0) + 0.3)
        }));
    }
  }

  // 2. Array of segments (with or without segment.words)
  const overlappingSegs = source.filter(s => s.endSec > clipStartSec && s.startSec < clipEndSec);
  const words = [];

  for (const seg of overlappingSegs) {
    if (Array.isArray(seg.words) && seg.words.length > 0) {
      for (const w of seg.words) {
        const s = w.startSec !== undefined ? w.startSec : (w.start || 0);
        const e = w.endSec !== undefined ? w.endSec : (w.end || s + 0.3);
        if (e > clipStartSec && s < clipEndSec) {
          words.push({
            raw: w.word,
            start: s,
            end: e
          });
        }
      }
    } else {
      // Synthesize word timings across segment duration based on character length
      const segText = seg.text || '';
      const tokens = segText.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) continue;

      const segDur = Math.max(0.2, seg.endSec - seg.startSec);
      const totalChars = tokens.reduce((sum, t) => sum + t.length, 0);

      let curStart = seg.startSec;
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const fraction = totalChars > 0 ? (token.length / totalChars) : (1 / tokens.length);
        const wordDur = Math.max(0.12, fraction * segDur);
        const curEnd = i === tokens.length - 1 ? seg.endSec : curStart + wordDur;

        if (curEnd > clipStartSec && curStart < clipEndSec) {
          words.push({
            raw: token,
            start: curStart,
            end: curEnd
          });
        }
        curStart = curEnd;
      }
    }
  }

  return words;
}

/**
 * Builds 1-3 word short subtitle chunks matching the target reference:
 * - 1 to 3 words per chunk
 * - Max ~18-20 characters per chunk
 * - Breaks at punctuation (?, !, commas, periods)
 * - Sentence case as spoken, commas & periods removed, ? and ! kept
 * - Censored strong profanity
 * - Merges chunks shorter than 0.18s
 * - Clamped to clip boundaries [0 .. (clipEndSec - clipStartSec)]
 *
 * @param {Array<any>} source Words array or segments array
 * @param {Object} [options]
 * @param {number} [options.clipStartSec=0]
 * @param {number} [options.clipEndSec=Infinity]
 * @param {boolean} [options.censor=true]
 * @param {number} [options.maxWords=3]
 * @param {number} [options.maxChars=18]
 * @returns {Array<{ startSec: number, endSec: number, text: string }>}
 */
export function buildShortSubtitleChunks(source, options = {}) {
  const clipStartSec = options.clipStartSec || 0;
  const clipEndSec = options.clipEndSec || Infinity;
  const censor = options.censor !== false;
  const maxWords = options.maxWords || 3;
  const maxChars = options.maxChars || 18;

  const rawWords = extractNormalizedWords(source, clipStartSec, clipEndSec);
  if (rawWords.length === 0) return [];

  const rawChunks = [];
  let currentGroup = [];

  for (let i = 0; i < rawWords.length; i++) {
    const item = rawWords[i];
    const rawToken = item.raw || '';
    const hasPunctuationPause = /[,.!?]$/.test(rawToken);

    // Clean word: remove commas and periods, keep ? and !
    const cleaned = cleanSubtitleToken(rawToken, censor);
    if (!cleaned) continue;

    const testWords = [...currentGroup, { ...item, text: cleaned }];
    const testText = testWords.map(w => w.text).join(' ');

    const exceedsCount = testWords.length > maxWords;
    const exceedsChars = testText.length > maxChars && currentGroup.length >= 1;

    if (exceedsCount || exceedsChars) {
      if (currentGroup.length > 0) {
        rawChunks.push(currentGroup);
        currentGroup = [];
      }
    }

    currentGroup.push({ ...item, text: cleaned });

    if (hasPunctuationPause) {
      rawChunks.push(currentGroup);
      currentGroup = [];
    }
  }

  if (currentGroup.length > 0) {
    rawChunks.push(currentGroup);
  }

  // Convert groups into timed chunks relative to clipStartSec
  const finalChunks = [];
  const clipDuration = clipEndSec !== Infinity ? (clipEndSec - clipStartSec) : Infinity;

  for (let i = 0; i < rawChunks.length; i++) {
    const group = rawChunks[i];
    if (group.length === 0) continue;

    const first = group[0];
    const last = group[group.length - 1];

    let start = Math.max(0, first.start - clipStartSec);
    let end = Math.min(clipDuration, Math.max(start + 0.1, last.end - clipStartSec));
    const text = group.map(w => w.text).join(' ').trim();

    if (!text) continue;

    // Ensure non-overlapping with previous chunk
    if (finalChunks.length > 0) {
      const prev = finalChunks[finalChunks.length - 1];
      if (start < prev.endSec) {
        start = prev.endSec;
      }
    }

    if (end <= start) {
      end = start + 0.18;
    }

    finalChunks.push({
      startSec: Math.round(start * 1000) / 1000,
      endSec: Math.round(end * 1000) / 1000,
      text
    });
  }

  // Merge chunks shorter than 0.18s into next chunk (or extend if at end)
  const merged = [];
  for (let i = 0; i < finalChunks.length; i++) {
    const chunk = finalChunks[i];
    const dur = chunk.endSec - chunk.startSec;

    if (dur < 0.18 && i + 1 < finalChunks.length) {
      const next = finalChunks[i + 1];
      // Merge into next chunk
      next.startSec = chunk.startSec;
      next.text = `${chunk.text} ${next.text}`;
    } else {
      if (dur < 0.18) {
        chunk.endSec = Math.min(clipDuration, chunk.startSec + 0.18);
      }
      merged.push(chunk);
    }
  }

  return merged;
}

/**
 * Prepares subtitle files for a specific clip
 *
 * @param {Array<any>} allSegments
 * @param {number} clipStartSec
 * @param {number} clipEndSec
 * @param {string} outputDir
 * @param {string} clipId
 * @param {Object} [options]
 * @param {string} [options.fontFamily='Montserrat ExtraBold']
 * @param {number} [options.fontSize=66]
 * @param {number} [options.posY=1235]
 * @param {boolean} [options.censor=true]
 * @param {boolean} [options.popIn=true]
 * @returns {{ assFilePath: string, srtFilePath: string, srtContent: string, chunks: Array<any> }}
 */
export function prepareClipSubtitles(allSegments, clipStartSec, clipEndSec, outputDir, clipId, options = {}) {
  fs.mkdirSync(outputDir, { recursive: true });

  const censor = options.censor !== false;
  const chunks = buildShortSubtitleChunks(allSegments, {
    clipStartSec,
    clipEndSec,
    censor
  });

  const assContent = generateYellowAssSubtitles(chunks, {
    fontFamily: options.fontFamily || CONFIG.DEFAULT_FONT_NAME || 'Montserrat ExtraBold',
    fontSize: options.fontSize || 66,
    posY: options.posY || 1235,
    popIn: options.popIn !== false,
    censor
  });

  // Also format clean standard SRT subtitles (with optional censor)
  let srtContent = generateSrtForClip(allSegments, clipStartSec, clipEndSec);
  if (censor) {
    srtContent = censorText(srtContent);
  }

  const assFilePath = path.join(outputDir, `${clipId}.ass`);
  const srtFilePath = path.join(outputDir, `${clipId}.srt`);

  fs.writeFileSync(assFilePath, assContent, 'utf-8');
  fs.writeFileSync(srtFilePath, srtContent, 'utf-8');

  return {
    assFilePath,
    srtFilePath,
    srtContent,
    chunks
  };
}

/**
 * Formats a file path safely for ffmpeg's libass filter: subtitles='...':fontsdir='...'
 * On Windows, backslashes must be replaced with forward slashes and colons escaped: C\:/...
 *
 * @param {string} filePath
 * @returns {string}
 */
export function formatFfmpegSubFilterPath(filePath) {
  let normalized = filePath.replace(/\\/g, '/');
  // Escape colon for Windows drive letters (e.g. C: -> C\:)
  normalized = normalized.replace(/^([a-zA-Z]):/, '$1\\:');
  // Escape single quotes
  normalized = normalized.replace(/'/g, "'\\''");
  return normalized;
}
