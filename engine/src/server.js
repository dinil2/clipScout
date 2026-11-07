/**
 * ClipScout Engine Server
 * Single-user Fastify backend listening on 127.0.0.1:8787.
 * Serves the React UI, coordinates video processing, and streams live SSE progress.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';

import { 
  CONFIG, 
  initDataDirectories, 
  checkSystemDependencies, 
  printInstallInstructions, 
  verifyGroqModels 
} from './config.js';
import { cleanupStaleJobs, recoverInterruptedJobs } from './services/jobs.js';

import healthRoutes from './routes/health.js';
import uploadsRoutes from './routes/uploads.js';
import jobsRoutes from './routes/jobs.js';
import clipsRoutes from './routes/clips.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_PATH = path.resolve(__dirname, '../../dist');

export async function buildServer() {
  const fastify = Fastify({
    logger: false,
    bodyLimit: 10 * 1024 * 1024 // 10MB for JSON bodies
  });

  // Strict CORS whitelist: same-origin, localhost/127.0.0.1 on any port, and optional ALLOWED_ORIGINS
  const allowedOriginsList = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  await fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      try {
        const parsed = new URL(origin);
        const host = parsed.hostname.toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
          return cb(null, true);
        }
        if (allowedOriginsList.includes(origin.toLowerCase()) || allowedOriginsList.includes(host)) {
          return cb(null, true);
        }
        return cb(new Error('CORS not allowed for this origin'), false);
      } catch {
        return cb(new Error('Invalid origin'), false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-engine-token', 'Range']
  });

  // Multipart streaming up to 4GB for multi-hour local video files
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 4 * 1024 * 1024 * 1024 // 4GB
    }
  });

  // Optional Token Authentication Guard
  fastify.addHook('onRequest', async (request, reply) => {
    if (!CONFIG.ENGINE_TOKEN) return;

    // Health and static files do not require token
    if (request.url === '/health' || (!request.url.startsWith('/api') && !request.url.startsWith('/jobs') && !request.url.startsWith('/uploads') && !request.url.startsWith('/clips'))) {
      return;
    }

    const token = request.headers['x-engine-token'] || request.query?.token;
    if (token !== CONFIG.ENGINE_TOKEN) {
      return reply.status(401).send({ error: 'Unauthorized: Invalid ENGINE_TOKEN.' });
    }
  });

  // Register Engine API Routes
  await fastify.register(healthRoutes);
  await fastify.register(uploadsRoutes);
  await fastify.register(jobsRoutes);
  await fastify.register(clipsRoutes);

  // Serve compiled Studio UI (Vite dist) if it exists
  if (fs.existsSync(DIST_PATH)) {
    await fastify.register(fastifyStatic, {
      root: DIST_PATH,
      prefix: '/'
    });

    // SPA fallback: Route non-asset, non-API GET requests to index.html
    fastify.setNotFoundHandler((request, reply) => {
      if (
        request.method === 'GET' &&
        !request.url.startsWith('/api') &&
        !request.url.startsWith('/jobs') &&
        !request.url.startsWith('/clips') &&
        !request.url.startsWith('/uploads') &&
        !request.url.startsWith('/assets')
      ) {
        return reply.sendFile('index.html');
      }
      reply.status(404).send({ error: `Not found: ${request.url}` });
    });
  }

  return fastify;
}

export async function startServer() {
  initDataDirectories();
  recoverInterruptedJobs();
  cleanupStaleJobs();

  // Hourly cleanup of jobs older than 24 hours
  setInterval(cleanupStaleJobs, 60 * 60 * 1000);

  // System dependencies check
  const sysStatus = await checkSystemDependencies();
  if (sysStatus.missing.length > 0) {
    printInstallInstructions(sysStatus.missing);
  }

  // Verify Groq models
  const groqInfo = await verifyGroqModels();
  if (groqInfo.warning) {
    console.warn(`[Groq Warning] ${groqInfo.warning}`);
  }

  const server = await buildServer();

  try {
    await server.listen({ port: CONFIG.PORT, host: CONFIG.HOST });
    console.log(`\n╔════════════════════════════════════════════════════════════════════╗`);
    console.log(`║ 🎬 ClipScout Engine running at http://${CONFIG.HOST}:${CONFIG.PORT}          ║`);
    console.log(`║ Mode: Single-User Studio ($0 Free Tier, local ffmpeg + Groq)       ║`);
    console.log(`╚════════════════════════════════════════════════════════════════════╝\n`);
  } catch (err) {
    console.error('Failed to start ClipScout Engine server:', err);
    process.exit(1);
  }
}

// Auto-run if executed directly via node engine/src/server.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
