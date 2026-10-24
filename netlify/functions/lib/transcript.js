/**
 * Server-side YouTube Metadata & Transcript Fetcher
 */

import { YoutubeTranscript } from 'youtube-transcript';
import { normalizeYouTubeTranscript } from '../../../src/utils/transcriptParser.js';

/**
 * Fetches video metadata via public YouTube oEmbed endpoint (no API key required)
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
      headers: { 'Accept': 'application/json' }
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
 * Fetches and normalizes YouTube transcript using youtube-transcript package
 * Throws explicit NO_CAPTIONS error if closed captions/subtitles are not available.
 *
 * @param {string} videoId
 * @returns {Promise<Array<{startSec: number, endSec: number, text: string}>>}
 */
export async function fetchYoutubeTranscript(videoId, preferredLang = 'en') {
  try {
    let rawItems = null;
    try {
      rawItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: preferredLang });
    } catch {
      rawItems = await YoutubeTranscript.fetchTranscript(videoId);
    }

    if (!rawItems || rawItems.length === 0) {
      const err = new Error('This video has no captions available from YouTube, so it cannot be analyzed automatically. Please paste or upload the transcript.');
      err.code = 'NO_CAPTIONS';
      throw err;
    }

    const segments = normalizeYouTubeTranscript(rawItems);
    if (segments.length === 0) {
      const err = new Error('Transcript was empty or contained no readable dialogue.');
      err.code = 'NO_CAPTIONS';
      throw err;
    }

    return segments;
  } catch (err) {
    if (err.code === 'NO_CAPTIONS') throw err;

    // Detect typical youtube-transcript error messages for missing captions
    const msg = (err.message || '').toLowerCase();
    if (
      msg.includes('disabled') || 
      msg.includes('transcript is not available') || 
      msg.includes('could not find transcript') ||
      msg.includes('captions')
    ) {
      const customErr = new Error('This video has no captions available from YouTube, so it cannot be analyzed automatically. Please paste or upload the transcript.');
      customErr.code = 'NO_CAPTIONS';
      throw customErr;
    }

    throw new Error(`Failed to fetch YouTube transcript: ${err.message}`);
  }
}
