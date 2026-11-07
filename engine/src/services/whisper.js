/**
 * Groq Whisper Speech-to-Text Transcription Service
 * Chunks long podcasts into <=10 min / <24 MB segments with 2s overlap,
 * extracts word timestamps, deduplicates overlap boundaries, and merges into unified timeline.
 */

import path from 'path';
import fs from 'fs';
import { CONFIG } from '../config.js';
import { runProcess } from '../lib/proc.js';
import { executeWithRateLimit } from '../lib/rateLimiter.js';
import { cleanSubtitleText } from '../lib/srt.js';

/**
 * Plans chunk boundary windows for long audio files
 *
 * @param {number} totalDurationSec
 * @param {number} [maxChunkSec=600] // 10 minutes
 * @param {number} [overlapSec=2.0]
 * @returns {Array<{ index: number, startSec: number, endSec: number, durationSec: number }>}
 */
export function planAudioChunks(totalDurationSec, maxChunkSec = 600, overlapSec = 2.0) {
  if (totalDurationSec <= 0) return [];

  if (totalDurationSec <= maxChunkSec) {
    return [{
      index: 1,
      startSec: 0,
      endSec: Math.round(totalDurationSec * 100) / 100,
      durationSec: Math.round(totalDurationSec * 100) / 100
    }];
  }

  const chunks = [];
  const step = maxChunkSec - overlapSec;
  let start = 0;
  let index = 1;

  while (start < totalDurationSec) {
    const end = Math.min(totalDurationSec, start + maxChunkSec);
    const dur = end - start;

    chunks.push({
      index: index++,
      startSec: Math.round(start * 100) / 100,
      endSec: Math.round(end * 100) / 100,
      durationSec: Math.round(dur * 100) / 100
    });

    if (end >= totalDurationSec) break;
    start += step;
  }

  return chunks;
}

/**
 * Deduplicates overlapping speech segments and words between adjacent chunks
 *
 * @param {Array<{startSec: number, endSec: number, text: string, words?: any[]}>} allSegments
 * @param {number} overlapSec
 * @returns {Array<{startSec: number, endSec: number, text: string, words?: any[]}>}
 */
export function deduplicateOverlapSegments(allSegments, overlapSec = 2.0) {
  if (allSegments.length === 0) return [];

  const merged = [];

  for (let i = 0; i < allSegments.length; i++) {
    const curr = allSegments[i];
    const prev = merged[merged.length - 1];

    if (!prev) {
      merged.push(curr);
      continue;
    }

    // If current starts before or within previous segment and has identical text
    if (curr.startSec <= prev.endSec && curr.text.toLowerCase() === prev.text.toLowerCase()) {
      prev.endSec = Math.max(prev.endSec, curr.endSec);
      continue;
    }

    // If segment start is earlier than previous endSec (boundary collision), clamp or filter duplicate words
    if (curr.startSec < prev.endSec) {
      if (curr.endSec <= prev.endSec) {
        // Entirely subsumed
        continue;
      }
      // Clamped start
      curr.startSec = prev.endSec;
      if (Array.isArray(curr.words)) {
        curr.words = curr.words.filter(w => w.start >= prev.endSec);
      }
    }

    if (curr.endSec > curr.startSec && curr.text.length > 0) {
      merged.push(curr);
    }
  }

  return merged.sort((a, b) => a.startSec - b.startSec);
}

/**
 * Extracts 16kHz mono MP3 audio track from any video file
 * @param {string} videoFilePath
 * @param {string} outputAudioPath
 * @param {string} [jobId]
 * @returns {Promise<string>}
 */
export async function extractAudioTrack(videoFilePath, outputAudioPath, jobId) {
  const args = [
    '-y',
    '-i', videoFilePath,
    '-vn',
    '-ar', '16000',
    '-ac', '1',
    '-b:a', '64k',
    outputAudioPath
  ];

  const res = await runProcess('ffmpeg', args, { jobId, timeoutMs: 120000 });
  if (res.exitCode !== 0 || !fs.existsSync(outputAudioPath)) {
    throw new Error(`Failed to extract audio track: ${res.stderr || 'ffmpeg error'}`);
  }

  return outputAudioPath;
}

/**
 * Transcribes a single audio chunk file using Groq Whisper API
 *
 * @param {string} chunkAudioPath
 * @param {number} timeOffsetSec
 * @param {(notice: string) => void} [onNotice]
 * @returns {Promise<{ segments: any[], text: string }>}
 */
