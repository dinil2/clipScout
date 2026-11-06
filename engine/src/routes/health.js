/**
 * Health Route: GET /health
 * Inspects system binary availability, versions, and verified AI models.
 */

import { checkSystemDependencies, verifyGroqModels, CONFIG } from '../config.js';

export default async function healthRoutes(fastify) {
  fastify.get('/health', async (request, reply) => {
    const sysDeps = await checkSystemDependencies();
    const groqInfo = await verifyGroqModels();

    const ok = sysDeps.ffmpeg && sysDeps.libass && sysDeps.ytdlp && groqInfo.configured;

    return reply.status(ok ? 200 : 503).send({
      ok,
      system: sysDeps,
      ai: {
        groqConfigured: groqInfo.configured,
        geminiConfigured: Boolean(CONFIG.GEMINI_API_KEY),
        activeModel: groqInfo.activeModel,
        whisperModel: CONFIG.GROQ_WHISPER_MODEL,
        warning: groqInfo.warning
      }
    });
  });
}

