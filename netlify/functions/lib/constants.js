/**
 * Constants for Netlify Serverless Backend
 */

export const BACKEND_CONFIG = {
  DEFAULT_GROQ_MODELS: [
    'openai/gpt-oss-120b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'qwen/qwen3.8-27b'
  ],
  MAX_TRANSCRIPT_CHARS: 600000,
  WINDOW_DURATION_SEC: 90,
  STRIDE_SEC: 30,
  TOP_PRE_RANK_LIMIT: 40,
  BATCH_SIZE: 10,
  MAX_LLM_TOKENS: 3500,
  MAX_RETRIES: 2,
  INITIAL_RETRY_DELAY_MS: 1200
};
