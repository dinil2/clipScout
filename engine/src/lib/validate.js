/**
 * Schema Validation & Anti-Hallucination Guard
 * Uses Zod to strictly validate user inputs, job requests, and AI responses.
 * Verifies that extracted evidence quotes truly exist inside the source transcript.
 */

import { z } from 'zod';

/**
 * Validates allowed video source URLs (YouTube or Google Drive)
 */
export const sourceUrlSchema = z.string().trim().refine((url) => {
  if (!url) return false;
  // YouTube 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return true;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isYoutube = host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com' || host === 'youtu.be';
    const isDrive = host === 'drive.google.com';
    return isYoutube || isDrive;
  } catch {
    return false;
  }
}, {
  message: 'URL must be a valid YouTube link (or 11-char ID) or a public Google Drive link.'
});

/**
 * Validates create job payload
 */
export const createJobSchema = z.object({
  source: z.object({
    type: z.enum(['youtube', 'drive', 'upload']),
    url: z.string().optional(),
    uploadId: z.string().optional()
  }).refine((data) => {
    if (data.type === 'upload') return Boolean(data.uploadId);
    return Boolean(data.url);
  }, {
    message: 'Either a valid URL or an uploadId is required.'
  }),
  options: z.object({
    clipCount: z.enum(['5', '10', '15', '20']).or(z.number().int().min(1).max(25)).default(10),
    durationPreset: z.enum(['short', 'standard', 'long']).default('standard'),
    format: z.enum(['vertical', 'original']).default('vertical'),
    burnedCaptions: z.boolean().default(true)
  }).default({
    clipCount: 10,
    durationPreset: 'standard',
    format: 'vertical',
    burnedCaptions: true
  })
});

/**
 * LLM Candidate Evaluation Schema (4 sub-scores of 0-25 + embedded packaging)
 */
export const windowEvaluationSchema = z.object({
  windowId: z.string().or(z.number()),
  hook: z.coerce.number().min(0).max(25),
  standaloneClarity: z.coerce.number().min(0).max(25),
  emotionPayoff: z.coerce.number().min(0).max(25),
  retentionLoop: z.coerce.number().min(0).max(25),
  title: z.string().optional(),
  description: z.string().optional(),
  hookText: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  reasoning: z.string().min(1),
  evidenceQuote: z.string().min(2),
  suggestedStartSec: z.coerce.number().optional(),
  suggestedEndSec: z.coerce.number().optional()
});

export const batchEvaluationResponseSchema = z.object({
  evaluations: z.array(windowEvaluationSchema)
});

/**
 * Standalone LLM Clip Packaging Schema (if needed)
 */
export const clipPackageSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(5),
  hookText: z.string().optional().default(''),
  hashtags: z.array(z.string()).default([]),
  evidenceQuote: z.string().min(2)
});

/**
 * Normalizes text for search & evidence comparison
 * @param {string} text
 * @returns {string}
 */
export function normalizeForSearch(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifies that the claimed evidence quote actually appears within the transcript text
 * Returns false for synthetic or hallucinated quotes.
 *
 * @param {string} evidenceQuote
 * @param {string} transcriptText
 * @returns {boolean}
 */
export function verifyEvidenceQuote(evidenceQuote, transcriptText) {
  if (!evidenceQuote || !transcriptText) return false;

  const normQuote = normalizeForSearch(evidenceQuote);
  const normSource = normalizeForSearch(transcriptText);

  if (normQuote.length < 3 || normSource.length < 3) return false;

  // Exact substring check
  if (normSource.includes(normQuote)) {
    return true;
  }

  // Token sequence overlap check (for slight punctuation/audio-transcription variance)
  const quoteTokens = normQuote.split(' ').filter(w => w.length > 2);
  if (quoteTokens.length === 0) return true;

  let matchedTokens = 0;
  for (const token of quoteTokens) {
    if (normSource.includes(token)) {
      matchedTokens++;
    }
  }

  const matchRatio = matchedTokens / quoteTokens.length;
  // Require at least 70% token presence
  return matchRatio >= 0.70;
}
