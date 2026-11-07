/**
 * ClipScout Engine Configuration & Dependency Verification
 * Zero-cost, single-user architecture powered by local ffmpeg, yt-dlp, and free-tier Groq/Gemini APIs.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { runProcess } from './lib/proc.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

export const CONFIG = {
  PROJECT_ROOT,
  PORT: parseInt(process.env.ENGINE_PORT || '8787', 10),
  HOST: '127.0.0.1', // Strictly local for single user
  DATA_DIR: path.resolve(PROJECT_ROOT, process.env.ENGINE_DATA_DIR || './.engine_data'),
  ENGINE_TOKEN: process.env.ENGINE_TOKEN || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || '',
  YTDLP_COOKIES_FROM_BROWSER: process.env.YTDLP_COOKIES_FROM_BROWSER || '',
  
  // Model lists with fallbacks (fast direct JSON instruct models first)
  GROQ_MODELS: (process.env.GROQ_MODELS || 'qwen/qwen3.8-27b,openai/gpt-oss-120b,openai/gpt-oss-20b')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  GROQ_WHISPER_MODEL: process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo',
  
  // Audio & Whisper chunking constraints
  WHISPER_CHUNK_MAX_DURATION_SEC: 600, // 10 minutes max
  WHISPER_CHUNK_MAX_BYTES: 24 * 1024 * 1024, // 24 MB (under 25MB Groq limit)
  WHISPER_OVERLAP_SEC: 2.0, // 2s overlap to catch words split across boundaries
  WHISPER_MAX_CONCURRENCY: 2,
  
  // Video render constraints
  RENDER_MAX_CONCURRENCY: parseInt(process.env.RENDER_MAX_CONCURRENCY || '2', 10), // Concurrency 2 processes clips in parallel, cutting wall-clock time in half
  MAX_CLIP_DURATION_SEC: 180, // YouTube Shorts maximum limit (3 min)
  
  // Bundled Assets
  FONTS_DIR: path.resolve(__dirname, '../assets/fonts'),
  FONT_FILE: path.resolve(__dirname, '../assets/fonts/Inter.ttf')
};

// Ensure data subdirectories exist
export function initDataDirectories() {
  const dirs = [
    CONFIG.DATA_DIR,
    path.join(CONFIG.DATA_DIR, 'uploads'),
    path.join(CONFIG.DATA_DIR, 'sources'),
    path.join(CONFIG.DATA_DIR, 'transcripts'),
    path.join(CONFIG.DATA_DIR, 'audio_chunks'),
    path.join(CONFIG.DATA_DIR, 'jobs')
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Checks system binaries: ffmpeg, ffprobe, libass filter support, yt-dlp
 * Returns detailed health check status and install instructions if missing.
 */
export async function checkSystemDependencies() {
  const status = {
    ffmpeg: false,
    ffprobe: false,
    libass: false,
    ytdlp: false,
    versions: {
      node: process.version,
      ffmpeg: '',
      ffprobe: '',
      ytdlp: ''
    },
    missing: []
  };

  // 1. ffmpeg check
  try {
    const res = await runProcess('ffmpeg', ['-version']);
    if (res.exitCode === 0) {
      status.ffmpeg = true;
      status.versions.ffmpeg = (res.stdout.split('\n')[0] || '').replace('ffmpeg version ', '').trim();
    }
  } catch {
    status.missing.push('ffmpeg');
  }

  // 2. ffprobe check
  try {
    const res = await runProcess('ffprobe', ['-version']);
    if (res.exitCode === 0) {
      status.ffprobe = true;
      status.versions.ffprobe = (res.stdout.split('\n')[0] || '').replace('ffprobe version ', '').trim();
    }
  } catch {
    status.missing.push('ffprobe');
  }

  // 3. libass check via ffmpeg -filters
  if (status.ffmpeg) {
    try {
      const res = await runProcess('ffmpeg', ['-filters']);
      if (res.stdout.includes(' ass ') || res.stdout.includes(' subtitles ')) {
        status.libass = true;
      } else {
        status.missing.push('libass (FFmpeg compiled without --enable-libass)');
      }
    } catch {
      status.missing.push('libass');
    }
  }

  // 4. yt-dlp check
  try {
    const res = await runProcess('yt-dlp', ['--version']);
    if (res.exitCode === 0) {
      status.ytdlp = true;
      status.versions.ytdlp = res.stdout.trim();
    }
  } catch {
    status.missing.push('yt-dlp');
  }

  return status;
}

/**
 * Prints helpful install guides if any required system tool is missing.
 */
export function printInstallInstructions(missing) {
  if (!missing || missing.length === 0) return;

  console.error('\n' + '='.repeat(70));
  console.error('⚠️  CRITICAL DEPENDENCY WARNING');
  console.error(`Missing required tools: ${missing.join(', ')}`);
  console.error('ClipScout needs ffmpeg (with libass) and yt-dlp to run at $0 locally.');
  console.error('\nINSTALLATION INSTRUCTIONS:');
  console.error('  Windows:');
  console.error('    winget install Gyan.FFmpeg');
  console.error('    winget install yt-dlp.yt-dlp');
  console.error('  macOS:');
  console.error('    brew install ffmpeg yt-dlp');
  console.error('  Linux (Debian/Ubuntu):');
  console.error('    sudo apt update && sudo apt install ffmpeg');
  console.error('    sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp');
  console.error('='.repeat(70) + '\n');
}

/**
 * Verifies configured Groq model IDs against Groq's live models list.
 * Falls back to next available model with a visible console warning.
 */
export async function verifyGroqModels() {
  if (!CONFIG.GROQ_API_KEY) {
    return {
      configured: false,
      activeModel: null,
      availableModels: [],
      warning: 'GROQ_API_KEY is not set. Speech transcription and AI moment finding require Groq API key.'
    };
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${CONFIG.GROQ_API_KEY}` }
    });

    if (!res.ok) {
      return {
        configured: true,
        activeModel: CONFIG.GROQ_MODELS[0],
        availableModels: [],
        warning: `Could not verify Groq models (HTTP ${res.status}). Using fallback: ${CONFIG.GROQ_MODELS[0]}`
      };
    }

    const data = await res.json();
    const liveModelIds = (data.data || []).map(m => m.id);

    // Find first configured model that is active on Groq
    let selectedModel = CONFIG.GROQ_MODELS.find(m => liveModelIds.includes(m));

    let warning = null;
    if (!selectedModel) {
      // Find any chat model available on Groq
      const fallbackChat = liveModelIds.find(id => 
        id.includes('llama') || id.includes('gpt-oss') || id.includes('qwen') || id.includes('mixtral')
      );
      selectedModel = fallbackChat || CONFIG.GROQ_MODELS[0];
      warning = `None of the configured models (${CONFIG.GROQ_MODELS.join(', ')}) were found on Groq. Falling back to active model: ${selectedModel}`;
      console.warn(`[Groq Model Guard] ${warning}`);
    } else if (selectedModel !== CONFIG.GROQ_MODELS[0]) {
      warning = `Preferred model ${CONFIG.GROQ_MODELS[0]} not active. Using verified alternate: ${selectedModel}`;
      console.warn(`[Groq Model Guard] ${warning}`);
    }

    return {
      configured: true,
      activeModel: selectedModel,
      availableModels: liveModelIds,
      warning
    };
  } catch (err) {
    return {
      configured: true,
      activeModel: CONFIG.GROQ_MODELS[0],
      availableModels: [],
      warning: `Model check failed: ${err.message}. Using default: ${CONFIG.GROQ_MODELS[0]}`
    };
  }
}

