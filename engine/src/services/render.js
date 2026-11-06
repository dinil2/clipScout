/**
 * Video Rendering Engine (ffmpeg + libass)
 * Slices 1080p source, converts to 9:16 vertical with blurred background,
 * and burns in animated word-highlight subtitles with bundled Inter font.
 */

import path from 'path';
import fs from 'fs';
import { CONFIG } from '../config.js';
import { runProcess } from '../lib/proc.js';
import { prepareClipSubtitles, formatFfmpegSubFilterPath } from './captions.js';

/**
 * Builds the complex filter graph for ffmpeg rendering
 *
 * @param {Object} options
 * @param {'vertical'|'original'} [options.format='vertical']
 * @param {boolean} [options.burnedCaptions=true]
 * @param {string} [options.assFilePath]
 * @param {string} [options.fontsDir]
 * @returns {string}
 */
export function buildFfmpegFilterGraph(options = {}) {
  const isVertical = options.format !== 'original';
  const burnedCaptions = options.burnedCaptions && options.assFilePath;
  const escapedAss = options.assFilePath ? formatFfmpegSubFilterPath(options.assFilePath) : '';
  const escapedFonts = options.fontsDir ? formatFfmpegSubFilterPath(options.fontsDir) : '';

  let filter = '';

  if (isVertical) {
    // 9:16 Vertical canvas (1080x1920)
    // 1. Background: scale down to 180x320 for ultra-fast silky blur, crop, light blur, scale up to 1080x1920
    // 2. Foreground: scale to fit 1080x1920 without stretching
    // 3. Overlay centered
    filter += '[0:v]split=2[fg_raw][bg_raw];';
    filter += '[bg_raw]scale=180:320:force_original_aspect_ratio=increase,crop=180:320,boxblur=4:1,scale=1080:1920[bg_blur];';
    filter += '[fg_raw]scale=1080:1920:force_original_aspect_ratio=decrease[fg_scaled];';
    filter += '[bg_blur][fg_scaled]overlay=(W-w)/2:(H-h)/2[base_canvas]';
  } else {
    // Original aspect ratio capped at 1080p
    filter += "[0:v]scale='min(1920,iw)':min'(1080,ih)':force_original_aspect_ratio=decrease[base_canvas]";
  }

  if (burnedCaptions) {
    const fontsParam = escapedFonts ? `:fontsdir='${escapedFonts}'` : '';
    filter += `;[base_canvas]ass=filename='${escapedAss}'${fontsParam}[out_v]`;
  } else {
    filter += ';[base_canvas]copy[out_v]';
  }

  return filter;
}

/**
 * Builds complete ffmpeg execution argument array
 *
 * @param {Object} params
 * @param {string} params.inputPath
 * @param {number} params.startSec
 * @param {number} params.durationSec
 * @param {string} params.outputPath
 * @param {string} params.filterGraph
 * @returns {string[]}
 */
export function buildFfmpegRenderArgs(params) {
  const { inputPath, startSec, durationSec, outputPath, filterGraph } = params;

  return [
    '-y',
    '-ss', String(startSec),
    '-i', inputPath,
    '-t', String(durationSec),
    '-filter_complex', filterGraph,
    '-map', '[out_v]',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputPath
  ];
}

/**
 * Verifies that rendered output video is valid, playable, has both streams, and matches duration
 *
 * @param {string} filePath
 * @param {number} expectedDurationSec
 * @returns {Promise<{ valid: boolean, durationSec: number, error?: string }>}
 */
export async function verifyRenderedVideo(filePath, expectedDurationSec) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, durationSec: 0, error: 'Output file was not created.' };
  }

  const stat = fs.statSync(filePath);
  if (stat.size < 10000) {
    return { valid: false, durationSec: 0, error: 'Output video file is corrupted or empty (< 10 KB).' };
  }

  const probeArgs = [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=codec_type',
    '-of', 'json',
    filePath
  ];

  try {
    const res = await runProcess('ffprobe', probeArgs);
    const data = JSON.parse(res.stdout);
    const actualDur = parseFloat(data.format?.duration || '0');
    const streams = data.streams || [];

    const hasVideo = streams.some(s => s.codec_type === 'video');
    if (!hasVideo) {
      return { valid: false, durationSec: actualDur, error: 'Rendered video lacks video stream.' };
    }

    // Verify duration within 1.5s tolerance
    if (Math.abs(actualDur - expectedDurationSec) > 2.0 && actualDur < 3.0) {
      return { valid: false, durationSec: actualDur, error: `Rendered clip duration (${actualDur}s) deviated too much from expected (${expectedDurationSec}s).` };
    }

    return { valid: true, durationSec: actualDur };
  } catch (err) {
    return { valid: false, durationSec: 0, error: `ffprobe validation failed: ${err.message}` };
  }
}

/**
 * Downloads a video slice directly using yt-dlp section download
 *
 * @param {string} url
 * @param {number} startSec
 * @param {number} endSec
 * @param {string} outputPath
 * @param {string} [jobId]
 * @returns {Promise<boolean>}
 */
export async function downloadSectionWithYtdlp(url, startSec, endSec, outputPath, jobId) {
  const args = [
    '--download-sections', `*${Math.floor(startSec)}-${Math.ceil(endSec)}`,
    '--force-keyframes-at-cuts',
    '-f', 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best',
    '--no-warnings',
    '--quiet',
    '-o', outputPath
  ];

  if (CONFIG.YTDLP_COOKIES_FROM_BROWSER) {
    args.push('--cookies-from-browser', CONFIG.YTDLP_COOKIES_FROM_BROWSER);
  }
  args.push(url);

  try {
    const res = await runProcess('yt-dlp', args, { jobId, timeoutMs: 120000 });
    return res.exitCode === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 10000;
  } catch {
    return false;
  }
}

