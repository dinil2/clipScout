/**
 * Netlify Serverless Function: /api/download
 * Generates exact yt-dlp CLI command for creators.
 * Third-party downloader services removed for safety and honesty.
 */

import { checkAuthAndRateLimit } from './lib/auth.js';
import { formatSecondsToTimestamp } from '../../src/utils/youtube.js';

export const handler = async (event) => {
  const auth = checkAuthAndRateLimit(event);
  if (!auth.allowed) {
    return {
      statusCode: auth.statusCode || 403,
      headers: auth.headers,
      body: JSON.stringify({ error: auth.error || 'Access denied' })
    };
  }

  const { headers } = auth;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  let videoId = '';
  let start = 0;
  let end = 30;
  let title = 'clip';

  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {};
    videoId = (params.videoId || '').trim();
    start = Math.max(0, parseInt(params.start || '0', 10));
    end = Math.max(start + 5, parseInt(params.end || '30', 10));
    title = (params.title || 'clip').trim();
  } else if (event.httpMethod === 'POST') {
    try {
      const b = JSON.parse(event.body || '{}');
      videoId = (b.videoId || '').trim();
      start = Math.max(0, parseInt(b.start || '0', 10));
      end = Math.max(start + 5, parseInt(b.end || '30', 10));
      title = (b.title || 'clip').trim();
    } catch {}
  }

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing or invalid 11-character YouTube videoId.' })
    };
  }

  const safeTitle = (title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 45);
  const startStr = formatSecondsToTimestamp(start);
  const endStr = formatSecondsToTimestamp(end);

  // Exact yt-dlp command downloading only the designated section in 1080p
  const cliCommand = `yt-dlp --download-sections "*${startStr}-${endStr}" -f "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]/best" "https://www.youtube.com/watch?v=${videoId}" -o "${safeTitle}.mp4"`;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      videoId,
      start,
      end,
      duration: Math.max(5, end - start),
      title,
      cliCommand,
      youtubeUrl: `https://youtu.be/${videoId}?t=${start}`,
      notice: 'Only download sources the campaign and original creator authorize for clipping.'
    })
  };
};
