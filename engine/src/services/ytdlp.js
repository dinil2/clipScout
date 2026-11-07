/**
 * Unified yt-dlp Service Wrapper
 * Enforces:
 * - Node JS runtime (--js-runtimes node) & GitHub remote EJS solver for YouTube challenge compatibility
 * - Stall detection with watchdog (kills process after 90s without stdout/stderr activity)
 * - Safe downloads with atomic rename (leaves .part until verified, unlinks broken partials on failure)
 * - Streamlined progress tracking
 * - Clean audio extraction and section slicing
 */

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { CONFIG } from '../config.js';
import { registerJobProcess } from '../lib/proc.js';

/**
 * Builds base yt-dlp CLI arguments including JS runtime & remote components
 * @param {string[]} [extraArgs=[]]
 * @returns {string[]}
 */
export function buildYtdlpBaseArgs(extraArgs = []) {
  const args = [
    '--js-runtimes', 'node',
    '--remote-components', 'ejs:github',
    '--no-warnings'
  ];

  if (CONFIG.YTDLP_COOKIES_FROM_BROWSER) {
    args.push('--cookies-from-browser', CONFIG.YTDLP_COOKIES_FROM_BROWSER);
  }

  return [...args, ...extraArgs];
}

/**
 * Executes yt-dlp with stall watchdog and optional progress parsing
 *
 * @param {string[]} args
 * @param {Object} [options]
 * @param {string} [options.jobId]
 * @param {number} [options.timeoutMs=300000] - Hard total timeout (default 5 min)
 * @param {number} [options.stallTimeoutMs=90000] - Stall timeout without any output (default 90s)
 * @param {(progress: { percent: number, speed?: string, eta?: string }) => void} [options.onProgress]
 * @returns {Promise<{ exitCode: number, stdout: string, stderr: string }>}
 */
