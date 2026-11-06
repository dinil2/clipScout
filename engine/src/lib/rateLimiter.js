/**
 * Free-Tier Rate Limiter & Backoff Guard
 * Handles Groq and Gemini free-tier rate limits (RPM & TPM).
 * Honors Retry-After headers, parses error retry windows, and provides user notices.
 */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extracts retry delay from headers or error message
 * @param {Response} [res]
 * @param {string} [errorBody]
 * @param {number} [attempt=0]
 * @returns {number} Delay in milliseconds
 */
export function extractRetryDelayMs(res, errorBody = '', attempt = 0) {
  // 1. Check HTTP Retry-After header
  if (res) {
    const retryHeader = res.headers?.get?.('retry-after');
    if (retryHeader) {
      const parsed = parseFloat(retryHeader);
      if (!isNaN(parsed) && parsed > 0) {
        return Math.min(30000, Math.ceil(parsed * 1000));
      }
    }
  }

  // 2. Parse Groq error message like "Please try again in 4.2s" or "try again in 5s"
  if (errorBody) {
    const match = errorBody.match(/try again in\s*([0-9\.]+)\s*s/i);
    if (match && match[1]) {
      const seconds = parseFloat(match[1]);
      if (!isNaN(seconds) && seconds > 0) {
        return Math.min(30000, Math.ceil((seconds + 0.5) * 1000));
      }
    }
  }

  // 3. Exponential backoff fallback: 2s, 4s, 8s, 16s...
  return Math.min(20000, 2000 * Math.pow(2, attempt));
}

/**
 * Wraps an async API call with free-tier rate limiting and visible user notification.
 *
 * @template T
 * @param {() => Promise<T>} apiCallFn
 * @param {Object} [options]
 * @param {(message: string) => void} [options.onNotice] - Emits "Free limit reached, continuing in N seconds"
 * @param {number} [options.maxRetries=4]
 * @returns {Promise<T>}
 */
export async function executeWithRateLimit(apiCallFn, options = {}) {
  const maxRetries = options.maxRetries ?? 4;
  const onNotice = options.onNotice || console.warn;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCallFn();
    } catch (err) {
      const isRateLimit = err.status === 429 || 
        err.message?.includes('429') || 
        err.message?.toLowerCase().includes('rate limit') ||
        err.message?.toLowerCase().includes('tokens per minute');

      if (!isRateLimit || attempt >= maxRetries) {
        throw err;
      }

      const delayMs = extractRetryDelayMs(err.response, err.message, attempt);
      const delaySec = Math.ceil(delayMs / 1000);
      const noticeMsg = `Free limit reached, continuing in ${delaySec} seconds...`;

      onNotice(noticeMsg);
      await sleep(delayMs);
    }
  }

  throw new Error('Exhausted maximum rate limit retries.');
}