export async function transcribeChunkWithGroq(chunkAudioPath, timeOffsetSec = 0, onNotice) {
  const apiKey = CONFIG.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in .env. Required for Whisper transcription.');
  }

  return executeWithRateLimit(async () => {
    const fileBuf = fs.readFileSync(chunkAudioPath);
    const formData = new FormData();
    const blob = new Blob([fileBuf], { type: 'audio/mpeg' });

    formData.append('file', blob, 'chunk.mp3');
    formData.append('model', CONFIG.GROQ_WHISPER_MODEL);
    formData.append('response_format', 'verbose_json');
    formData.append('temperature', '0.0');
    formData.append('language', 'en');
    formData.append('timestamp_granularities[]', 'segment');
    formData.append('timestamp_granularities[]', 'word');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    let res;
    try {
      res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        signal: controller.signal,
        body: formData
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 429) {
      const errText = await res.text();
      const err = new Error(`Groq Whisper rate limit: ${errText}`);
      err.status = 429;
      err.response = res;
      throw err;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq Whisper error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const rawSegments = data.segments || [];

    // Map top-level words array from verbose_json response if present
    const topLevelWords = Array.isArray(data.words) ? data.words.map(w => ({
      word: (w.word || '').trim(),
      start: Math.round((Number(w.start || 0) + timeOffsetSec) * 100) / 100,
      end: Math.round((Number(w.end || 0) + timeOffsetSec) * 100) / 100
    })).filter(w => w.word.length > 0) : [];

    const mappedSegments = rawSegments.map(s => {
      const startSec = Math.round((Number(s.start || 0) + timeOffsetSec) * 100) / 100;
      const endSec = Math.round((Number(s.end || 0) + timeOffsetSec) * 100) / 100;
      const text = cleanSubtitleText(s.text || '');

      let words = undefined;
      if (Array.isArray(s.words) && s.words.length > 0) {
        words = s.words.map(w => ({
          word: (w.word || '').trim(),
          start: Math.round((Number(w.start || 0) + timeOffsetSec) * 100) / 100,
          end: Math.round((Number(w.end || 0) + timeOffsetSec) * 100) / 100
        })).filter(w => w.word.length > 0);
      } else if (topLevelWords.length > 0) {
        words = topLevelWords.filter(w => w.start >= startSec - 0.2 && w.end <= endSec + 0.2);
      }

      return { startSec, endSec, text, words };
    }).filter(s => s.text.length > 0);

    return {
      segments: mappedSegments,
      text: data.text || ''
    };
  }, { onNotice, maxRetries: 4 });
}

/**
 * Full end-to-end Whisper transcription pipeline with audio slicing and concurrency control
 *
 * @param {string} fullAudioPath
 * @param {number} totalDurationSec
 * @param {Object} options
 * @param {string} options.jobId
 * @param {(progress: { currentChunk: number, totalChunks: number, percent: number, message: string }) => void} options.onProgress
 * @param {(notice: string) => void} options.onNotice
 * @returns {Promise<{ segments: any[], fullText: string, totalDurationSec: number }>}
 */
export async function transcribeAudioWithChunking(fullAudioPath, totalDurationSec, options) {
  const { jobId, onProgress, onNotice } = options;

  const chunks = planAudioChunks(totalDurationSec, CONFIG.WHISPER_CHUNK_MAX_DURATION_SEC, CONFIG.WHISPER_OVERLAP_SEC);
  const totalChunks = chunks.length;
  const chunkOutputDir = path.join(CONFIG.DATA_DIR, 'audio_chunks', jobId);
  fs.mkdirSync(chunkOutputDir, { recursive: true });

  const chunkResults = new Array(totalChunks);
  let completedChunks = 0;

  // Process chunks with concurrency cap (max 2 at once)
  const queue = [...chunks];
  const activeWorkers = [];

  const runWorker = async () => {
    while (queue.length > 0) {
      const chunk = queue.shift();
      if (!chunk) break;

      const chunkAudioFile = path.join(chunkOutputDir, `chunk_${chunk.index}.mp3`);

      // Extract slice using ffmpeg
      const sliceArgs = [
        '-y',
        '-ss', String(chunk.startSec),
        '-i', fullAudioPath,
        '-t', String(chunk.durationSec),
        '-c', 'copy',
        chunkAudioFile
      ];

      const sliceRes = await runProcess('ffmpeg', sliceArgs, { jobId, timeoutMs: 60000 });
      if (sliceRes.exitCode !== 0 || !fs.existsSync(chunkAudioFile) || fs.statSync(chunkAudioFile).size < 100) {
        throw new Error(`Failed to slice audio chunk ${chunk.index}: ${sliceRes.stderr || 'ffmpeg error'}`);
      }

      if (onProgress) {
        onProgress({
          currentChunk: completedChunks + 1,
          totalChunks,
          percent: Math.round(((completedChunks) / totalChunks) * 100),
          message: `Transcribing speech with Groq Whisper (${completedChunks + 1} of ${totalChunks})...`
        });
      }

      const result = await transcribeChunkWithGroq(chunkAudioFile, chunk.startSec, onNotice);
      chunkResults[chunk.index - 1] = result;
      completedChunks++;

      // Clean up chunk file
      try { fs.unlinkSync(chunkAudioFile); } catch {}

      if (onProgress) {
        onProgress({
          currentChunk: completedChunks,
          totalChunks,
          percent: Math.round((completedChunks / totalChunks) * 100),
          message: `Transcribed chunk ${completedChunks} of ${totalChunks}`
        });
      }
    }
  };

  const concurrency = Math.min(CONFIG.WHISPER_MAX_CONCURRENCY, totalChunks);
  for (let i = 0; i < concurrency; i++) {
    activeWorkers.push(runWorker());
  }

  await Promise.all(activeWorkers);

  // Clean up directory
  try { fs.rmdirSync(chunkOutputDir); } catch {}

  // Collect and deduplicate
  const rawAllSegments = [];
  const fullTextParts = [];

  for (const res of chunkResults) {
    if (res && res.segments) {
      rawAllSegments.push(...res.segments);
      if (res.text) fullTextParts.push(res.text);
    }
  }

  const normalizedSegments = deduplicateOverlapSegments(rawAllSegments, CONFIG.WHISPER_OVERLAP_SEC);

  if (normalizedSegments.length === 0) {
    throw new Error('No speech or spoken dialogue could be detected in this audio recording.');
  }

  return {
    segments: normalizedSegments,
    fullText: fullTextParts.join(' ').trim(),
    totalDurationSec
  };
}

