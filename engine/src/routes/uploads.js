/**
 * Uploads Route: POST /uploads
 * Streams multipart video uploads directly to disk without memory buffering.
 * Supports multi-gigabyte podcast files safely.
 */

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { CONFIG } from '../config.js';

const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.m4a', '.mp3', '.wav', '.avi']);

export default async function uploadsRoutes(fastify) {
  fastify.post('/uploads', async (request, reply) => {
    // Require multipart
    if (!request.isMultipart()) {
      return reply.status(400).send({ error: 'Request must be multipart/form-data' });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file received in upload request.' });
    }

    const rawFilename = data.filename || 'uploaded_video.mp4';
    const ext = path.extname(rawFilename).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      // Drain and reject
      await data.toBuffer();
      return reply.status(400).send({
        error: `Unsupported file extension "${ext}". Allowed types: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`
      });
    }

    const uploadId = `upload_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const destinationPath = path.join(CONFIG.DATA_DIR, 'uploads', uploadId);

    const writeStream = fs.createWriteStream(destinationPath);
    await pipeline(data.file, writeStream);

    const stat = fs.statSync(destinationPath);

    return reply.status(201).send({
      uploadId,
      filename: rawFilename,
      size: stat.size,
      ext
    });
  });
}

