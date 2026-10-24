/**
 * Server-side YouTube Metadata & Transcript Fetcher
 * Resilient multi-tier extraction optimized for both local dev and cloud serverless (Netlify/AWS Lambda)
 */

import { YoutubeTranscript } from 'youtube-transcript';
import { normalizeYouTubeTranscript, cleanSubtitleText } from '../../../src/utils/transcriptParser.js';

const INNERTUBE_CLIENT_VERSION = '20.10.38';
const INNERTUBE_USER_AGENT = `com.google.android.youtube/${INNERTUBE_CLIENT_VERSION} (Linux; U; Android 14)`;

let cachedVisitorData = null;
let visitorDataExpiry = 0;

/**
 * Retrieves a fresh Google visitor token to pass YouTube's security handshakes
 * @returns {Promise<string>}
 */
async function getVisitorData() {
  const now = Date.now();
  if (cachedVisitorData && now < visitorDataExpiry) {
    return cachedVisitorData;
  }

  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/visitor_id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': INNERTUBE_USER_AGENT
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: INNERTUBE_CLIENT_VERSION,
            androidSdkVersion: 34,
            osName: 'Android',
            osVersion: '14',
            platform: 'MOBILE'
          }
        }
      }),
      signal: AbortSignal.timeout(3500)
    });

    if (res.ok) {
      const data = await res.json();
      const token = data?.responseContext?.visitorData;
      if (token) {
        cachedVisitorData = token;
        visitorDataExpiry = now + (20 * 60 * 1000); // Cache for 20 mins
        return token;
      }
    }
  } catch (err) {
    console.warn('Failed to obtain visitor token:', err.message);
  }

  return '';
}

/**
 * Fetches video metadata via public YouTube oEmbed endpoint with fallback
 * @param {string} videoId
 * @returns {Promise<{videoId: string, title: string, author: string, authorUrl: string, thumbnail: string}>}
 */
export async function fetchYoutubeMetadata(videoId) {
  const fallback = {
    videoId,
    title: 'YouTube Video',
    author: 'Creator',
    authorUrl: '',
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  };

  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      return {
        videoId,
        title: data.title || fallback.title,
        author: data.author_name || fallback.author,
        authorUrl: data.author_url || '',
        thumbnail: data.thumbnail_url || fallback.thumbnail
      };
    }
  } catch (err) {
    console.warn(`oEmbed fetch failed for ${videoId}:`, err.message);
  }

  return fallback;
}

/**
 * Direct InnerTube Android client transcript extractor
 * Bypasses cloud datacenter IP blocks by utilizing native mobile player endpoints with visitor context
 *
 * @param {string} videoId
 * @param {string} preferredLang
 * @returns {Promise<Array<{startSec: number, endSec: number, text: string}>>}
 */
