/**
 * Groq Whisper Speech-to-Text Transcription Module
 * Transcribes audio files directly using Groq's ultra-fast whisper-large-v3-turbo model.
 */

import dotenv from 'dotenv';
dotenv.config();

/**
 * Transcribes an audio buffer or file path into timestamped segments
 * @param {Buffer|Uint8Array|string} audioBufferOrPath
 * @param {string} [filename='audio.mp3']
 * @returns {Promise<{text: string, segments: Array<{startSec: number, endSec: number, text: string}>, totalDurationSec: number}>}
 */
export async function transcribeAudioWithWhisper(audioBufferOrPath, filename = 'audio.mp3') {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is required for Whisper speech transcription. Please check your environment variables or settings.');
  }

  const formData = new FormData();
  let fileBlob;

  if (typeof audioBufferOrPath === 'string') {
    const fs = await import('fs');
    const buf = fs.readFileSync(audioBufferOrPath);
    fileBlob = new Blob([buf], { type: 'audio/mp3' });
  } else {
    fileBlob = new Blob([audioBufferOrPath], { type: 'audio/mp3' });
  }

  formData.append('file', fileBlob, filename);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'verbose_json');
  formData.append('temperature', '0.0');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Whisper transcription error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rawSegments = data.segments || [];

  const normalized = rawSegments.map(s => ({
    startSec: Math.round(Number(s.start || 0) * 100) / 100,
    endSec: Math.round(Number(s.end || 0) * 100) / 100,
    text: (s.text || '').trim()
  })).filter(s => s.text.length > 0);

  const totalDurationSec = Math.ceil(Number(data.duration || (normalized[normalized.length - 1]?.endSec || 0)));

  return {
    text: data.text || '',
    segments: normalized,
    totalDurationSec
  };
}