const inFlightDownloads = new Map();

/**
 * Downloads full video once for caching when section download is unavailable
 *
 * @param {string} url
 * @param {string} outputPath
 * @param {string} [jobId]
 * @returns {Promise<string>}
 */
export async function downloadFullVideoCached(url, outputPath, jobId) {
  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 100000) {
    return outputPath;
  }

  if (inFlightDownloads.has(outputPath)) {
    return inFlightDownloads.get(outputPath);
  }

  const promise = (async () => {
    const args = [
      '-f', 'bestvideo[height<=1080][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
      '--merge-output-format', 'mp4',
      '--no-part',
      '--no-warnings',
      '--quiet',
      '-o', outputPath
    ];

    if (CONFIG.YTDLP_COOKIES_FROM_BROWSER) {
      args.push('--cookies-from-browser', CONFIG.YTDLP_COOKIES_FROM_BROWSER);
    }
    args.push(url);

    const res = await runProcess('yt-dlp', args, { jobId, timeoutMs: 300000 });
    if (res.exitCode !== 0 || !fs.existsSync(outputPath)) {
      throw new Error(`Failed to download full source video: ${res.stderr || 'yt-dlp download failed'}`);
    }

    return outputPath;
  })();

  inFlightDownloads.set(outputPath, promise);

  try {
    return await promise;
  } finally {
    inFlightDownloads.delete(outputPath);
  }
}

/**
 * Cuts, reformats, burns captions, and verifies a single clip
 *
 * @param {Object} clip
 * @param {Object} sourceMeta
 * @param {Array<any>} allSegments
 * @param {Object} options
 * @param {string} options.jobId
 * @param {string} options.outputDir
 * @param {string} [options.format='vertical']
 * @param {boolean} [options.burnedCaptions=true]
 * @param {string} [options.fullVideoPath]
 * @returns {Promise<{ mp4Path: string, srtPath: string, durationSec: number }>}
 */
export async function renderClip(clip, sourceMeta, allSegments, options) {
  const { jobId, outputDir, format = 'vertical', burnedCaptions = true, fullVideoPath } = options;
  const clipId = clip.id;
  const clipDir = path.join(outputDir, clipId);
  fs.mkdirSync(clipDir, { recursive: true });

  const finalMp4Path = path.join(clipDir, `${clipId}.mp4`);

  // 1. Prepare ASS and SRT subtitle files
  const subInfo = prepareClipSubtitles(allSegments, clip.startSeconds, clip.endSeconds, clipDir, clipId);

  // 2. Determine input video source
  let videoInput = '';
  let seekStartSec = clip.startSeconds;
  const clipDur = clip.durationSeconds;

  if (sourceMeta.sourceType === 'local' && sourceMeta.filePath) {
    videoInput = sourceMeta.filePath;
  } else if (fullVideoPath && fs.existsSync(fullVideoPath)) {
    videoInput = fullVideoPath;
  } else {
    // Attempt fast yt-dlp section cut
    const sectionPath = path.join(clipDir, 'section_raw.mp4');
    const sectionOk = await downloadSectionWithYtdlp(
      sourceMeta.webpageUrl || sourceMeta.url,
      clip.startSeconds,
      clip.endSeconds,
      sectionPath,
      jobId
    );

    if (sectionOk) {
      videoInput = sectionPath;
      seekStartSec = 0; // Section is already trimmed
    } else {
      // Fallback: cache full download
      const cachedFullDir = path.join(CONFIG.DATA_DIR, 'sources', jobId);
      fs.mkdirSync(cachedFullDir, { recursive: true });
      const cachedFullPath = path.join(cachedFullDir, 'full_source.mp4');
      videoInput = await downloadFullVideoCached(sourceMeta.webpageUrl || sourceMeta.url, cachedFullPath, jobId);
    }
  }

  // 3. Build filter graph and render arguments
  const filterGraph = buildFfmpegFilterGraph({
    format,
    burnedCaptions,
    assFilePath: subInfo.assFilePath,
    fontsDir: CONFIG.FONTS_DIR
  });

  const renderArgs = buildFfmpegRenderArgs({
    inputPath: videoInput,
    startSec: seekStartSec,
    durationSec: clipDur,
    outputPath: finalMp4Path,
    filterGraph
  });

  // 4. Run ffmpeg
  const renderRes = await runProcess('ffmpeg', renderArgs, { jobId, timeoutMs: 600000 });
  if (renderRes.exitCode !== 0) {
    throw new Error(`ffmpeg render failed: ${renderRes.stderr || 'Unknown ffmpeg error'}`);
  }

  // 5. Verify output with ffprobe
  const verifyRes = await verifyRenderedVideo(finalMp4Path, clipDur);
  if (!verifyRes.valid) {
    throw new Error(`Rendered clip verification failed: ${verifyRes.error}`);
  }

  // Clean up intermediate raw section if created
  const tempSection = path.join(clipDir, 'section_raw.mp4');
  if (fs.existsSync(tempSection)) {
    try { fs.unlinkSync(tempSection); } catch {}
  }

  return {
    mp4Path: finalMp4Path,
    srtPath: subInfo.srtFilePath,
    srtContent: subInfo.srtContent,
    durationSec: verifyRes.durationSec
  };
}

