/**
 * ASS (Advanced SubStation Alpha) Subtitle Generator
 * Optimized for vertical 1080x1920 video with Snazo-style active word highlighting.
 *
 * Style specifications:
 * - Font: Inter (bundled open-license)
 * - Size: ~60-64px at 1080p PlayRes
 * - Colors: White text with #FFB020 active word highlight (&H0020B0FF in ASS BGR)
 * - Outline: Thick black outline (4px) + soft drop shadow
 * - Placement: Lower-middle (MarginV=420, keeps bottom 20% clear of YouTube Shorts UI)
 * - Layout: Max 2 lines, 3-6 words per chunk
 */

import { secondsToAssTime } from './timestamps.js';

// Color definitions in ASS &HAABBGGRR format:
// White: &H00FFFFFF
// Accent #FFB020 -> R=FF, G=B0, B=20 -> ASS BGR: &H0020B0FF
export const ASS_COLORS = {
  WHITE: '&H00FFFFFF',
  ACCENT_AMBER: '&H0020B0FF', // #FFB020
  BLACK: '&H00000000',
  SHADOW_DARK: '&H90000000'
};

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
      // Use real Whisper word timestamps
      wordItems = seg.words.map(w => ({
        word: w.word.trim(),
        start: Math.max(0, w.start - clipStartSec),
        end: Math.max(0, w.end - clipStartSec)
      })).filter(w => w.word.length > 0);
    } else {
      // Synthesize word timings by character-length distribution
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

    // Partition wordItems into chunks of 3-5 words (max 2 lines)
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

    // Create an event for each active word inside this chunk
    for (let activeIdx = 0; activeIdx < chunkWords.length; activeIdx++) {
      const activeWord = chunkWords[activeIdx];
      const nextWord = chunkWords[activeIdx + 1];
      const start = secondsToAssTime(activeWord.start);
      // End timestamp is next word's start, or chunk end
      const endSec = nextWord ? nextWord.start : Math.max(activeWord.end, activeWord.start + 0.15);
      const end = secondsToAssTime(endSec);

      // Render the entire chunk line, highlighting only the current active word
      const lineText = chunkWords.map((w, idx) => {
        if (idx === activeIdx) {
          // Highlight with accent color & subtle scale pop
          return `{\\c${ASS_COLORS.ACCENT_AMBER}\\b1}${w.word}{\\c${ASS_COLORS.WHITE}\\b1}`;
        }
        return `{\\c${ASS_COLORS.WHITE}}${w.word}`;
      }).join(' ');

      events.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${lineText}`);
    }
  }

  return `${header}\n${events.join('\n')}\n`;
}

