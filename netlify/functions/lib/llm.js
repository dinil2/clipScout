/**
 * Unified LLM Provider Client (Groq Cloud + Google Gemini)
 * Handles rate limits, exponential backoff with Retry-After, failover, and strict JSON parsing.
 * NEVER returns synthetic or padded hallucinated data.
 */

import { BACKEND_CONFIG } from './constants.js';

/**
 * Utility pause helper
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extracts and parses JSON from raw LLM text with markdown fence cleaning
 * @param {string} raw
 * @returns {any}
 */
export function cleanAndParseJson(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty response from AI engine');
  }

  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (initialErr) {
    // Attempt to extract the outermost JSON object or array
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (nestedErr) {
        throw new Error(`JSON parse error: ${nestedErr.message}. Raw output snippet: ${cleaned.slice(0, 150)}`);
      }
    }
    throw new Error(`Malformed JSON response from AI: ${initialErr.message}`);
  }
}

/**
 * Executes a chat completion request to Groq Cloud with retry and backoff
 * @param {string} prompt
 * @param {string} apiKey
 * @param {string} [systemPrompt]
 * @returns {Promise<any>}
 */
async function callGroqWithRetry(prompt, apiKey, systemPrompt) {
  const models = BACKEND_CONFIG.DEFAULT_GROQ_MODELS;
  let lastError = null;

  for (const model of models) {
    for (let attempt = 0; attempt <= BACKEND_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: systemPrompt || 'You are an expert video clipper and editor. Respond strictly with valid JSON conforming to the requested schema. Do not include markdown preamble or conversational text.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            response_format: { type: 'json_object' },
            max_tokens: BACKEND_CONFIG.MAX_LLM_TOKENS,
            temperature: 0.2
          })
        });

        // Handle 429 Rate Limit
        if (res.status === 429) {
          const retryAfterHeader = res.headers.get('retry-after');
          let delayMs = BACKEND_CONFIG.INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          if (retryAfterHeader) {
            const parsed = parseFloat(retryAfterHeader);
            if (!isNaN(parsed) && parsed > 0) {
              delayMs = Math.min(8000, parsed * 1000);
            }
          }

          if (attempt < BACKEND_CONFIG.MAX_RETRIES) {
            console.warn(`Groq model ${model} rate-limited (429). Retrying in ${delayMs}ms (attempt ${attempt + 1})...`);
            await sleep(delayMs);
            continue;
          } else {
            console.warn(`Groq model ${model} exhausted retries under rate limit. Failing over to next candidate model...`);
            break; // Try next model in candidate list
          }
        }

        if (!res.ok) {
          const errText = await res.text();
          let parsedMsg = errText;
          try {
            const errJson = JSON.parse(errText);
            parsedMsg = errJson.error?.message || errText;
          } catch {}
          lastError = new Error(`Groq API error (${res.status}): ${parsedMsg}`);
          console.warn(`Groq error on ${model}:`, parsedMsg);
          break; // Try next model
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          lastError = new Error(`Empty content returned by Groq model ${model}`);
          break;
        }

        return cleanAndParseJson(content);
      } catch (err) {
        lastError = err;
        console.warn(`Exception calling Groq ${model}:`, err.message);
        break;
      }
    }
  }

  throw lastError || new Error('All Groq AI models failed or exhausted rate limits.');
}

/**
 * Executes a request to Google Gemini API via direct REST
 * @param {string} prompt
 * @param {string} apiKey
 * @returns {Promise<any>}
 */
async function callGemini(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Empty response from Gemini');
  }

  return cleanAndParseJson(rawText);
}

/**
 * Primary dispatch function calling the configured AI engine
 *
 * @param {string} prompt
 * @param {Object} [options]
 * @param {string} [options.systemPrompt]
 * @param {import('zod').ZodSchema} [options.schema]
 * @returns {Promise<any>}
 */
export async function executeAiQuery(prompt, options = {}) {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const useGroq = (groqKey && groqKey.trim().length > 0) || (geminiKey && geminiKey.startsWith('gsk_'));
  const activeKey = useGroq ? (groqKey || geminiKey) : geminiKey;

  if (!activeKey) {
    throw new Error('No AI API key found. Please configure GROQ_API_KEY (or GEMINI_API_KEY) in your environment variables.');
  }

  let parsed = null;
  if (useGroq) {
    parsed = await callGroqWithRetry(prompt, activeKey, options.systemPrompt);
  } else {
    parsed = await callGemini(prompt, activeKey);
  }

  // Schema validation if provided
  if (options.schema && parsed) {
    const validationResult = options.schema.safeParse(parsed);
    if (!validationResult.success) {
      console.warn('LLM output schema validation failed:', validationResult.error.format());
      // One repair retry if malformed
      const repairPrompt = `The following JSON did not conform to the required schema:
JSON:
${JSON.stringify(parsed)}

ERRORS:
${JSON.stringify(validationResult.error.issues)}

Please return the corrected JSON object strictly:`;

      const repaired = useGroq
        ? await callGroqWithRetry(repairPrompt, activeKey, 'Fix the malformed JSON to strictly match the requested schema.')
        : await callGemini(repairPrompt, activeKey);

      const secondCheck = options.schema.safeParse(repaired);
      if (secondCheck.success) {
        return secondCheck.data;
      }
      throw new Error(`AI output failed schema validation: ${validationResult.error.message}`);
    }
    return validationResult.data;
  }

  return parsed;
}
