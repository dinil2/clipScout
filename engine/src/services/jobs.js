/**
 * Job Manager & Orchestration Engine
 * Coordinates the 4-stage pipeline:
 * 1. Reading video (Metadata)
 * 2. Transcribing (YouTube VTT or chunked Groq Whisper)
 * 3. Finding moments (Sliding windows, AI evaluation, snapping)
 * 4. Cutting clips (ffmpeg 9:16 render with burned captions, SSE clip_ready events)
 *
 * Supports real-time SSE progress, cancellation, and ZIP export.
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
  const job = jobs.get(jobId);
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
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

/**
 * Persists job state to disk in jobDir/job.json
 * @param {Object} job
 */
export function persistJob(job) {
  if (!job || !job.jobDir) return;
  try {
    const jobFile = path.join(job.jobDir, 'job.json');
    fs.writeFileSync(jobFile, JSON.stringify(job, null, 2), 'utf8');
  } catch {}
}

/**
 * Retrieves a job by ID (checks memory, then disk cache)
 * @param {string} jobId
 * @returns {Object|null}
 */
export function getJob(jobId) {
  if (jobs.has(jobId)) {
    return jobs.get(jobId);
  }

  const jobFile = path.join(CONFIG.DATA_DIR, 'jobs', jobId, 'job.json');
  if (fs.existsSync(jobFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
      jobs.set(jobId, data);
      return data;
    } catch {}
  }

  return null;
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
 * Creates and starts a new processing job
 *
 * @param {Object} params
 * @param {Object} params.source - { type: 'youtube'|'drive'|'upload', url?: string, uploadId?: string }
 * @param {Object} params.options - { clipCount, durationPreset, format, burnedCaptions }
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
      format: 'vertical',
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

  const updateProgress = (stage, percent, message) => {
    job.stage = stage;
    job.progress = { percent, message };
    job.updatedAt = new Date().toISOString();
    persistJob(job);
    emitJobEvent(id, 'progress', { stage, percent, message });
  };

  const handleNotice = (msg) => {
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

    if (job.status === 'cancelled') return;

    // -------------------------------------------------------------
    // STAGE 2: Transcribing Speech
    // -------------------------------------------------------------
    updateProgress('transcribing', 20, 'Checking captions & transcribing dialogue...');

    const transcriptResult = await getOrExtractTranscript(videoMeta, {
      jobId: id,
      onProgress: (p) => updateProgress('transcribing', 20 + Math.round((p.percent / 100) * 25), p.message),
      onNotice: handleNotice
    });

    job.transcriptSegments = transcriptResult.segments;

    if (job.status === 'cancelled') return;

    // -------------------------------------------------------------
    // STAGE 3: Finding Viral Moments
    // -------------------------------------------------------------
    updateProgress('finding_moments', 50, 'AI scanning timeline for high-retention moments...');

    const foundClips = await findPodcastMoments(job.transcriptSegments, {
      clipCount: options.clipCount,
      durationPreset: options.durationPreset,
      onNotice: handleNotice,
      onProgress: (p) => updateProgress('finding_moments', 50 + Math.round((p.percent / 100) * 20), p.message)
    });

    job.clips = foundClips;
    emitJobEvent(id, 'moments_found', { clips: foundClips });

    if (job.status === 'cancelled') return;

    // -------------------------------------------------------------
    // STAGE 4: Cutting & Rendering 9:16 Clips with Captions
    // -------------------------------------------------------------
    updateProgress('cutting_clips', 70, `Preparing to cut ${foundClips.length} vertical clips with burned captions...`);

    const clipsOutputDir = path.join(jobDir, 'clips');
    fs.mkdirSync(clipsOutputDir, { recursive: true });

    // Pre-cache full source video once if remote URL, eliminating concurrency collisions & WinError 32
    let fullSourceVideoPath = null;
    if (videoMeta.sourceType === 'local' && videoMeta.filePath) {
      fullSourceVideoPath = videoMeta.filePath;
    } else {
      updateProgress('cutting_clips', 71, 'Caching source video for high-speed offline clip cutting...');
      const cachedFullDir = path.join(CONFIG.DATA_DIR, 'sources', id);
      fs.mkdirSync(cachedFullDir, { recursive: true });
      const cachedFullPath = path.join(cachedFullDir, 'full_source.mp4');
      fullSourceVideoPath = await downloadFullVideoCached(videoMeta.webpageUrl || videoMeta.url, cachedFullPath, id);
    }

    if (job.status === 'cancelled') return;

    let renderedCount = 0;
    const totalClips = foundClips.length;

    // Concurrency limit of 2 renders at once
    const queue = [...foundClips];
    const workers = [];

    const renderWorker = async () => {
      while (queue.length > 0) {
        if (job.status === 'cancelled') break;
        const clip = queue.shift();
        if (!clip) break;

        try {
          const renderResult = await renderClip(
            clip,
            videoMeta,
            job.transcriptSegments,
            {
              jobId: id,
              outputDir: clipsOutputDir,
              format: options.format || 'vertical',
              burnedCaptions: options.burnedCaptions !== false,
              fullVideoPath: fullSourceVideoPath
            }
          );

          clip.rendered = true;
          clip.mp4Path = renderResult.mp4Path;
          clip.srtPath = renderResult.srtPath;
          clip.srtContent = renderResult.srtContent;
          clip.mp4Url = `/clips/${id}/${clip.id}.mp4`;
          clip.srtUrl = `/clips/${id}/${clip.id}.srt`;

          renderedCount++;
          const renderPct = 70 + Math.round((renderedCount / totalClips) * 28);
          updateProgress('cutting_clips', renderPct, `Rendered clip ${renderedCount} of ${totalClips}...`);

          // Emit clip_ready so UI displays each clip live as it finishes
          emitJobEvent(id, 'clip_ready', { clip });
        } catch (clipErr) {
          console.error(`Error rendering clip ${clip.id}:`, clipErr);
          clip.renderError = clipErr.message;
        }
      }
    };

    const renderConcurrency = Math.min(CONFIG.RENDER_MAX_CONCURRENCY, totalClips);
    for (let i = 0; i < renderConcurrency; i++) {
      workers.push(renderWorker());
    }

    await Promise.all(workers);

    if (job.status === 'cancelled') return;

    job.status = 'completed';
    job.stage = 'done';
    job.progress = { percent: 100, message: `${job.clips.filter(c => c.rendered).length} clips ready!` };
    job.updatedAt = new Date().toISOString();
    persistJob(job);

    emitJobEvent(id, 'done', { clips: job.clips });

  } catch (err) {
    if (job.status === 'cancelled') return;
    job.status = 'failed';
    job.error = err.message || 'Job processing failed.';
    job.updatedAt = new Date().toISOString();
    persistJob(job);
    emitJobEvent(id, 'error', { error: job.error });
  }
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

  // Clean up job directory
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
  const job = jobs.get(jobId);
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

  // Also sweep uploads folder for uploads older than 24 hours
  const uploadsDir = path.join(CONFIG.DATA_DIR, 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const f of files) {
      const p = path.join(uploadsDir, f);
      try {
        const stat = fs.statSync(p);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(p);
        }
      } catch {}
    }
  }
}
