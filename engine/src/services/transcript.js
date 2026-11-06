/**
 * Unified Transcript Service
 * 1. Checks on-disk transcript cache by fingerprint for instant re-runs.
 * 2. For YouTube: Attempts yt-dlp manual captions, then auto-generated captions (parsed from VTT).
 * 3. Fallback: Extracts audio and transcribes with chunked Groq Whisper.
 */

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { CONFIG } from '../config.js';
import { runProcess } from '../lib/proc.js';
import { parseVtt } from '../lib/vtt.js';
import { extractAudioTrack, transcribeAudioWithChunking } from './whisper.js';

/**
 * Computes unique cache key for a source
 * @param {Object} sourceMeta
 * @returns {string}
 */
export function getSourceFingerprint(sourceMeta) {
  const rawKey = `${sourceMeta.sourceType}:${sourceMeta.id}:${sourceMeta.durationSec || 0}:${sourceMeta.fileSize || 0}`;
  return crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 24);
}

/**
 * Attempts to download YouTube closed captions using yt-dlp (.vtt)
 * Tries manual creator captions first, then auto-generated captions.
 *
 * @param {string} url
 * @param {string} tempBaseDir
 * @param {string} [jobId]
 * @returns {Promise<Array<{startSec: number, endSec: number, text: string}>|null>}
 */
export async function fetchYoutubeCaptionsViaYtdlp(url, tempBaseDir, jobId) {
  const outTemplate = path.join(tempBaseDir, `ytdlp_sub_${Date.now()}`);

  // 1. Try manual subtitles first
  const manualArgs = [
    '--write-sub',
    '--sub-lang', 'en.*,en',
    '--sub-format', 'vtt',
    '--skip-download',
    '--no-warnings',
    '--quiet',
    '-o', outTemplate
  ];

  if (CONFIG.YTDLP_COOKIES_FROM_BROWSER) {
    manualArgs.push('--cookies-from-browser', CONFIG.YTDLP_COOKIES_FROM_BROWSER);
  }
  manualArgs.push(url);

  try {
    await runProcess('yt-dlp', manualArgs, { jobId, timeoutMs: 25000 });
  } catch {}

  // Check if any .vtt file was written
  let vttFiles = fs.readdirSync(tempBaseDir).filter(f => f.startsWith(path.basename(outTemplate)) && f.endsWith('.vtt'));

  // 2. If no manual sub, try auto-generated captions
  if (vttFiles.length === 0) {
    const autoArgs = [
      '--write-auto-sub',
      '--sub-lang', 'en.*,en',
      '--sub-format', 'vtt',
      '--skip-download',
      '--no-warnings',
      '--quiet',
      '-o', outTemplate
    ];

    if (CONFIG.YTDLP_COOKIES_FROM_BROWSER) {
      autoArgs.push('--cookies-from-browser', CONFIG.YTDLP_COOKIES_FROM_BROWSER);
    }
    autoArgs.push(url);

    try {
      await runProcess('yt-dlp', autoArgs, { jobId, timeoutMs: 25000 });
    } catch {}

    vttFiles = fs.readdirSync(tempBaseDir).filter(f => f.startsWith(path.basename(outTemplate)) && f.endsWith('.vtt'));
  }

  if (vttFiles.length === 0) {
    return null;
  }

  // Read and parse the primary VTT file
  const chosenFile = path.join(tempBaseDir, vttFiles[0]);
  const content = fs.readFileSync(chosenFile, 'utf-8');

  // Clean up subtitle files
  for (const f of vttFiles) {
    try { fs.unlinkSync(path.join(tempBaseDir, f)); } catch {}
  }

  const segments = parseVtt(content);
  return segments.length > 0 ? segments : null;
}

/**
 * Resolves or extracts complete timestamped dialogue transcript for any source
 *
 * @param {Object} sourceMeta
 * @param {Object} options
 * @param {string} options.jobId
 * @param {(progress: any) => void} [options.onProgress]
 * @param {(notice: string) => void} [options.onNotice]
 * @returns {Promise<{ segments: Array<{startSec: number, endSec: number, text: string, words?: any[]}>, fromCache: boolean, method: string }>}
 */
