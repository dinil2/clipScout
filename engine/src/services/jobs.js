/**
 * Job Manager & Orchestration Engine
 * Coordinates the 4-stage pipeline:
 * 1. Reading video (Metadata)
 * 2. Transcribing (YouTube VTT or chunked Groq Whisper)
 * 3. Finding moments (Sliding windows, AI evaluation, snapping)
 * 4. Cutting clips (ffmpeg 1:1 box on 9:16 black canvas with title & captions)
 *
 * Supports real-time SSE progress, cancellation, single-clip rerendering, and ZIP export.
 */

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ZipArchive } from 'archiver';
import { CONFIG } from '../config.js';
import { killJobProcesses } from '../lib/proc.js';
import { resolveRemoteMetadata, resolveLocalFileMetadata } from './source.js';
import { getOrExtractTranscript } from './transcript.js';
import { findPodcastMoments } from './analysis.js';
import { renderClip, downloadFullVideoCached } from './render.js';

// In-memory store of jobs: jobId -> Job
const jobs = new Map();

// SSE listeners: jobId -> Set<FastifyReply>
const eventListeners = new Map();

/**
 * Emits an SSE event to all connected clients for a job
 * @param {string} jobId
 * @param {string} eventName
 * @param {any} data
 */
export function emitJobEvent(jobId, eventName, data) {
  const listeners = eventListeners.get(jobId);
  if (!listeners || listeners.size === 0) return;

  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const reply of listeners) {
    try {
      reply.raw.write(payload);
    } catch {
      listeners.delete(reply);
    }
  }
}

/**
 * Registers an SSE client connection for a job
 * @param {string} jobId
 * @param {any} reply
 */
export function registerEventListener(jobId, reply) {
  if (!eventListeners.has(jobId)) {
    eventListeners.set(jobId, new Set());
  }
  eventListeners.get(jobId).add(reply);

  reply.raw.on('close', () => {
    const set = eventListeners.get(jobId);
    if (set) {
      set.delete(reply);
      if (set.size === 0) eventListeners.delete(jobId);
    }
  });

  // Send current state immediately on connect
  const job = jobs.get(jobId) || getJob(jobId);
  if (job) {
    reply.raw.write(`event: state\ndata: ${JSON.stringify(getJobPublicState(job))}\n\n`);
  }
}

/**
 * Returns safe public JSON representation of a job
 * @param {Object} job
 * @returns {Object}
 */
