/**
 * ASS (Advanced SubStation Alpha) Subtitle Generator
 * Optimized for vertical 1080x1920 video with bold yellow (#FFE600) chunked subtitles
 * and Snazo-style active-word highlight subtitles.
 *
 * Style specifications:
 * - Canvas: 1080x1920 PlayRes
 * - Yellow Font: Montserrat ExtraBold (bundled open-license, OFL)
 * - Size: 66px default (Small 58 / Medium 66 / Large 76)
 * - PrimaryColour: Yellow #FFE600 (&H0000E6FF in ASS AABBGGRR)
 * - Outline: Black 5px, Shadow 2px
 * - Position: Centered horizontally at x=540, y=1235 (lower part of video box y=420..1500)
 * - Layout: 1-3 words per cue, subtle 80ms pop-in animation
 */

import { secondsToAssTime } from './timestamps.js';
import { censorText } from './censor.js';

// Color definitions in ASS &HAABBGGRR format:
// White: &H00FFFFFF
// Yellow #FFE600 -> &H0000E6FF (Alpha=00, B=00, G=E6, R=FF)
// Amber #FFB020 -> &H0020B0FF (Alpha=00, B=20, G=B0, R=FF)
export const ASS_COLORS = {
  YELLOW: '&H0000E6FF',
  WHITE: '&H00FFFFFF',
  BLACK: '&H00000000',
  ACCENT_AMBER: '&H0020B0FF',
  SHADOW_DARK: '&H90000000'
};

/**
 * Cleans a subtitle word/token:
 * - Keeps original spoken sentence case
 * - Removes commas and periods
 * - Preserves question marks ?, exclamation marks !, and apostrophes '
 * - Optionally censors strong profanities
 *
 * @param {string} token
 * @param {boolean} [censor=true]
 * @returns {string}
 */
export function cleanSubtitleToken(token, censor = true) {
  if (!token || typeof token !== 'string') return '';
  let cleaned = token.replace(/[,.]/g, '').trim();
  if (censor) {
    cleaned = censorText(cleaned);
  }
  return cleaned;
}

/**
 * Builds yellow ASS subtitle script for a set of subtitle chunks
 *
 * @param {Array<{startSec: number, endSec: number, text: string}>} chunks
 * @param {Object} [options]
 * @param {string} [options.fontFamily='Montserrat ExtraBold']
 * @param {number} [options.fontSize=66]
 * @param {number} [options.posY=1235]
 * @param {boolean} [options.popIn=true]
 * @param {boolean} [options.censor=true]
 * @returns {string}
 */