export async function getOrExtractTranscript(sourceMeta, options = {}) {
  const { jobId, onProgress, onNotice } = options;
  const fingerprint = getSourceFingerprint(sourceMeta);
  const cachePath = path.join(CONFIG.DATA_DIR, 'transcripts', `${fingerprint}.json`);

  // 1. Check disk cache
  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (Array.isArray(cached.segments) && cached.segments.length > 0) {
        return {
          segments: cached.segments,
          fromCache: true,
          method: cached.method || 'cache'
        };
      }
    } catch {}
  }

  let finalSegments = null;
  let method = 'whisper';
  const tempDir = path.join(CONFIG.DATA_DIR, 'sources', jobId);
  fs.mkdirSync(tempDir, { recursive: true });

  // 2. If YouTube, try fast VTT closed captions first
  if (sourceMeta.sourceType === 'youtube' && sourceMeta.webpageUrl) {
    if (onProgress) {
      onProgress({ percent: 15, message: 'Checking YouTube closed captions track...' });
    }

    try {
      const vttSegments = await fetchYoutubeCaptionsViaYtdlp(sourceMeta.webpageUrl, tempDir, jobId);
      if (vttSegments && vttSegments.length > 0) {
        finalSegments = vttSegments;
        method = 'youtube_vtt';
      }
    } catch (err) {
      console.warn('YouTube VTT captions fetch failed, falling back to Whisper:', err.message);
    }
  }

  // 3. Fallback to Whisper Speech-to-Text
  if (!finalSegments || finalSegments.length === 0) {
    if (onProgress) {
      onProgress({ percent: 25, message: 'Extracting audio for Groq Whisper transcription...' });
    }

    let audioPath = '';
    const tempAudio = path.join(tempDir, 'podcast_audio.mp3');

    if (sourceMeta.sourceType === 'local' && sourceMeta.filePath && fs.existsSync(sourceMeta.filePath)) {
      audioPath = await extractAudioTrack(sourceMeta.filePath, tempAudio, jobId);
    } else {
      // Remote source (YouTube or Drive): download audio with yt-dlp
      const ytdlpAudioArgs = [
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '64k',
        '--no-warnings',
        '--quiet',
        '-o', tempAudio
      ];

      if (CONFIG.YTDLP_COOKIES_FROM_BROWSER) {
        ytdlpAudioArgs.push('--cookies-from-browser', CONFIG.YTDLP_COOKIES_FROM_BROWSER);
      }
      ytdlpAudioArgs.push(sourceMeta.webpageUrl || sourceMeta.url);

      const dlRes = await runProcess('yt-dlp', ytdlpAudioArgs, { jobId, timeoutMs: 180000 });
      if (dlRes.exitCode !== 0 || !fs.existsSync(tempAudio)) {
        throw new Error(`Failed to download audio for transcription: ${dlRes.stderr || 'yt-dlp error'}`);
      }
      audioPath = tempAudio;
    }

    const whisperResult = await transcribeAudioWithChunking(
      audioPath,
      sourceMeta.durationSec || 60,
      { jobId, onProgress, onNotice }
    );

    finalSegments = whisperResult.segments;
    method = 'groq_whisper';

    try { fs.unlinkSync(tempAudio); } catch {}
  }

  // Clean up temp dir if empty
  try { fs.rmdirSync(tempDir); } catch {}

  if (!finalSegments || finalSegments.length === 0) {
    throw new Error('No usable speech dialogue found in this recording.');
  }

  // 4. Save to disk cache
  try {
    fs.writeFileSync(cachePath, JSON.stringify({
      fingerprint,
      title: sourceMeta.title,
      durationSec: sourceMeta.durationSec,
      method,
      createdAt: new Date().toISOString(),
      segments: finalSegments
    }, null, 2));
  } catch (err) {
    console.warn('Failed to write transcript cache:', err.message);
  }

  return {
    segments: finalSegments,
    fromCache: false,
    method
  };
}

