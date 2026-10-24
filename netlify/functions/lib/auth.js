/**
 * Security, Authentication & Request Policy Guard
 * Manages CORS restrictions, optional shared passcode check, and IP rate limiting.
 */

// Simple in-memory sliding window rate limiter (tracks IP -> array of timestamps)
const ipRequestHistory = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 40;     // 40 requests per minute per IP

/**
 * Periodically cleans up expired entries to prevent memory bloat
 */
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [ip, timestamps] of ipRequestHistory.entries()) {
    const active = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (active.length === 0) {
      ipRequestHistory.delete(ip);
    } else {
      ipRequestHistory.set(ip, active);
    }
  }
}

/**
 * Resolves permitted CORS origin based on environment and request headers
 * @param {Object} event
 * @returns {string}
 */
export function getCorsOrigin(event) {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;

  // In production, restrict to site origin or same-origin
  if (process.env.NODE_ENV === 'production' && siteUrl) {
    if (requestOrigin && (requestOrigin === siteUrl || requestOrigin.endsWith('.netlify.app'))) {
      return requestOrigin;
    }
    return siteUrl;
  }

  // Allow localhost during dev or matching origin
  if (requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1')) {
    return requestOrigin;
  }

  return requestOrigin || '*';
}

/**
 * Generates standard secure CORS headers
 * @param {Object} event
 * @returns {Record<string, string>}
 */
export function getStandardHeaders(event) {
  const origin = getCorsOrigin(event);
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization, x-app-passcode',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin'
  };
}

/**
 * Checks optional shared APP_PASSCODE and enforces IP rate limits
 * @param {Object} event
 * @returns {{ allowed: boolean, statusCode?: number, error?: string, headers: Record<string, string> }}
 */
export function checkAuthAndRateLimit(event) {
  const headers = getStandardHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { allowed: true, statusCode: 200, headers };
  }

  // 1. Passcode Check (if APP_PASSCODE is set in env)
  const requiredPasscode = process.env.APP_PASSCODE;
  if (requiredPasscode && requiredPasscode.trim().length > 0) {
    const userPasscode = event.headers?.['x-app-passcode'] ||
      event.headers?.['X-App-Passcode'] ||
      event.headers?.['x-passcode'] ||
      '';

    if (userPasscode !== requiredPasscode) {
      return {
        allowed: false,
        statusCode: 401,
        headers,
        error: 'Unauthorized: Missing or invalid application passcode. Set in Settings.'
      };
    }
  }

  // 2. IP Rate Limiter
  const clientIp = event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers?.['client-ip'] ||
    'anonymous-client';

  const now = Date.now();
  cleanupRateLimitMap();

  const history = ipRequestHistory.get(clientIp) || [];
  const recent = history.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = recent[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000));
    headers['Retry-After'] = String(retryAfterSec);
    return {
      allowed: false,
      statusCode: 429,
      headers,
      error: `Rate limit exceeded. Please wait ${retryAfterSec} seconds before sending more requests.`
    };
  }

  recent.push(now);
  ipRequestHistory.set(clientIp, recent);

  return { allowed: true, headers };
}
