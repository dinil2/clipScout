/**
 * Clips Delivery Routes:
 * - GET /clips/:jobId/:clipId.mp4 (Range support for video preview + download attachment)
 * - GET /clips/:jobId/:clipId.srt (Subtitle download)
 * - GET /jobs/:id/download.zip (Full batch zip package)
 */

import path from 'path';
import fs from 'fs';
import { getJob, createJobZipArchive } from '../services/jobs.js';

export default async function clipsRoutes(fastify) {
  // Stream or download MP4 with HTTP Range support
  fastify.get('/clips/:jobId/:clipId.mp4', async (request, reply) => {
    const { jobId, clipId } = request.params;
    const { download } = request.query;

    const job = getJob(jobId);
    if (!job) {
      return reply.status(404).send({ error: 'Job not found.' });
    }

    const clip = (job.clips || []).find(c => c.id === clipId);
    if (!clip || !clip.mp4Path || !fs.existsSync(clip.mp4Path)) {
      return reply.status(404).send({ error: `Clip "${clipId}" not found or still rendering.` });
    }

    const stat = fs.statSync(clip.mp4Path);
    const fileSize = stat.size;
    const range = request.headers.range;

    const safeTitle = (clip.title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 45);
    const filename = `${safeTitle}_${Math.floor(clip.startSeconds)}-${Math.ceil(clip.endSeconds)}.mp4`;

    // Handle HTTP Range (critical for browser seeking and video player preview)
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      reply.raw.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4'
      });

      const fileStream = fs.createReadStream(clip.mp4Path, { start, end });
      return reply.send(fileStream);
    }

    // Full download or preview
    const headers = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes'
    };

    if (download === 'true' || download === '1') {
      headers['Content-Disposition'] = `attachment; filename="${filename}"`;
    }

    reply.headers(headers);
    const fileStream = fs.createReadStream(clip.mp4Path);
    return reply.send(fileStream);
  });

  // Download SRT Subtitles
  fastify.get('/clips/:jobId/:clipId.srt', async (request, reply) => {
    const { jobId, clipId } = request.params;
    const job = getJob(jobId);
    if (!job) {
      return reply.status(404).send({ error: 'Job not found.' });
    }

    const clip = (job.clips || []).find(c => c.id === clipId);
    if (!clip || !clip.srtPath || !fs.existsSync(clip.srtPath)) {
      return reply.status(404).send({ error: `Subtitles for clip "${clipId}" not found.` });
    }

    const safeTitle = (clip.title || 'subtitles').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 45);
    reply.header('Content-Type', 'text/plain; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${safeTitle}.srt"`);

    const fileStream = fs.createReadStream(clip.srtPath);
    return reply.send(fileStream);
  });

  // Download all clips + clips.txt as a ZIP archive
  fastify.get('/jobs/:id/download.zip', async (request, reply) => {
    const { id } = request.params;
    const job = getJob(id);
    if (!job) {
      return reply.status(404).send({ error: 'Job not found.' });
    }

    try {
      const archive = createJobZipArchive(id);
      const safeTitle = (job.video?.title || 'podcast_shorts').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);

      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${safeTitle}_shorts_package.zip"`);

      archive.finalize();
      return reply.send(archive);
    } catch (err) {
      return reply.status(500).send({ error: err.message || 'Failed to generate ZIP archive.' });
    }
  });
}

