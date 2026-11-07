import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_OPTIONS, CLIP_COUNT_OPTIONS, DURATION_PRESETS, FORMAT_OPTIONS } from '../src/lib/constants.js';
import { loadSettings, saveSettings, getEngineUrl, getEngineToken } from '../src/lib/storage.js';
import { EngineClient } from '../src/api/engineClient.js';

describe('Studio Configuration & Defaults', () => {
  it('has valid default options for podcast Shorts generation', () => {
    expect(DEFAULT_OPTIONS.clipCount).toBe(10);
    expect(DEFAULT_OPTIONS.durationPreset).toBe('standard');
    expect(DEFAULT_OPTIONS.format).toBe('title_video');
    expect(DEFAULT_OPTIONS.burnedCaptions).toBe(true);
    expect(DEFAULT_OPTIONS.censor).toBe(true);
  });

  it('defines valid options for clip counts and presets', () => {
    expect(CLIP_COUNT_OPTIONS.map(c => c.value)).toEqual([5, 10, 15, 20]);
    expect(DURATION_PRESETS.map(d => d.value)).toEqual(['short', 'standard', 'long']);
    expect(FORMAT_OPTIONS.map(f => f.value)).toEqual(['title_video', 'vertical', 'original']);
  });
});

describe('EngineClient API URL Formatting', () => {
  const client = new EngineClient('http://127.0.0.1:8787', 'secret-token-123');

  it('attaches engine token to headers when present', () => {
    const headers = client.getHeaders({ 'Content-Type': 'application/json' });
    expect(headers['x-engine-token']).toBe('secret-token-123');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('constructs correct MP4 video streaming and download URLs', () => {
    const previewUrl = client.getClipMp4Url('job_123', 'clip-1');
    expect(previewUrl).toBe('http://127.0.0.1:8787/clips/job_123/clip-1.mp4?token=secret-token-123');

    const downloadUrl = client.getClipMp4Url('job_123', 'clip-1', true);
    expect(downloadUrl).toBe('http://127.0.0.1:8787/clips/job_123/clip-1.mp4?download=true&token=secret-token-123');
  });

  it('constructs correct SRT subtitle URL and ZIP package URL', () => {
    const srtUrl = client.getClipSrtUrl('job_123', 'clip-1');
    expect(srtUrl).toBe('http://127.0.0.1:8787/clips/job_123/clip-1.srt?token=secret-token-123');

    const zipUrl = client.getZipDownloadUrl('job_123');
    expect(zipUrl).toBe('http://127.0.0.1:8787/jobs/job_123/download.zip?token=secret-token-123');
  });

  it('constructs correct SSE event stream URL', () => {
    const eventsUrl = client.getEventsUrl('job_123');
    expect(eventsUrl).toBe('http://127.0.0.1:8787/jobs/job_123/events?token=secret-token-123');
  });
});

describe('Custom Timestamps Parser', () => {
  it('parses HH:MM:SS and MM:SS correctly', async () => {
    const { parseClockToSec } = await import('../src/components/studio/CustomTimestamps.jsx');
    expect(parseClockToSec('01:19:00')).toBe(4740);
    expect(parseClockToSec('01:19:47')).toBe(4787);
    expect(parseClockToSec('19:00')).toBe(1140);
    expect(parseClockToSec('19:47')).toBe(1187);
    expect(parseClockToSec('45')).toBe(45);
    expect(parseClockToSec('invalid')).toBe(null);
  });
});


