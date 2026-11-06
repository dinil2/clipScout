/**
 * Subtitle File Generation Service (.ass and .srt)
 * Builds ASS file with Snazo-style word highlights for ffmpeg libass burning,
 * and matching standard .srt subtitles for download.
 */

import path from 'path';
import fs from 'fs';
import { generateAssSubtitles } from '../lib/ass.js';
import { generateSrtForClip } from '../lib/srt.js';
import { CONFIG } from '../config.js';

/**
 * Prepares subtitle files for a specific clip
 *
 * @param {Array<{startSec: number, endSec: number, text: string, words?: any[]}>} allSegments
 * @param {number} clipStartSec
 * @param {number} clipEndSec
 * @param {string} outputDir
 * @param {string} clipId
 * @returns {{ assFilePath: string, srtFilePath: string, srtContent: string }}
 */
export function prepareClipSubtitles(allSegments, clipStartSec, clipEndSec, outputDir, clipId) {
  fs.mkdirSync(outputDir, { recursive: true });

  const assContent = generateAssSubtitles(allSegments, clipStartSec, clipEndSec, {
    fontName: 'Inter',
    fontSize: 58
  });

  const srtContent = generateSrtForClip(allSegments, clipStartSec, clipEndSec);

  const assFilePath = path.join(outputDir, `${clipId}.ass`);
  const srtFilePath = path.join(outputDir, `${clipId}.srt`);

  fs.writeFileSync(assFilePath, assContent, 'utf-8');
  fs.writeFileSync(srtFilePath, srtContent, 'utf-8');

  return {
    assFilePath,
    srtFilePath,
    srtContent
  };
}

/**
 * Formats a file path safely for ffmpeg's libass filter: ass='...'
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

