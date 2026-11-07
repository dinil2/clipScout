/**
 * Source Resolver & Video Metadata Service
 * Resolves YouTube links, public Google Drive URLs, and local laptop uploads.
 */

import path from 'path';
import fs from 'fs';
import { CONFIG } from '../config.js';
import { runProcess } from '../lib/proc.js';
import { runYtdlp } from './ytdlp.js';
import { secondsToClock } from '../lib/timestamps.js';

/**
 * Extracts 11-character YouTube video ID
 * @param {string} url
 * @returns {string|null}
 */
export function extractYoutubeId(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

/**
 * Determines source type from input URL or payload
 * @param {string} input
 * @returns {'youtube'|'drive'|'local'|'unknown'}
 */
export function detectSourceType(input) {
  if (!input) return 'unknown';
  if (extractYoutubeId(input)) return 'youtube';
  if (input.includes('drive.google.com')) return 'drive';
  if (fs.existsSync(input)) return 'local';
  return 'unknown';
}

/**
 * Resolves metadata for a local file using ffprobe
 * @param {string} filePath
 * @param {string} [originalFilename]
 * @returns {Promise<Object>}
 */
export async function resolveLocalFileMetadata(filePath, originalFilename = '') {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Local file not found at: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  const title = (originalFilename || path.basename(filePath)).replace(/\.[^/.]+$/, '');

  const probeArgs = [
    '-v', 'error',
    '-show_entries', 'format=duration,size:stream=width,height,codec_type',
    '-of', 'json',
    filePath
  ];

  const probeRes = await runProcess('ffprobe', probeArgs);
  let durationSec = 0;
  let width = 1920;
  let height = 1080;

  try {
    const data = JSON.parse(probeRes.stdout);
    durationSec = Math.round(parseFloat(data.format?.duration || '0'));
    const videoStream = (data.streams || []).find(s => s.codec_type === 'video');
    if (videoStream) {
      width = videoStream.width || 1920;
      height = videoStream.height || 1080;
    }
  } catch {}

  return {
    sourceType: 'local',
    id: path.basename(filePath),
    title,
    channel: 'Laptop Upload',
    durationSec,
    durationFormatted: secondsToClock(durationSec),
    thumbnail: '',
    filePath,
    fileSize: stat.size,
    width,
    height
  };
}

/**
 * Resolves metadata for YouTube or Google Drive URL using yt-dlp --dump-json
 *
 * @param {string} url
 * @param {Object} [options]
 * @param {string} [options.jobId]
 * @returns {Promise<Object>}
 */
export async function resolveRemoteMetadata(url, options = {}) {
  const isDrive = url.includes('drive.google.com');
  const youtubeId = extractYoutubeId(url);

  const args = [
    '--dump-json',
    '--no-playlist'
  ];

  args.push(url);

  try {
    const res = await runYtdlp(args, { jobId: options.jobId, timeoutMs: 35000 });
    if (res.exitCode !== 0 || !res.stdout) {
      const errLower = (res.stderr || '').toLowerCase();

      if (isDrive && (errLower.includes('permission') || errLower.includes('private') || errLower.includes('access'))) {
        throw new Error('This Google Drive video is not public. Please set link sharing to "Anyone with the link can view", or upload the file directly.');
      }

      if (errLower.includes('private video') || errLower.includes('sign in')) {
        throw new Error('This YouTube video is private or requires sign-in. Set YTDLP_COOKIES_FROM_BROWSER in .env or upload the video directly.');
      }

      throw new Error(`yt-dlp failed to read video: ${res.stderr || 'Unknown error'}. Hint: Run 'npm run update:ytdlp'.`);
    }

    const info = JSON.parse(res.stdout);
    const durationSec = Math.round(Number(info.duration || 0));

    return {
      sourceType: isDrive ? 'drive' : 'youtube',
      id: info.id || youtubeId || 'remote-video',
      title: info.title || (isDrive ? 'Google Drive Podcast' : 'YouTube Video'),
      channel: info.uploader || info.channel || (isDrive ? 'Google Drive' : 'Creator'),
      durationSec,
      durationFormatted: secondsToClock(durationSec),
      thumbnail: info.thumbnail || (youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : ''),
      webpageUrl: info.webpage_url || url,
      width: info.width || 1920,
      height: info.height || 1080
    };
  } catch (err) {
    if (isDrive && err.message.includes('not public')) throw err;
    if (err.message.includes('private or requires sign-in')) throw err;
    throw new Error(`Failed to inspect video: ${err.message}. Hint: Ensure link is valid or run 'npm run update:ytdlp'.`);
  }
}

