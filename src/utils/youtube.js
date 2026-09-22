/**
 * Extracts an 11-character YouTube video ID from various YouTube URL formats or returns the raw ID.
 * @param {string} input - YouTube URL or video ID
 * @returns {string|null} 11-character video ID or null if invalid
 */
export function extractYouTubeVideoId(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // If already an 11-character alphanumeric ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Common YouTube URL regex (watch, youtu.be, embed, shorts, live)
  const regex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([a-zA-Z0-9_-]{11})/i;
  const match = trimmed.match(regex);
  return match ? match[1] : null;
}

/**
 * Converts seconds into a formatted "mm:ss" string (or "hh:mm:ss" for hours).
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatSecondsToTimestamp(totalSeconds) {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Parses timestamp string like "01:23" or "1:02:15" into total seconds.
 * @param {string} timestamp
 * @returns {number}
 */
export function parseTimestampToSeconds(timestamp) {
  if (!timestamp || typeof timestamp !== 'string') return 0;
  const parts = timestamp.trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

/**
 * Generates direct YouTube jump URL with start timestamp.
 * @param {string} videoId
 * @param {number|string} startSecondsOrTimestamp
 * @returns {string}
 */
export function getYouTubePreviewUrl(videoId, startSecondsOrTimestamp) {
  const seconds = typeof startSecondsOrTimestamp === 'number' 
    ? Math.floor(startSecondsOrTimestamp) 
    : parseTimestampToSeconds(startSecondsOrTimestamp);
  return `https://youtu.be/${videoId}?t=${seconds}`;
}

/**
 * Formats a duration in seconds into a friendly badge string (e.g. "45s", "1m 12s").
 * @param {number} seconds
 * @returns {string}
 */
export function formatDurationBadge(seconds) {
  if (!seconds || seconds <= 0) return 'Short';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}
