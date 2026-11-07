/**
 * Resilient LLM Router (Groq + Gemini Failover)
 * - Shared state across requests: tracks active model index, cooldowns, and exhaustion
 * - Automatic failover: Groq Model A -> Model B -> Model C -> Gemini Flash
 * - 45-second AbortController timeout preventing hung requests
 * - Clear, actionable rate-limit notices with countdown and auto-clear
 * - Strict JSON parsing with markdown fence stripping and Zod validation
 */

import { CONFIG } from '../config.js';
import { extractRetryDelayMs } from '../lib/rateLimiter.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Global persistent router state across job steps
const routerState = {
  groqModelIndex: 0,
  modelCooldowns: new Map(), // modelName -> timestampMs
  groqDailyExhausted: false,
  geminiDailyExhausted: false
};

const DEFAULT_GROQ_MODELS = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile'
];

const DEFAULT_GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

/**
 * Strips markdown fences, quotes, or trailing artifacts from AI text output
 * @param {string} raw
 * @returns {any}
 */
export function cleanAndParseAiJson(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('AI returned an empty response.');
  }

  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt extracting first valid JSON object or array
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error(`Failed to parse AI JSON response: ${cleaned.slice(0, 100)}...`);
  }
}

/**
 * Calls Groq chat completion API with timeout and error extraction
 */
async function callGroq(prompt, model, apiKey, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an elite video editing assistant extracting viral YouTube Shorts moments. Output strictly valid JSON matching the requested schema.'
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 4000
      })
    });

    if (res.status === 429) {
      const errText = await res.text();
      const err = new Error(`Groq 429 Rate Limit: ${errText}`);
      err.status = 429;
      err.response = res;
      err.errorBody = errText;
      throw err;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Groq returned empty choice content.');
    }

    return content;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls Google Gemini REST API with timeout
 */
async function callGemini(prompt, model, apiKey, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${prompt}\n\nIMPORTANT: Respond with pure JSON only, without markdown fences or additional commentary.` }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4000,
          responseMimeType: 'application/json'
        }
      })
    });

    if (res.status === 429) {
      const errText = await res.text();
      const err = new Error(`Gemini 429 Rate Limit: ${errText}`);
      err.status = 429;
      err.response = res;
      err.errorBody = errText;
      throw err;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) {
      throw new Error('Gemini returned empty candidate part.');
    }

    return candidate;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dispatches an AI prompt across Groq models and Gemini with failover
 *
 * @param {string} prompt
 * @param {Object} [options]
 * @param {import('zod').ZodSchema} [options.schema]
 * @param {(notice: string|null) => void} [options.onNotice]
 * @param {number} [options.maxTotalAttempts=6]
 * @returns {Promise<any>}
 */
export async function routeLlmRequest(prompt, options = {}) {
  const { schema, onNotice, maxTotalAttempts = 6 } = options;

  const groqKey = CONFIG.GROQ_API_KEY;
  const geminiKey = CONFIG.GEMINI_API_KEY;

  if (!groqKey && !geminiKey) {
    throw new Error('No AI API key found. Please configure GROQ_API_KEY or GEMINI_API_KEY in .env.');
  }

  const groqModels = CONFIG.GROQ_MODELS && CONFIG.GROQ_MODELS.length > 0
    ? CONFIG.GROQ_MODELS
    : DEFAULT_GROQ_MODELS;

  for (let attempt = 0; attempt < maxTotalAttempts; attempt++) {
    const now = Date.now();

    // 1. Try Groq if available and not exhausted
    if (groqKey && !routerState.groqDailyExhausted) {
      // Find a model not in cooldown
      let chosenModel = null;
      for (let i = 0; i < groqModels.length; i++) {
        const idx = (routerState.groqModelIndex + i) % groqModels.length;
        const candidateModel = groqModels[idx];
        const cooldownEnd = routerState.modelCooldowns.get(candidateModel) || 0;
        if (now >= cooldownEnd) {
          chosenModel = candidateModel;
          routerState.groqModelIndex = idx;
          break;
        }
      }

      if (chosenModel) {
        try {
          const rawText = await callGroq(prompt, chosenModel, groqKey);
          const parsed = cleanAndParseAiJson(rawText);

          if (schema) {
            const check = schema.safeParse(parsed);
            if (check.success) {
              if (onNotice) onNotice(null); // Clear any notice
              return check.data;
            }
          } else {
            if (onNotice) onNotice(null);
            return parsed;
          }
        } catch (err) {
          const is429 = err.status === 429 || err.message?.includes('429');
          const isDaily = err.errorBody?.toLowerCase().includes('daily') || err.message?.toLowerCase().includes('limit per day');

          if (isDaily) {
            routerState.groqDailyExhausted = true;
            if (onNotice) onNotice('Groq daily quota reached. Switching to Gemini fallback...');
          } else if (is429) {
            const delayMs = extractRetryDelayMs(err.response, err.errorBody || err.message, attempt);
            routerState.modelCooldowns.set(chosenModel, Date.now() + delayMs);
            // Move index to next model for next call
            routerState.groqModelIndex = (routerState.groqModelIndex + 1) % groqModels.length;
            const nextModel = groqModels[routerState.groqModelIndex];
            if (onNotice) {
              onNotice(`Rate limit on ${chosenModel}. Switching to ${nextModel}...`);
            }
            continue;
          } else {
            // Non-rate limit error: rotate model
            routerState.groqModelIndex = (routerState.groqModelIndex + 1) % groqModels.length;
          }
        }
      }
    }

    // 2. Try Gemini if Groq is unavailable, cooling down, or exhausted
    if (geminiKey && !routerState.geminiDailyExhausted) {
      for (const geminiModel of DEFAULT_GEMINI_MODELS) {
        try {
          if (onNotice && groqKey) {
            onNotice(`Calling backup engine (${geminiModel})...`);
          }
          const rawText = await callGemini(prompt, geminiModel, geminiKey);
          const parsed = cleanAndParseAiJson(rawText);

          if (schema) {
            const check = schema.safeParse(parsed);
            if (check.success) {
              if (onNotice) onNotice(null);
              return check.data;
            }
          } else {
            if (onNotice) onNotice(null);
            return parsed;
          }
        } catch (geminiErr) {
          if (geminiErr.status === 429 && geminiErr.errorBody?.toLowerCase().includes('quota')) {
            routerState.geminiDailyExhausted = true;
          }
        }
      }
    }

    // 3. If all current options are cooling down, perform a live countdown
    const shortestCooldown = Math.max(
      1000,
      Math.min(
        ...Array.from(routerState.modelCooldowns.values()).map(t => Math.max(0, t - Date.now())),
        8000
      )
    );

    const waitSec = Math.ceil(shortestCooldown / 1000);
    for (let s = waitSec; s > 0; s--) {
      if (onNotice) {
        onNotice(`Free limit reached, continuing in ${s} second${s === 1 ? '' : 's'}...`);
      }
      await sleep(1000);
    }
    if (onNotice) onNotice(null);
  }

  throw new Error('All AI models (Groq and Gemini) exceeded available rate limits or timeouts.');
}