async function fetchInnerTubeTranscript(videoId, preferredLang = 'en') {
  const visitorData = await getVisitorData();

  const reqHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': INNERTUBE_USER_AGENT,
    ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {})
  };

  const clientContext = {
    clientName: 'ANDROID',
    clientVersion: INNERTUBE_CLIENT_VERSION,
    androidSdkVersion: 34,
    osName: 'Android',
    osVersion: '14',
    platform: 'MOBILE',
    ...(visitorData ? { visitorData } : {})
  };

  const resp = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify({
      context: { client: clientContext },
      videoId
    }),
    signal: AbortSignal.timeout(6000)
  });

  if (!resp.ok) {
    throw new Error(`InnerTube HTTP ${resp.status}`);
  }

  const data = await resp.json();
  const playability = data?.playabilityStatus;
  if (playability && playability.status && playability.status !== 'OK') {
    const reason = playability.reason || playability.messages?.[0] || '';
    const lowerReason = reason.toLowerCase();

    if (lowerReason.includes('bot') || lowerReason.includes('sign in')) {
      const botErr = new Error('YouTube bot-check restriction encountered for this video. Please upload the video file (.mp4, .mov) directly for Groq Whisper transcription, or paste the transcript.');
      botErr.code = 'NO_CAPTIONS';
      throw botErr;
    }

    if (lowerReason.includes('unavailable') || lowerReason.includes('private')) {
      const privErr = new Error('This video is unavailable or private on YouTube. Please check the link.');
      privErr.code = 'VIDEO_UNAVAILABLE';
      throw privErr;
    }

    const err = new Error(reason || 'Video restricted on YouTube.');
    err.code = 'VIDEO_UNAVAILABLE';
    throw err;
  }

  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!Array.isArray(tracks) || tracks.length === 0) {
    const err = new Error('This video has no closed captions or transcript tracks available on YouTube. Please upload the video file (.mp4, .mov) directly for automatic speech-to-text with Groq Whisper, or paste the transcript.');
    err.code = 'NO_CAPTIONS';
    throw err;
  }

  // Track selection priority:
  // 1. Exact match preferred language (manual captions, not asr)
  // 2. Exact match preferred language (auto-generated asr)
  // 3. Prefix match preferred language (e.g. en-US, en-GB)
  // 4. First available caption track
  let selectedTrack = tracks.find(t => t.languageCode === preferredLang && t.kind !== 'asr');
  if (!selectedTrack) selectedTrack = tracks.find(t => t.languageCode === preferredLang);
  if (!selectedTrack) selectedTrack = tracks.find(t => t.languageCode?.startsWith(preferredLang));
  if (!selectedTrack) selectedTrack = tracks[0];

  if (!selectedTrack || !selectedTrack.baseUrl) {
    const err = new Error('No valid transcript track URL available from YouTube.');
    err.code = 'NO_CAPTIONS';
    throw err;
  }

  const timedTextHeaders = {
    'User-Agent': INNERTUBE_USER_AGENT,
    ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {})
  };

  // Attempt 1: Fetch via high-speed json3 format with Android User-Agent
  try {
    const jsonUrl = new URL(selectedTrack.baseUrl);
    jsonUrl.searchParams.set('fmt', 'json3');
    const cRes = await fetch(jsonUrl.toString(), {
      headers: timedTextHeaders,
      signal: AbortSignal.timeout(6000)
    });

    if (cRes.ok) {
      const cData = await cRes.json();
      const events = cData?.events || [];
      const segments = [];

      for (const ev of events) {
        if (!ev.segs || !Array.isArray(ev.segs)) continue;
        const rawText = ev.segs.map(s => s.utf8 || '').join('');
        const text = cleanSubtitleText(rawText);
        if (!text) continue;

        const startSec = Math.round((Number(ev.tStartMs || 0) / 1000) * 100) / 100;
        const durSec = Math.max(0.4, Math.round((Number(ev.dDurationMs || 0) / 1000) * 100) / 100);
        const endSec = Math.round((startSec + durSec) * 100) / 100;

        segments.push({ startSec, endSec, text });
      }

      if (segments.length > 0) {
        return segments.sort((a, b) => a.startSec - b.startSec);
      }
    }
  } catch (jsonErr) {
    console.warn(`json3 transcript fetch fallback for ${videoId}:`, jsonErr.message);
  }

  // Attempt 2: Fetch via srv3 XML format with Android User-Agent
  try {
    const xmlRes = await fetch(selectedTrack.baseUrl, {
      headers: timedTextHeaders,
      signal: AbortSignal.timeout(6000)
    });

    if (xmlRes.ok) {
      const xmlBody = await xmlRes.text();
      const parsed = YoutubeTranscript.parseTranscriptXml(xmlBody, selectedTrack.languageCode);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const segments = normalizeYouTubeTranscript(parsed);
        if (segments.length > 0) return segments;
      }
    }
  } catch (xmlErr) {
    console.warn(`srv3 XML transcript fetch fallback for ${videoId}:`, xmlErr.message);
  }

  const err = new Error('Could not parse dialogue segments from YouTube caption track.');
  err.code = 'NO_CAPTIONS';
  throw err;
}

/**
 * Fetches and normalizes YouTube transcript using multi-tier strategy
 *
 * @param {string} videoId
 * @param {string} preferredLang
 * @returns {Promise<Array<{startSec: number, endSec: number, text: string}>>}
 */
export async function fetchYoutubeTranscript(videoId, preferredLang = 'en') {
  // Strategy 1: Direct InnerTube Android client with visitor context
  try {
    const segments = await fetchInnerTubeTranscript(videoId, preferredLang);
    if (segments && segments.length > 0) {
      return segments;
    }
  } catch (err) {
    if (err.code === 'VIDEO_UNAVAILABLE' || err.code === 'NO_CAPTIONS') {
      throw err;
    }
    console.warn(`InnerTube fetch attempt failed for ${videoId}, trying library fallback:`, err.message);
  }

  // Strategy 2: youtube-transcript package fallback
  try {
    let rawItems = null;
    try {
      rawItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: preferredLang });
    } catch {
      rawItems = await YoutubeTranscript.fetchTranscript(videoId);
    }

    if (Array.isArray(rawItems) && rawItems.length > 0) {
      const segments = normalizeYouTubeTranscript(rawItems);
      if (segments.length > 0) {
        return segments;
      }
    }
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('unavailable') || msg.includes('private')) {
      const uErr = new Error('This video is unavailable or restricted on YouTube.');
      uErr.code = 'VIDEO_UNAVAILABLE';
      throw uErr;
    }
    console.warn(`youtube-transcript fallback failed for ${videoId}:`, err.message);
  }

  // Final fallback error if all strategies yielded no usable segments
  const customErr = new Error('This video has no captions available from YouTube, so it cannot be analyzed automatically. Please upload the video file (.mp4, .mov) directly for automatic speech-to-text with Groq Whisper, or paste the transcript.');
  customErr.code = 'NO_CAPTIONS';
  throw customErr;
}
