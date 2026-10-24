/**
 * Schema Validation & Anti-Hallucination Guard
 * Uses Zod to strictly validate LLM outputs and verifies that evidence quotes
 * truly exist inside the source transcript.
 */

import { z } from 'zod';

export const windowEvaluationSchema = z.object({
  windowId: z.string().or(z.number()),
  hook: z.coerce.number().min(0).max(25),
  standaloneClarity: z.coerce.number().min(0).max(25),
  emotionPayoff: z.coerce.number().min(0).max(25),
  campaignFit: z.coerce.number().min(0).max(25),
  reasoning: z.string().min(1),
  evidenceQuote: z.string().min(2),
  suggestedStartSec: z.coerce.number().optional(),
  suggestedEndSec: z.coerce.number().optional()
});

export const batchEvaluationResponseSchema = z.object({
  evaluations: z.array(windowEvaluationSchema)
});

export const clipPackageSchema = z.object({
  hookText: z.string().min(2),
  title: z.string().min(3),
  description: z.string().min(5),
  hashtags: z.array(z.string()).default([]),
  pinnedComment: z.string().min(2),
  editingTip: z.string().min(2),
  evidenceQuote: z.string().min(2)
});

/**
 * Normalizes text for evidence matching (lowercase, alphanumeric, spaces only)
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
 * Anti-hallucination verification:
 * Confirms that the claimed evidence quote actually appears within the transcript text.
 * Drops clips that invent quotes.
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
  // Require at least 75% token presence
  return matchRatio >= 0.75;
}