export function runYtdlp(args, options = {}) {
  const {
    jobId,
    timeoutMs = 300000,
    stallTimeoutMs = 90000,
    onProgress
  } = options;

  return new Promise((resolve, reject) => {
    const finalArgs = buildYtdlpBaseArgs(args);
    let child;
    try {
      child = spawn('yt-dlp', finalArgs, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (spawnErr) {
      return reject(new Error(`Failed to execute yt-dlp: ${spawnErr.message}`));
    }

    if (jobId) {
      registerJobProcess(jobId, child);
    }

    let stdout = '';
    let stderr = '';
    let isSettled = false;

    let totalTimer = null;
    let stallTimer = null;

    const resetStallTimer = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try { child.kill('SIGKILL'); } catch {}
          reject(new Error(`yt-dlp stalled: No network activity or output for ${Math.round(stallTimeoutMs / 1000)}s.`));
        }
      }, stallTimeoutMs);
    };

    resetStallTimer();

    if (timeoutMs > 0) {
      totalTimer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try { child.kill('SIGKILL'); } catch {}
          reject(new Error(`yt-dlp execution exceeded hard timeout limit of ${Math.round(timeoutMs / 1000)}s.`));
        }
      }, timeoutMs);
    }

    child.stdout.on('data', (chunk) => {
      resetStallTimer();
      const text = chunk.toString();
      stdout += text;

      if (onProgress) {
        // Parse progress like: [download]  45.2% of ~120.00MiB at 4.20MiB/s ETA 00:15
        const match = text.match(/\[download\]\s+([0-9\.]+)%\s+of\s+([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/i)
          || text.match(/([0-9\.]+)%/);
        if (match) {
          const pct = parseFloat(match[1]);
          if (!isNaN(pct)) {
            onProgress({
              percent: Math.min(100, Math.max(0, pct)),
              speed: match[3],
              eta: match[4]
            });
          }
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      resetStallTimer();
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      if (!isSettled) {
        isSettled = true;
        if (totalTimer) clearTimeout(totalTimer);
        if (stallTimer) clearTimeout(stallTimer);
        reject(err);
      }
    });

    child.on('close', (exitCode) => {
      if (!isSettled) {
        isSettled = true;
        if (totalTimer) clearTimeout(totalTimer);
        if (stallTimer) clearTimeout(stallTimer);
        resolve({ exitCode: exitCode ?? 0, stdout, stderr });
      }
    });
  });
}

/**
 * Downloads a video slice directly using yt-dlp section download
 *
 * @param {string} url
 * @param {number} startSec
 * @param {number} endSec
 * @param {string} outputPath
 * @param {Object} [options]
 * @returns {Promise<boolean>}
 */
export async function downloadSection(url, startSec, endSec, outputPath, options = {}) {
  const partPath = `${outputPath}.part`;
  // Clean up any stale partial files
  if (fs.existsSync(partPath)) try { fs.unlinkSync(partPath); } catch {}
  if (fs.existsSync(outputPath)) try { fs.unlinkSync(outputPath); } catch {}

  const args = [
    '--download-sections', `*${Math.floor(startSec)}-${Math.ceil(endSec)}`,
    '--force-keyframes-at-cuts',
    '-f', 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best',
    '--newline',
    '-o', outputPath,
    url
  ];

  try {
    const res = await runYtdlp(args, {
      jobId: options.jobId,
      timeoutMs: 150000,
      stallTimeoutMs: 60000,
      onProgress: options.onProgress
    });

    const success = res.exitCode === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 10000;
    if (!success && fs.existsSync(partPath)) {
      try { fs.unlinkSync(partPath); } catch {}
    }
    return success;
  } catch (err) {
    if (fs.existsSync(partPath)) {
      try { fs.unlinkSync(partPath); } catch {}
    }
    return false;
  }
}

const activeDownloads = new Map();

/**
 * Safely downloads full source video once with progress reporting and caching
 *
 * @param {string} url
 * @param {string} outputPath
 * @param {Object} [options]
 * @returns {Promise<string>}
 */
export async function downloadFullVideo(url, outputPath, options = {}) {
  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 100000) {
    return outputPath;
  }

  if (activeDownloads.has(outputPath)) {
    return activeDownloads.get(outputPath);
  }

  const promise = (async () => {
    const partPath = `${outputPath}.part`;
    if (fs.existsSync(partPath)) {
      try { fs.unlinkSync(partPath); } catch {}
    }

    const args = [
      '-f', 'bestvideo[height<=1080][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
      '--merge-output-format', 'mp4',
      '--newline',
      '-o', outputPath,
      url
    ];

    try {
      const res = await runYtdlp(args, {
        jobId: options.jobId,
        timeoutMs: 600000, // 10 minutes total max for full multi-GB videos
        stallTimeoutMs: 90000,
        onProgress: options.onProgress
      });

      if (res.exitCode !== 0 || !fs.existsSync(outputPath) || fs.statSync(outputPath).size < 10000) {
        if (fs.existsSync(partPath)) try { fs.unlinkSync(partPath); } catch {}
        throw new Error(`Failed to download source video: ${res.stderr || 'Download failed'}`);
      }

      return outputPath;
    } catch (err) {
      if (fs.existsSync(partPath)) try { fs.unlinkSync(partPath); } catch {}
      throw err;
    }
  })();

  activeDownloads.set(outputPath, promise);

  try {
    return await promise;
  } finally {
    activeDownloads.delete(outputPath);
  }
}

/**
 * Downloads audio-only track formatted as MP3 for transcription
 *
 * @param {string} url
 * @param {string} outputPath
 * @param {Object} [options]
 * @returns {Promise<string>}
 */
export async function downloadAudioOnly(url, outputPath, options = {}) {
  const dir = path.dirname(outputPath);
  const baseName = path.basename(outputPath, path.extname(outputPath));
  const template = path.join(dir, `${baseName}.%(ext)s`);

  const args = [
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '64k',
    '--newline',
    '-o', template,
    url
  ];

  const res = await runYtdlp(args, {
    jobId: options.jobId,
    timeoutMs: 300000,
    stallTimeoutMs: 90000,
    onProgress: options.onProgress
  });

  // Verify file existence (yt-dlp guarantees .mp3 with --audio-format mp3)
  if (res.exitCode !== 0) {
    throw new Error(`Audio download failed: ${res.stderr || 'Unknown yt-dlp error'}`);
  }

  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
    return outputPath;
  }

  // Check if saved as .mp3 with slight variation
  const files = fs.readdirSync(dir).filter(f => f.startsWith(baseName) && f.endsWith('.mp3'));
  if (files.length > 0) {
    const foundPath = path.join(dir, files[0]);
    if (foundPath !== outputPath) {
      fs.copyFileSync(foundPath, outputPath);
      try { fs.unlinkSync(foundPath); } catch {}
    }
    return outputPath;
  }

  throw new Error('yt-dlp finished audio download but target MP3 file was not found.');
}
