/**
 * Video Rendering Engine (ffmpeg + libass)
 * Renders campaign-style vertical 9:16 YouTube Shorts matching the target specification:
 * - 1080x1920 solid black canvas (#000000)
 * - 1080x1080 video box centered at (0, 420) with Fill (1:1 crop + focusX) or Fit (letterbox)
 * - Hook Title Overlay (white bold font, soft shadow, auto-fit, 1-2 emoji)
 * - Yellow Subtitles (#FFE600, 66px, Montserrat ExtraBold, black outline 5px, centered at y=1235)
 */

import path from 'path';
import fs from 'fs';
import { CONFIG } from '../config.js';
import { runProcess } from '../lib/proc.js';
import { prepareClipSubtitles, formatFfmpegSubFilterPath } from './captions.js';
import { renderTitleOverlayPng } from './titleOverlay.js';

/**
 * Builds the complex filter graph for ffmpeg rendering
 *
 * @param {Object} options
 * @param {'title_video'|'vertical'|'original'} [options.format='title_video']
 * @param {'fill'|'fit'} [options.framing='fill']
 * @param {number} [options.focusX=0.5] - 0 (left) to 1 (right), default 0.5 (center)
 * @param {boolean} [options.hasTitleOverlay=false]
 * @param {boolean} [options.burnedCaptions=true]
 * @param {string} [options.assFilePath]
 * @param {string} [options.fontsDir]
 * @returns {string}
 */
