/**
 * Netlify Serverless Function: /api/transcribe
 * Direct Speech-to-Text Transcription via Groq Whisper (whisper-large-v3-turbo)
 * Supports uploaded video/audio files from laptop and public cloud audio links.
 */

import dotenv from 'dotenv';
dotenv.config();

import { checkAuthAndRateLimit } from './lib/auth.js';
import { transcribeAudioWithWhisper } from './lib/whisper.js';

export const handler = async (event) => {
  // 1. Auth, CORS & Rate Limiting Guard
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' })
    };
  }

  try {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    const rawFilename = event.headers['x-filename'] || event.headers['X-Filename'] || '';
    const filename = rawFilename ? decodeURIComponent(rawFilename) : 'upload_media.mp4';
    const safeTitle = filename.replace(/\.[^/.]+$/, '') || 'Uploaded Video';

    let audioBuffer;

    // Case A: JSON Payload (e.g. Google Drive link or base64 data)
    if (contentType.includes('application/json')) {
      const body = JSON.parse(event.body || '{}');
      const driveUrl = body.url || '';
      const base64Data = body.base64Data || '';
      const providedTitle = body.title || safeTitle;

      if (base64Data) {
        audioBuffer = Buffer.from(base64Data, 'base64');
      } else if (driveUrl && driveUrl.includes('drive.google.com')) {
        // Extract Google Drive File ID
        const fileIdMatch = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || driveUrl.match(/id=([a-zA-Z0-9_-]+)/);
        if (!fileIdMatch) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Could not parse Google Drive file ID. Ensure link is public.' })
          };
        }

        const fileId = fileIdMatch[1];
        const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

        const driveRes = await fetch(directDownloadUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (!driveRes.ok) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: 'Failed to access Google Drive file. Ensure file sharing is set to "Anyone with the link can view".'
            })
          };
        }

        const arrayBuf = await driveRes.arrayBuffer();
        audioBuffer = Buffer.from(arrayBuf);
      } else {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing audio or video file data.' })
        };
      }
    } else {
      // Case B: Raw Binary / Multipart Upload
      if (event.isBase64Encoded) {
        audioBuffer = Buffer.from(event.body, 'base64');
      } else if (typeof event.body === 'string') {
        audioBuffer = Buffer.from(event.body, 'binary');
      } else if (Buffer.isBuffer(event.body)) {
        audioBuffer = event.body;
      }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No media data received for transcription.' })
      };
    }

    // Serverless payload size check (Netlify Lambda max payload is ~6MB)
    if (audioBuffer.length > 25 * 1024 * 1024) {
      return {
        statusCode: 413,
        headers,
        body: JSON.stringify({
          error: 'File size exceeds 25MB limit. Please upload an audio file (.mp3, .m4a, .wav) or use a shorter video.'
        })
      };
    }

    // Call Groq Whisper
    const whisperResult = await transcribeAudioWithWhisper(audioBuffer, filename);

    if (!whisperResult.segments || whisperResult.segments.length === 0) {
      return {
        statusCode: 422,
        headers,
        body: JSON.stringify({
          error: 'No recognizable speech could be detected in this audio file. Please check audio clarity.'
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        video: {
          videoId: `upload_${Date.now()}`,
          title: safeTitle,
          author: 'Local Laptop Video',
          isLocalFile: true,
          durationSeconds: whisperResult.totalDurationSec
        },
        transcriptSegments: whisperResult.segments,
        totalDurationSec: whisperResult.totalDurationSec
      })
    };

  } catch (err) {
    console.error('Transcription function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: err.message || 'Speech-to-text transcription failed on server.'
      })
    };
  }
};
