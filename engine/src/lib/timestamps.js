/**
 * Timestamp Parsing and Formatting Utility
 * Handles conversion between seconds, SRT timestamps, VTT timestamps, and ASS subtitle centiseconds.
 */

/**
 * Converts seconds into human-readable clock format (MM:SS or HH:MM:SS)
 * @param {number} totalSec
 * @returns {string}
 */
export function secondsToClock(totalSec) {
  const s = Math.max(0, Math.floor(Number(totalSec) || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Parses timestamp string like "01:23", "01:23:45", or "00:01:23.450" into seconds
 * @param {string} timeStr
 * @returns {number}
 */
export function parseClockToSeconds(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const normalized = timeStr.trim().replace(',', '.');
  const parts = normalized.split(':');

  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return Math.max(0, hours * 3600 + minutes * 60 + seconds);
  }
  if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return Math.max(0, minutes * 60 + seconds);
  }
  return Math.max(0, parseFloat(normalized) || 0);
}

/**
 * Formats seconds into standard SRT timestamp: 00:00:00,000
 * @param {number} totalSec
 * @returns {string}
 */
export function secondsToSrtTime(totalSec) {
  const s = Math.max(0, totalSec);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);

  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Formats seconds into WebVTT timestamp: 00:00:00.000
 * @param {number} totalSec
 * @returns {string}
 */
export function secondsToVttTime(totalSec) {
  return secondsToSrtTime(totalSec).replace(',', '.');
}

/**
 * Formats seconds into ASS timestamp format: H:MM:SS.cc (centiseconds)
 * E.g. 1.25 -> 0:00:01.25, 75.5 -> 0:01:15.50
 * @param {number} totalSec
 * @returns {string}
 */
export function secondsToAssTime(totalSec) {
  const s = Math.max(0, totalSec);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const centis = Math.floor(((s % 1) * 100));

  return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

