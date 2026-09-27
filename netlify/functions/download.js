/**
 * Netlify Serverless Function: /api/download
 * Handles clip export and download helper for production Netlify deployment
 */
export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

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
    start = parseInt(params.start || '0');
    end = parseInt(params.end || '30');
    title = (params.title || 'clip').trim();
  } else if (event.httpMethod === 'POST') {
    try {
      const b = JSON.parse(event.body || '{}');
      videoId = (b.videoId || '').trim();
      start = parseInt(b.start || '0');
      end = parseInt(b.end || '30');
      title = (b.title || 'clip').trim();
    } catch {}
  }

  if (!videoId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing or invalid videoId.' })
    };
  }

  function formatSec(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  const safeTitle = (title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 45);
  const startStr = formatSec(start);
  const endStr = formatSec(end);

  const cliCommand = `yt-dlp --download-sections "*${startStr}-${endStr}" -f "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]/best" "https://www.youtube.com/watch?v=${videoId}" -o "${safeTitle}.mp4"`;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      mode: 'web_options',
      videoId,
      start,
      end,
      duration: Math.max(5, end - start),
      title,
      cliCommand,
      youtubeUrl: `https://youtu.be/${videoId}?t=${start}`,
      downloadServices: [
        {
          name: 'YT Cutter (Web Timestamp Trimmer)',
          url: 'https://ytcutter.com/',
          tip: 'Paste video link and set start/end timestamps directly online'
        },
        {
          name: 'Cobalt Media (Lossless 1080p)',
          url: 'https://cobalt.tools/',
          tip: 'Paste video link for instant 1080p ad-free media download'
        },
        {
          name: 'SaveFrom / ssYouTube',
          url: `https://www.ssyoutube.com/watch?v=${videoId}`,
          tip: 'Direct browser MP4 video grabber'
        }
      ]
    })
  };
};