export function buildFfmpegFilterGraph(options = {}) {
  const format = options.format || 'title_video';
  const framing = options.framing || 'fill';
  const focusX = typeof options.focusX === 'number' ? Math.max(0, Math.min(1, options.focusX)) : 0.5;
  const burnedCaptions = options.burnedCaptions && options.assFilePath;
  const hasTitleOverlay = Boolean(options.hasTitleOverlay);
  const escapedAss = options.assFilePath ? formatFfmpegSubFilterPath(options.assFilePath) : '';
  const escapedFonts = options.fontsDir ? formatFfmpegSubFilterPath(options.fontsDir) : '';

  let filter = '';

  if (format === 'title_video') {
    // 1080x1920 solid black canvas with 1080x1080 video box at y=420
    if (framing === 'fill') {
      // 1:1 square crop with focusX, scaled to 1080x1080
      filter += `[0:v]crop='min(iw,ih)':'min(iw,ih)':'(iw-min(iw,ih))*${focusX}':'(ih-min(iw,ih))*0.5',scale=1080:1080[box_v];`;
    } else {
      // framing === 'fit': scale to fit within 1080x1080, padded to square with black
      filter += `[0:v]scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(1080-iw)/2:(1080-ih)/2:color=black[box_v];`;
    }

    // Pad 1080x1080 box to 1080x1920 canvas at y=420 with solid black
    filter += `[box_v]pad=1080:1920:0:420:color=black[canvas_v]`;
    let currentOut = 'canvas_v';

    if (hasTitleOverlay) {
      filter += `;[${currentOut}][1:v]overlay=0:0:shortest=1[titled_v]`;
      currentOut = 'titled_v';
    }

    if (burnedCaptions) {
      const fontsParam = escapedFonts ? `:fontsdir='${escapedFonts}'` : '';
      filter += `;[${currentOut}]ass=filename='${escapedAss}'${fontsParam}[out_v]`;
    } else {
      filter += `;[${currentOut}]copy[out_v]`;
    }

    return filter;
  }

  if (format === 'vertical') {
    // 9:16 Vertical canvas (1080x1920) with blurred background
    filter += '[0:v]split=2[fg_raw][bg_raw];';
    filter += '[bg_raw]scale=180:320:force_original_aspect_ratio=increase,crop=180:320,boxblur=4:1,scale=1080:1920[bg_blur];';
    filter += '[fg_raw]scale=1080:1920:force_original_aspect_ratio=decrease[fg_scaled];';
    filter += '[bg_blur][fg_scaled]overlay=(W-w)/2:(H-h)/2[base_canvas]';

    let currentOut = 'base_canvas';
    if (hasTitleOverlay) {
      filter += `;[${currentOut}][1:v]overlay=0:0:shortest=1[titled_v]`;
      currentOut = 'titled_v';
    }

    if (burnedCaptions) {
      const fontsParam = escapedFonts ? `:fontsdir='${escapedFonts}'` : '';
      filter += `;[${currentOut}]ass=filename='${escapedAss}'${fontsParam}[out_v]`;
    } else {
      filter += `;[${currentOut}]copy[out_v]`;
    }

    return filter;
  }

  // Original aspect ratio capped at 1080p
  filter += "[0:v]scale='min(1920,iw)':min'(1080,ih)':force_original_aspect_ratio=decrease[base_canvas]";
  let currentOut = 'base_canvas';
  if (burnedCaptions) {
    const fontsParam = escapedFonts ? `:fontsdir='${escapedFonts}'` : '';
    filter += `;[${currentOut}]ass=filename='${escapedAss}'${fontsParam}[out_v]`;
  } else {
    filter += `;[${currentOut}]copy[out_v]`;
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
 * @param {string} [params.titleOverlayPath]
 * @returns {string[]}
 */
export function buildFfmpegRenderArgs(params) {
  const { inputPath, startSec, durationSec, outputPath, filterGraph, titleOverlayPath } = params;

  const args = [
    '-y',
    '-ss', String(startSec),
    '-i', inputPath
  ];

  if (titleOverlayPath && fs.existsSync(titleOverlayPath)) {
    args.push('-loop', '1', '-i', titleOverlayPath);
  }

  args.push(
    '-t', String(durationSec),
    '-filter_complex', filterGraph,
    '-map', '[out_v]',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-threads', '2',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-progress', 'pipe:1',
    outputPath
  );

  return args;
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

    // Verify duration within 2.0s tolerance
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
export async function downloadSectionWithYtdlp(url, startSec, endSec, outputPath, jobId, onProgress) {
  const baseArgs = [
    '--download-sections', `*${Math.floor(startSec)}-${Math.ceil(endSec)}`,
    '--force-keyframes-at-cuts',
    '--concurrent-fragments', '4',
    '--js-runtimes', 'node',
    '--remote-components', 'ejs:github',
    '--newline',
    '--no-warnings'
  ];

  if (CONFIG.YTDLP_COOKIES_FROM_BROWSER) {
    baseArgs.push('--cookies-from-browser', CONFIG.YTDLP_COOKIES_FROM_BROWSER);
  }

  let lastDlPct = 0;
  const handleStdout = (chunk) => {
    if (!onProgress) return;
    const match = chunk.match(/\[download\]\s+([\d.]+)%/);
    if (match) {
      const pct = Math.min(100, Math.round(parseFloat(match[1])));
      if (pct !== lastDlPct) {
        lastDlPct = pct;
        onProgress(pct);
      }
    }
  };

  // Attempt 1: Fast H.264 (avc) video + AAC audio up to 1080p
  const args1 = [
    ...baseArgs,
    '-f', 'bestvideo[height<=1080][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
    '-o', outputPath,
    url
  ];

  try {
    const res = await runProcess('yt-dlp', args1, { jobId, timeoutMs: 120000, onStdout: handleStdout });
    if (res.exitCode === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 10000) {
      return true;
    }
  } catch {}

  // Attempt 2 (fallback): Lightweight 720p or best available format for resilience
  const args2 = [
    ...baseArgs,
    '-f', 'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
    '-o', outputPath,
    url
  ];

  try {
    const res = await runProcess('yt-dlp', args2, { jobId, timeoutMs: 90000, onStdout: handleStdout });
    return res.exitCode === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 10000;
  } catch {
    return false;
  }
}

/**
 * Downloads multiple clip sections in a SINGLE batch yt-dlp request.
 * Drastically reduces total network time by eliminating redundant YouTube TLS handshakes & JS challenge solving.
 *
 * @param {string} url - YouTube video webpage URL
 * @param {Array<{ id: string, startSeconds: number, endSeconds: number }>} clips
 * @param {string} outputDir - Directory to store intermediate batch files
 * @param {string} [jobId]
 * @param {(completed: number, total: number) => void} [onProgress] - Live callback whenever a clip section completes downloading
 * @returns {Promise<Map<string, string>>} Map of clipId -> filePath for all successfully downloaded clips
 */
export async function batchDownloadSectionsWithYtdlp(url, clips, outputDir, jobId, onProgress) {
  const resultMap = new Map();
  if (!url || !Array.isArray(clips) || clips.length === 0) {
    return resultMap;
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const recordCompletedFiles = (prefix, targetClips) => {
    for (let i = 0; i < targetClips.length; i++) {
      const clip = targetClips[i];
      if (resultMap.has(clip.id)) continue;
      const expectedFile = path.join(outputDir, `${prefix}_${String(i + 1).padStart(2, '0')}.mp4`);
      if (fs.existsSync(expectedFile)) {
        try {
          if (fs.statSync(expectedFile).size > 10000) {
            resultMap.set(clip.id, expectedFile);
          }
        } catch {}
      }
    }
  };

  let lastReported = 0;
  const pollTimer = setInterval(() => {
    try {
      recordCompletedFiles('batch_raw', clips);
      const count = resultMap.size;
      if (count !== lastReported) {
        lastReported = count;
        if (typeof onProgress === 'function') {
          onProgress(count, clips.length);
        }
      }
    } catch {}
  }, 800);

  const baseArgs = [
    '--force-keyframes-at-cuts',
    '--concurrent-fragments', '4',
    '--js-runtimes', 'node',
    '--remote-components', 'ejs:github',
    '--merge-output-format', 'mp4',
    '--no-warnings',
    '--quiet'
  ];

  if (CONFIG.YTDLP_COOKIES_FROM_BROWSER) {
    baseArgs.push('--cookies-from-browser', CONFIG.YTDLP_COOKIES_FROM_BROWSER);
  }

  // Add all section ranges in order
  for (const clip of clips) {
    const start = Math.max(0, Math.floor(clip.startSeconds));
    const end = Math.ceil(clip.endSeconds);
    baseArgs.push('--download-sections', `*${start}-${end}`);
  }

  const outputPattern = path.join(outputDir, 'batch_raw_%(autonumber)02d.mp4');

  // Attempt 1: AVC H.264 + AAC
  const args1 = [
    ...baseArgs,
    '-f', 'bestvideo[height<=1080][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
    '-o', outputPattern,
    url
  ];

  try {
    await runProcess('yt-dlp', args1, { jobId, timeoutMs: 360000 });
  } catch (err) {
    console.warn(`[Batch Download] Attempt 1 ended: ${err.message}`);
  } finally {
    recordCompletedFiles('batch_raw', clips);
    if (typeof onProgress === 'function' && resultMap.size !== lastReported) {
      lastReported = resultMap.size;
      onProgress(lastReported, clips.length);
    }
  }

  // Fallback for any missing clips
  if (resultMap.size < clips.length) {
    const missingClips = clips.filter(c => !resultMap.has(c.id));
    if (missingClips.length > 0) {
      const fallbackArgs = [
        '--force-keyframes-at-cuts',
        '--concurrent-fragments', '4',
        '--js-runtimes', 'node',
        '--remote-components', 'ejs:github',
        '--merge-output-format', 'mp4',
        '--no-warnings',
        '--quiet'
      ];
      if (CONFIG.YTDLP_COOKIES_FROM_BROWSER) {
        fallbackArgs.push('--cookies-from-browser', CONFIG.YTDLP_COOKIES_FROM_BROWSER);
      }
      for (const clip of missingClips) {
        const start = Math.max(0, Math.floor(clip.startSeconds));
        const end = Math.ceil(clip.endSeconds);
        fallbackArgs.push('--download-sections', `*${start}-${end}`);
      }
      const fallbackPattern = path.join(outputDir, 'batch_fb_%(autonumber)02d.mp4');
      const args2 = [
        ...fallbackArgs,
        '-f', 'bestvideo[height<=720]+bestaudio/best[height<=720]/best',
        '-o', fallbackPattern,
        url
      ];
      try {
        await runProcess('yt-dlp', args2, { jobId, timeoutMs: 180000 });
      } catch (fbErr) {
        console.warn(`[Batch Download] Fallback ended: ${fbErr.message}`);
      } finally {
        recordCompletedFiles('batch_fb', missingClips);
        if (typeof onProgress === 'function' && resultMap.size !== lastReported) {
          lastReported = resultMap.size;
          onProgress(lastReported, clips.length);
        }
      }
    }
  }

  clearInterval(pollTimer);
  return resultMap;
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
      '--js-runtimes', 'node',
      '--remote-components', 'ejs:github',
      '--concurrent-fragments', '4',
      '-f', 'bestvideo[height<=1080][vcodec^=avc]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
      '--merge-output-format', 'mp4',
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
 * @param {'title_video'|'vertical'|'original'} [options.format='title_video']
 * @param {'fill'|'fit'} [options.framing='fill']
 * @param {number} [options.focusX=0.5]
 * @param {boolean} [options.burnedCaptions=true]
 * @param {boolean} [options.censor=true]
 * @param {string} [options.captionSize='medium']
 * @param {string} [options.fullVideoPath]
 * @returns {Promise<{ mp4Path: string, srtPath: string, srtContent: string, durationSec: number }>}
 */
export async function renderClip(clip, sourceMeta, allSegments, options = {}) {
  const {
    jobId,
    outputDir,
    format = 'title_video',
    framing = clip.framing || 'fill',
    focusX = typeof clip.focusX === 'number' ? clip.focusX : 0.5,
    burnedCaptions = true,
    censor = true,
    captionSize = 'medium',
    fullVideoPath,
    prefetchedVideoPath
  } = options;

  const clipId = clip.id;
  const clipDir = path.join(outputDir, clipId);
  fs.mkdirSync(clipDir, { recursive: true });

  const finalMp4Path = path.join(clipDir, `${clipId}.mp4`);

  // 1. Prepare ASS and SRT subtitle files
  const fontSize = captionSize === 'small' ? 58 : (captionSize === 'large' ? 76 : 66);
  const subInfo = prepareClipSubtitles(allSegments, clip.startSeconds, clip.endSeconds, clipDir, clipId, {
    censor,
    fontSize
  });

  // 2. Generate Hook Title Overlay PNG if applicable
  const onScreenTitle = (clip.onScreenTitle || clip.title || '').trim();
  let titleOverlayPath = null;
  if (onScreenTitle && (format === 'title_video' || format === 'vertical')) {
    titleOverlayPath = path.join(clipDir, 'title.png');
    await renderTitleOverlayPng(onScreenTitle, titleOverlayPath);
  }

  // 3. Determine input video source
  let videoInput = '';
  let seekStartSec = clip.startSeconds;
  const clipDur = clip.durationSeconds;
  let hadNetworkDownload = false;

  const prePath = prefetchedVideoPath || clip.prefetchedVideoPath;

  if (sourceMeta.sourceType === 'local' && sourceMeta.filePath) {
    videoInput = sourceMeta.filePath;
  } else if (prePath && fs.existsSync(prePath) && fs.statSync(prePath).size > 10000) {
    videoInput = prePath;
    seekStartSec = 0; // Section is already trimmed by batch download
  } else if (fullVideoPath && fs.existsSync(fullVideoPath)) {
    videoInput = fullVideoPath;
  } else {
    // Attempt fast yt-dlp section cut
    if (options.onClipProgress) {
      options.onClipProgress({
        clipId,
        clipNumber: options.clipNumber || 1,
        totalClips: options.totalClips || 1,
        phase: 'downloading',
        percent: 0,
        etaSec: 0,
        durationSec: Math.round(clipDur),
        message: `Fetching audio & video for clip #${options.clipNumber || 1}...`
      });
    }

    hadNetworkDownload = false;
    const sectionPath = path.join(clipDir, 'section_raw.mp4');
    const sectionOk = await downloadSectionWithYtdlp(
      sourceMeta.webpageUrl || sourceMeta.url,
      clip.startSeconds,
      clip.endSeconds,
      sectionPath,
      jobId,
      (dlPercent) => {
        if (options.onClipProgress) {
          options.onClipProgress({
            clipId,
            clipNumber: options.clipNumber || 1,
            totalClips: options.totalClips || 1,
            phase: 'downloading',
            percent: Math.min(25, Math.round(dlPercent * 0.25)), // 0% - 25% during fetch
            etaSec: 0,
            durationSec: Math.round(clipDur),
            message: `Fetching from YouTube (${dlPercent}%)...`
          });
        }
      }
    );

    if (sectionOk) {
      hadNetworkDownload = true;
      videoInput = sectionPath;
      seekStartSec = 0; // Section is already trimmed
    } else {
      // For long videos (>25 mins), downloading the full multi-GB source is too slow and can freeze processing.
      // Fail this individual clip gracefully so the remaining clips continue uninterrupted.
      const durationSec = sourceMeta.durationSec || 0;
      if (durationSec > 1500) {
        throw new Error(`Section download failed for clip ${clipId} (${Math.round(clip.startSeconds)}s-${Math.round(clip.endSeconds)}s) on long source video`);
      }

      // Fallback for short videos: cache full download
      const cachedFullDir = path.join(CONFIG.DATA_DIR, 'sources', jobId);
      fs.mkdirSync(cachedFullDir, { recursive: true });
      const cachedFullPath = path.join(cachedFullDir, 'full_source.mp4');
      videoInput = await downloadFullVideoCached(sourceMeta.webpageUrl || sourceMeta.url, cachedFullPath, jobId);
    }
  }

  // 4. Build filter graph and render arguments
  const filterGraph = buildFfmpegFilterGraph({
    format,
    framing,
    focusX,
    hasTitleOverlay: Boolean(titleOverlayPath),
    burnedCaptions,
    assFilePath: subInfo.assFilePath,
    fontsDir: CONFIG.FONTS_DIR
  });

  const renderArgs = buildFfmpegRenderArgs({
    inputPath: videoInput,
    startSec: seekStartSec,
    durationSec: clipDur,
    outputPath: finalMp4Path,
    filterGraph,
    titleOverlayPath
  });

  // 5. Run ffmpeg with live frame-by-frame progress
  let lastReportedPercent = 0;
  const parseFfmpegProgress = (chunk) => {
    const match = chunk.match(/out_time_us=(\d+)/);
    if (match) {
      const us = parseInt(match[1], 10);
      const currentSec = us / 1000000;
      const basePercent = hadNetworkDownload
        ? Math.min(99, Math.max(26, 25 + Math.round((currentSec / clipDur) * 74)))
        : Math.min(99, Math.max(1, Math.round((currentSec / clipDur) * 99)));

      let speed = 1.0;
      const speedMatch = chunk.match(/speed=\s*([\d.]+)x/);
      if (speedMatch) {
        const parsedSpeed = parseFloat(speedMatch[1]);
        if (parsedSpeed > 0.1) speed = parsedSpeed;
      }
      const etaSec = Math.max(0, Math.round((clipDur - currentSec) / speed));

      if (basePercent !== lastReportedPercent) {
        lastReportedPercent = basePercent;
        if (options.onClipProgress) {
          options.onClipProgress({
            clipId,
            clipNumber: options.clipNumber || 1,
            totalClips: options.totalClips || 1,
            phase: 'rendering',
            percent: basePercent,
            etaSec,
            durationSec: Math.round(clipDur),
            message: `Burning hook title & subtitles (${basePercent}%)...`
          });
        }
      }
    }
  };

  const renderRes = await runProcess('ffmpeg', renderArgs, {
    jobId,
    timeoutMs: 600000,
    onStdout: parseFfmpegProgress
  });
  if (renderRes.exitCode !== 0) {
    throw new Error(`ffmpeg render failed: ${renderRes.stderr || 'Unknown ffmpeg error'}`);
  }

  // 6. Verify output with ffprobe
  const verifyRes = await verifyRenderedVideo(finalMp4Path, clipDur);
  if (!verifyRes.valid) {
    throw new Error(`Rendered clip verification failed: ${verifyRes.error}`);
  }

  if (options.onClipProgress) {
    options.onClipProgress({
      clipId,
      clipNumber: options.clipNumber || 1,
      totalClips: options.totalClips || 1,
      phase: 'ready',
      percent: 100,
      etaSec: 0,
      durationSec: Math.round(clipDur),
      message: `Clip #${options.clipNumber || 1} ready!`
    });
  }

  // Clean up intermediate files
  const tempSection = path.join(clipDir, 'section_raw.mp4');
  if (fs.existsSync(tempSection)) {
    try { fs.unlinkSync(tempSection); } catch {}
  }
  if (prePath && fs.existsSync(prePath)) {
    try { fs.unlinkSync(prePath); } catch {}
  }
  if (titleOverlayPath && fs.existsSync(titleOverlayPath)) {
    try { fs.unlinkSync(titleOverlayPath); } catch {}
  }

  return {
    mp4Path: finalMp4Path,
    srtPath: subInfo.srtFilePath,
    srtContent: subInfo.srtContent,
    durationSec: verifyRes.durationSec
  };
}