export function generateYellowAssSubtitles(chunks, options = {}) {
  const fontFamily = options.fontFamily || 'Montserrat ExtraBold';
  const fontSize = options.fontSize || 66;
  const posY = options.posY || 1235;
  const popIn = options.popIn !== false;
  const censor = options.censor !== false;

  const header = `[Script Info]
Title: ClipScout Yellow Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: YellowDefault,${fontFamily},${fontSize},${ASS_COLORS.YELLOW},${ASS_COLORS.YELLOW},${ASS_COLORS.BLACK},${ASS_COLORS.SHADOW_DARK},-1,0,0,0,100,100,0,0,1,5,2,5,40,40,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines = [header];

  for (const chunk of chunks) {
    if (!chunk.text || chunk.endSec <= chunk.startSec) continue;

    const start = secondsToAssTime(Math.max(0, chunk.startSec));
    const end = secondsToAssTime(Math.max(chunk.startSec + 0.1, chunk.endSec));
    const cleanedText = censor ? censorText(chunk.text) : chunk.text;

    // Subtle 80ms pop-in animation (90% to 100% scale) or plain placement
    let assLine = '';
    if (popIn) {
      assLine = `{\\an5\\pos(540,${posY})\\fscx90\\fscy90\\t(0,80,\\fscx100\\fscy100)}${cleanedText}`;
    } else {
      assLine = `{\\an5\\pos(540,${posY})}${cleanedText}`;
    }

    lines.push(`Dialogue: 0,${start},${end},YellowDefault,,0,0,0,,${assLine}`);
  }

  return lines.join('\n');
}

/**
 * Splits dialogue text and word timestamps into readable chunks of 3-6 words
 * @param {Array<{startSec: number, endSec: number, text: string, words?: Array<{word: string, start: number, end: number}>}>} segments
 * @param {number} clipStartSec
 * @param {number} clipEndSec
 * @param {number} [targetChunkSize=4]
 * @returns {Array<{
 *   startSec: number,
 *   endSec: number,
 *   words: Array<{word: string, start: number, end: number}>
 * }>}
 */
export function buildWordChunks(segments, clipStartSec, clipEndSec, targetChunkSize = 4) {
  const overlapping = segments.filter(s => s.endSec > clipStartSec && s.startSec < clipEndSec);
  if (overlapping.length === 0) return [];

  const chunks = [];

  for (const seg of overlapping) {
    const segStart = Math.max(0, seg.startSec - clipStartSec);
    const segEnd = Math.max(segStart + 0.1, seg.endSec - clipStartSec);
    const segDur = segEnd - segStart;

    let wordItems = [];

    if (Array.isArray(seg.words) && seg.words.length > 0) {
      wordItems = seg.words.map(w => ({
        word: w.word.trim(),
        start: Math.max(0, w.start - clipStartSec),
        end: Math.max(0, w.end - clipStartSec)
      })).filter(w => w.word.length > 0);
    } else {
      const rawWords = (seg.text || '').split(/\s+/).filter(Boolean);
      if (rawWords.length === 0) continue;

      const totalChars = rawWords.reduce((acc, w) => acc + w.length, 0);
      let runningStart = segStart;

      for (let i = 0; i < rawWords.length; i++) {
        const w = rawWords[i];
        const fraction = totalChars > 0 ? (w.length / totalChars) : (1 / rawWords.length);
        const wDur = Math.max(0.12, fraction * segDur);
        const wEnd = i === rawWords.length - 1 ? segEnd : runningStart + wDur;

        wordItems.push({
          word: w,
          start: Math.round(runningStart * 100) / 100,
          end: Math.round(wEnd * 100) / 100
        });
        runningStart = wEnd;
      }
    }

    let currentChunkWords = [];
    for (let i = 0; i < wordItems.length; i++) {
      currentChunkWords.push(wordItems[i]);

      const isPunctuationPause = /[.!?]$/.test(wordItems[i].word);
      const isSizeReached = currentChunkWords.length >= targetChunkSize;
      const isLastWord = i === wordItems.length - 1;

      if (isPunctuationPause || isSizeReached || isLastWord) {
        if (currentChunkWords.length > 0) {
          chunks.push({
            startSec: currentChunkWords[0].start,
            endSec: currentChunkWords[currentChunkWords.length - 1].end,
            words: currentChunkWords
          });
          currentChunkWords = [];
        }
      }
    }
  }

  return chunks;
}

/**
 * Generates full ASS subtitle file content from segments with active-word highlight tags
 *
 * @param {Array<{startSec: number, endSec: number, text: string, words?: any[]}>} segments
 * @param {number} clipStartSec
 * @param {number} clipEndSec
 * @param {Object} [options]
 * @param {string} [options.fontName='Inter']
 * @param {number} [options.fontSize=58]
 * @returns {string}
 */
export function generateAssSubtitles(segments, clipStartSec, clipEndSec, options = {}) {
  const fontName = options.fontName || 'Inter';
  const fontSize = options.fontSize || 58;

  const header = `[Script Info]
Title: ClipScout Snazo-Style Captions
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${ASS_COLORS.WHITE},${ASS_COLORS.ACCENT_AMBER},${ASS_COLORS.BLACK},${ASS_COLORS.SHADOW_DARK},-1,0,0,0,100,100,1,0,1,4.5,2.5,2,60,60,420,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const chunks = buildWordChunks(segments, clipStartSec, clipEndSec);
  if (chunks.length === 0) {
    return header;
  }

  const events = [];

  for (const chunk of chunks) {
    const chunkWords = chunk.words;
    if (chunkWords.length === 0) continue;

    for (let activeIdx = 0; activeIdx < chunkWords.length; activeIdx++) {
      const activeWord = chunkWords[activeIdx];
      const nextWord = chunkWords[activeIdx + 1];
      const start = secondsToAssTime(activeWord.start);
      const endSec = nextWord ? nextWord.start : Math.max(activeWord.end, activeWord.start + 0.15);
      const end = secondsToAssTime(endSec);

      const lineText = chunkWords.map((w, idx) => {
        if (idx === activeIdx) {
          return `{\\c${ASS_COLORS.ACCENT_AMBER}\\b1}${w.word}{\\c${ASS_COLORS.WHITE}\\b1}`;
        }
        return `{\\c${ASS_COLORS.WHITE}}${w.word}`;
      }).join(' ');

      events.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${lineText}`);
    }
  }

  return `${header}\n${events.join('\n')}\n`;
}