export function getJobPublicState(job) {
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    source: job.source,
    options: job.options,
    video: job.video,
    clips: job.clips,
    currentClipProgress: job.currentClipProgress || null,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

/**
 * Persists job state to disk in jobDir/job.json
 * Writes transcript segments separately to prevent massive synchronous I/O.
 * @param {Object} job
 */
export function persistJob(job) {
  if (!job || !job.jobDir) return;
  try {
    const jobFile = path.join(job.jobDir, 'job.json');

    // Save transcript separately once if present
    if (job.transcriptSegments && Array.isArray(job.transcriptSegments)) {
      const transcriptFile = path.join(job.jobDir, 'transcript.json');
      if (!fs.existsSync(transcriptFile)) {
        fs.writeFileSync(transcriptFile, JSON.stringify(job.transcriptSegments), 'utf8');
      }
    }

    const { transcriptSegments, ...shallowJob } = job;
    fs.writeFileSync(jobFile, JSON.stringify(shallowJob, null, 2), 'utf8');
  } catch {}
}

/**
 * Retrieves a job by ID (checks memory, then disk cache)
 * @param {string} jobId
 * @returns {Object|null}
 */
export function getJob(jobId) {
  if (jobs.has(jobId)) {
    const job = jobs.get(jobId);
    if (!job.transcriptSegments) {
      loadTranscriptForJob(job);
    }
    return job;
  }

  const jobDir = path.join(CONFIG.DATA_DIR, 'jobs', jobId);
  const jobFile = path.join(jobDir, 'job.json');
  if (fs.existsSync(jobFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
      data.jobDir = jobDir;
      loadTranscriptForJob(data);
      jobs.set(jobId, data);
      return data;
    } catch {}
  }

  return null;
}

function loadTranscriptForJob(job) {
  if (!job || !job.jobDir) return;
  const transcriptFile = path.join(job.jobDir, 'transcript.json');
  if (fs.existsSync(transcriptFile)) {
    try {
      job.transcriptSegments = JSON.parse(fs.readFileSync(transcriptFile, 'utf8'));
    } catch {}
  }
}

/**
 * Checks available disk space
 * @returns {Promise<boolean>}
 */
export async function checkDiskSpace() {
  try {
    if (typeof fs.statfs === 'function') {
      const stats = await new Promise((res, rej) => {
        fs.statfs(CONFIG.DATA_DIR, (err, s) => err ? rej(err) : res(s));
      });
      const freeBytes = stats.bavail * stats.bsize;
      return freeBytes > 500 * 1024 * 1024; // At least 500MB free
    }
  } catch {}
  return true;
}

/**
 * Recovers jobs that were left running when engine previously stopped
 */
export function recoverInterruptedJobs() {
  const jobsBase = path.join(CONFIG.DATA_DIR, 'jobs');
  if (!fs.existsSync(jobsBase)) return;

  try {
    const entries = fs.readdirSync(jobsBase, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const jobFile = path.join(jobsBase, ent.name, 'job.json');
      if (fs.existsSync(jobFile)) {
        try {
          const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
          if (job.status === 'running' || job.status === 'pending') {
            job.status = 'failed';
            job.error = 'Job interrupted when engine stopped or restarted.';
            job.updatedAt = new Date().toISOString();
            fs.writeFileSync(jobFile, JSON.stringify(job, null, 2), 'utf8');
          }
        } catch {}
      }
    }
  } catch {}
}

/**
 * Lists recent jobs from disk
 * @param {number} [limit=15]
 * @returns {Array<Object>}
 */
export function listRecentJobs(limit = 15) {
  const jobsBase = path.join(CONFIG.DATA_DIR, 'jobs');
  if (!fs.existsSync(jobsBase)) return [];

  const list = [];
  try {
    const entries = fs.readdirSync(jobsBase, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const jobFile = path.join(jobsBase, ent.name, 'job.json');
      if (fs.existsSync(jobFile)) {
        try {
          const j = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
          list.push({
            id: j.id,
            status: j.status,
            stage: j.stage,
            title: j.video?.title || j.source?.filename || 'Untitled Podcast',
            thumbnail: j.video?.thumbnail || '',
            durationFormatted: j.video?.durationFormatted || '',
            clipCount: (j.clips || []).length,
            renderedCount: (j.clips || []).filter(c => c.rendered).length,
            createdAt: j.createdAt,
            updatedAt: j.updatedAt
          });
        } catch {}
      }
    }
  } catch {}

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return list.slice(0, limit);
}

/**
 * Creates and starts a new processing job
 *
 * @param {Object} params
 * @param {Object} params.source
 * @param {Object} params.options
 * @returns {Promise<string>} jobId
 */
export async function createJob(params) {
  const hasSpace = await checkDiskSpace();
  if (!hasSpace) {
    throw new Error('Insufficient disk space on engine host (< 500MB available). Please free up disk space.');
  }

  const id = `job_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const jobDir = path.join(CONFIG.DATA_DIR, 'jobs', id);
  fs.mkdirSync(jobDir, { recursive: true });

  const job = {
    id,
    jobDir,
    status: 'pending',
    stage: 'reading_video',
    progress: { percent: 0, message: 'Initializing job...' },
    source: params.source,
    options: params.options || {
      clipCount: 10,
      durationPreset: 'standard',
      format: 'title_video',
      framing: 'fill',
      focusX: 0.5,
      censor: true,
      captionSize: 'medium',
      quality: 'fast',
      burnedCaptions: true
    },
    video: null,
    transcriptSegments: null,
    clips: [],
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  jobs.set(id, job);
  persistJob(job);

  // Start processing in background (non-blocking)
  runJobPipeline(job).catch(err => {
    console.error(`Pipeline error in job ${id}:`, err);
  });

  return id;
}

/**
 * Executes the complete 4-stage pipeline for a job
 * @param {Object} job
 */
async function runJobPipeline(job) {
  const { id, source, options, jobDir } = job;
  job.status = 'running';
  job.updatedAt = new Date().toISOString();

  let lastActivityTime = Date.now();
  const watchdogTimer = setInterval(() => {
    if (job.status !== 'running') {
      clearInterval(watchdogTimer);
      return;
    }
    // If no progress for 90s, log warning
    if (Date.now() - lastActivityTime > 90000) {
      console.warn(`Watchdog alert: Job ${id} has been waiting on stage "${job.stage}" for >90s.`);
    }
  }, 30000);

  const updateProgress = (stage, percent, message) => {
    lastActivityTime = Date.now();
    job.stage = stage;
    job.progress = { percent, message };
    job.updatedAt = new Date().toISOString();
    persistJob(job);
    emitJobEvent(id, 'progress', { stage, percent, message });
  };

  const handleNotice = (msg) => {
    lastActivityTime = Date.now();
    emitJobEvent(id, 'notice', { message: msg });
  };

  try {
    // -------------------------------------------------------------
    // STAGE 1: Reading Video Metadata
    // -------------------------------------------------------------
    updateProgress('reading_video', 5, 'Inspecting video source...');

    let videoMeta = null;
    if (source.type === 'upload') {
      const uploadPath = path.join(CONFIG.DATA_DIR, 'uploads', source.uploadId);
      videoMeta = await resolveLocalFileMetadata(uploadPath, source.filename);
    } else {
      videoMeta = await resolveRemoteMetadata(source.url, { jobId: id });
    }

    job.video = videoMeta;
    emitJobEvent(id, 'video_loaded', videoMeta);

    if (job.status === 'cancelled') {
      clearInterval(watchdogTimer);
      return;
    }

    // -------------------------------------------------------------
    // STAGE 2: Transcribing Speech (English Only)
    // -------------------------------------------------------------
    updateProgress('transcribing', 20, 'Checking captions & transcribing dialogue...');

    const transcriptResult = await getOrExtractTranscript(videoMeta, {
      jobId: id,
      onProgress: (p) => updateProgress('transcribing', 20 + Math.round((p.percent / 100) * 25), p.message),
      onNotice: handleNotice
    });

    job.transcriptSegments = transcriptResult.segments;

    if (job.status === 'cancelled') {
      clearInterval(watchdogTimer);
      return;
    }

    // -------------------------------------------------------------
    // STAGE 3: Finding Viral Moments
    // -------------------------------------------------------------
    updateProgress('finding_moments', 50, 'AI scanning timeline for high-retention moments...');

    const foundClips = await findPodcastMoments(job.transcriptSegments, {
      clipCount: options.clipCount,
      durationPreset: options.durationPreset,
      customRanges: options.customRanges || [],
      onNotice: handleNotice,
      onProgress: (p) => updateProgress('finding_moments', 50 + Math.round((p.percent / 100) * 20), p.message)
    });

    job.clips = foundClips;
    emitJobEvent(id, 'moments_found', { clips: foundClips });

    if (job.status === 'cancelled') {
      clearInterval(watchdogTimer);
      return;
    }

    // -------------------------------------------------------------
    // STAGE 4: Cutting & Rendering 9:16 Clips with Captions
    // -------------------------------------------------------------
    updateProgress('cutting_clips', 70, `Preparing to cut ${foundClips.length} Shorts with hook titles & captions...`);

    const clipsOutputDir = path.join(jobDir, 'clips');
    fs.mkdirSync(clipsOutputDir, { recursive: true });

    // Smart download strategy:
    // If video is > 25m (1500s) OR clip coverage is < 25%, use fast section download per clip.
    const videoDuration = videoMeta.durationSec || 0;
    const totalClipDuration = foundClips.reduce((sum, c) => sum + (c.durationSeconds || 30), 0);
    const coverageRatio = videoDuration > 0 ? (totalClipDuration / videoDuration) : 1;
    const preferSectionDownloads = videoMeta.sourceType !== 'local' && (videoDuration > 1500 || coverageRatio < 0.25);

    let fullSourceVideoPath = null;

    if (videoMeta.sourceType === 'local' && videoMeta.filePath) {
      fullSourceVideoPath = videoMeta.filePath;
    } else if (!preferSectionDownloads) {
      updateProgress('cutting_clips', 71, 'Caching source video for high-speed offline clip cutting...');
      const cachedFullDir = path.join(CONFIG.DATA_DIR, 'sources', id);
      fs.mkdirSync(cachedFullDir, { recursive: true });
      const cachedFullPath = path.join(cachedFullDir, 'full_source.mp4');
      fullSourceVideoPath = await downloadFullVideoCached(videoMeta.webpageUrl || videoMeta.url, cachedFullPath, id);
    }

    if (job.status === 'cancelled') {
      clearInterval(watchdogTimer);
      return;
    }

    let renderedCount = 0;
    const totalClips = foundClips.length;

    const queue = [...foundClips];
    const workers = [];

    const renderWorker = async () => {
      while (queue.length > 0) {
        if (job.status === 'cancelled') break;
        const clip = queue.shift();
        if (!clip) break;

        try {
          const clipNumber = foundClips.findIndex(c => c.id === clip.id) + 1;
          const renderResult = await renderClip(
            clip,
            videoMeta,
            job.transcriptSegments,
            {
              jobId: id,
              outputDir: clipsOutputDir,
              format: options.format || 'title_video',
              framing: clip.framing || options.framing || 'fill',
              focusX: typeof clip.focusX === 'number' ? clip.focusX : (options.focusX ?? 0.5),
              burnedCaptions: options.burnedCaptions !== false,
              censor: options.censor !== false,
              captionSize: options.captionSize || 'medium',
              fullVideoPath: fullSourceVideoPath,
              clipNumber,
              totalClips,
              onClipProgress: (progressData) => {
                job.currentClipProgress = progressData;
                emitJobEvent(id, 'clip_progress', progressData);
              }
            }
          );

          clip.rendered = true;
          clip.mp4Path = renderResult.mp4Path;
          clip.srtPath = renderResult.srtPath;
          clip.srtContent = renderResult.srtContent;
          clip.mp4Url = `/clips/${id}/${clip.id}.mp4`;
          clip.srtUrl = `/clips/${id}/${clip.id}.srt`;
          delete clip.renderError;

          renderedCount++;
          const renderPct = 70 + Math.round((renderedCount / totalClips) * 28);
          updateProgress('cutting_clips', renderPct, `Rendered clip ${renderedCount} of ${totalClips}...`);

          // Emit clip_ready so UI displays each clip live as it finishes
          emitJobEvent(id, 'clip_ready', { clip });
        } catch (clipErr) {
          console.error(`Error rendering clip ${clip.id}:`, clipErr);
          clip.rendered = false;
          clip.renderError = clipErr.message;
          emitJobEvent(id, 'clip_failed', { clipId: clip.id, error: clipErr.message });
        }
      }
    };

    const renderConcurrency = Math.min(CONFIG.RENDER_MAX_CONCURRENCY, totalClips);
    for (let i = 0; i < renderConcurrency; i++) {
      workers.push(renderWorker());
    }

    await Promise.all(workers);

    clearInterval(watchdogTimer);

    if (job.status === 'cancelled') return;

    job.status = 'completed';
    job.stage = 'done';
    job.progress = { percent: 100, message: `${job.clips.filter(c => c.rendered).length} clips ready!` };
    job.updatedAt = new Date().toISOString();
    persistJob(job);

    emitJobEvent(id, 'done', { clips: job.clips });

  } catch (err) {
    clearInterval(watchdogTimer);
    if (job.status === 'cancelled') return;
    job.status = 'failed';
    job.error = err.message || 'Job processing failed.';
    job.updatedAt = new Date().toISOString();
    persistJob(job);
    // Emit both job_error and error for backwards compatibility and EventSource error safety
    emitJobEvent(id, 'job_error', { error: job.error });
    emitJobEvent(id, 'error', { error: job.error });
  }
}

/**
 * Re-renders an individual clip with modified title, framing, or layout
 *
 * @param {string} jobId
 * @param {string} clipId
 * @param {Object} customOptions
 * @returns {Promise<Object>} updated clip
 */
export async function rerenderClip(jobId, clipId, customOptions = {}) {
  const job = getJob(jobId);
  if (!job) throw new Error(`Job "${jobId}" not found.`);
  const clip = (job.clips || []).find(c => c.id === clipId);
  if (!clip) throw new Error(`Clip "${clipId}" not found in job.`);

  if (customOptions.onScreenTitle !== undefined) {
    clip.onScreenTitle = customOptions.onScreenTitle;
  }
  if (customOptions.framing) {
    clip.framing = customOptions.framing;
  }
  if (typeof customOptions.focusX === 'number') {
    clip.focusX = customOptions.focusX;
  }

  const clipsOutputDir = path.join(job.jobDir, 'clips');
  const cachedFullPath = path.join(CONFIG.DATA_DIR, 'sources', jobId, 'full_source.mp4');
  const fullVideoPath = fs.existsSync(cachedFullPath) ? cachedFullPath : (job.video?.filePath || null);

  emitJobEvent(jobId, 'clip_rendering', { clipId });

  const renderResult = await renderClip(
    clip,
    job.video,
    job.transcriptSegments || [],
    {
      jobId,
      outputDir: clipsOutputDir,
      format: customOptions.layout || clip.format || job.options?.format || 'title_video',
      framing: clip.framing || job.options?.framing || 'fill',
      focusX: typeof clip.focusX === 'number' ? clip.focusX : (job.options?.focusX ?? 0.5),
      censor: job.options?.censor !== false,
      captionSize: job.options?.captionSize || 'medium',
      burnedCaptions: job.options?.burnedCaptions !== false,
      fullVideoPath
    }
  );

  clip.rendered = true;
  clip.mp4Path = renderResult.mp4Path;
  clip.srtPath = renderResult.srtPath;
  clip.srtContent = renderResult.srtContent;
  clip.mp4Url = `/clips/${jobId}/${clip.id}.mp4?v=${Date.now()}`;
  clip.srtUrl = `/clips/${jobId}/${clip.id}.srt?v=${Date.now()}`;
  delete clip.renderError;

  job.updatedAt = new Date().toISOString();
  persistJob(job);

  emitJobEvent(jobId, 'clip_ready', { clip });
  return clip;
}

/**
 * Cancels a running job and cleans up child processes and temp files
 * @param {string} jobId
 */
export function cancelJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return false;

  job.status = 'cancelled';
  job.updatedAt = new Date().toISOString();
  killJobProcesses(jobId);

  emitJobEvent(jobId, 'cancelled', { message: 'Job was cancelled by user.' });

  try {
    if (fs.existsSync(job.jobDir)) {
      fs.rmSync(job.jobDir, { recursive: true, force: true });
    }
  } catch {}

  return true;
}

/**
 * Creates a streamable ZIP archive containing all rendered MP4s, SRTs, and a clips.txt index
 * @param {string} jobId
 * @returns {archiver.Archiver}
 */
export function createJobZipArchive(jobId) {
  const job = getJob(jobId);
  if (!job || !job.clips) {
    throw new Error('Job not found or has no clips.');
  }

  const archive = new ZipArchive({ zlib: { level: 6 } });
  const clipsTextLines = [];

  clipsTextLines.push(`========================================================================`);
  clipsTextLines.push(`ClipScout YouTube Shorts Studio Package`);
  clipsTextLines.push(`Source: ${job.video?.title || 'Podcast'} (${job.video?.channel || ''})`);
  clipsTextLines.push(`Total Clips: ${job.clips.length}`);
  clipsTextLines.push(`Generated: ${new Date().toLocaleString()}`);
  clipsTextLines.push(`========================================================================\n\n`);

  for (const clip of job.clips) {
    if (clip.mp4Path && fs.existsSync(clip.mp4Path)) {
      archive.file(clip.mp4Path, { name: `${clip.id}_${clip.rank}.mp4` });
    }
    if (clip.srtPath && fs.existsSync(clip.srtPath)) {
      archive.file(clip.srtPath, { name: `${clip.id}_${clip.rank}.srt` });
    }

    clipsTextLines.push(`------------------------------------------------------------------------`);
    clipsTextLines.push(`CLIP #${clip.rank}: ${clip.title}`);
    clipsTextLines.push(`Time: ${clip.startTime} - ${clip.endTime} (${Math.round(clip.durationSeconds)}s)`);
    clipsTextLines.push(`Virality Score: ${clip.viralityScore}/100`);
    clipsTextLines.push(`Hook Overlay Title: ${clip.onScreenTitle || clip.title}`);
    clipsTextLines.push(`\n[TITLE] (Copy for YouTube Studio):\n${clip.title}`);
    clipsTextLines.push(`\n[DESCRIPTION] (Copy for YouTube Studio):\n${clip.description}`);
    clipsTextLines.push(`\n[HASHTAGS]:\n${(clip.hashtags || []).join(' ')}`);
    clipsTextLines.push(`\n[FULL YOUTUBE STUDIO BLOCK]:\n${clip.title}\n\n${clip.description}\n\n${(clip.hashtags || []).join(' ')}\n\n`);
  }

  archive.append(clipsTextLines.join('\n'), { name: 'clips.txt' });
  return archive;
}

/**
 * Cleanup routine: Deletes jobs older than 24 hours
 */
export function cleanupStaleJobs() {
  const now = Date.now();
  const maxAgeMs = 24 * 60 * 60 * 1000;

  for (const [id, job] of jobs.entries()) {
    const age = now - new Date(job.createdAt).getTime();
    if (age > maxAgeMs) {
      try {
        if (fs.existsSync(job.jobDir)) {
          fs.rmSync(job.jobDir, { recursive: true, force: true });
        }
      } catch {}
      jobs.delete(id);
    }
  }
}
