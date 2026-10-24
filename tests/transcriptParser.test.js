import { describe, it, expect } from 'vitest';
import {
  cleanSubtitleText,
  normalizeYouTubeTranscript,
  parseSrt,
  parseVtt,
  parseTimestampedText,
  parsePlainText,
  generateSrtForClip
} from '../src/utils/transcriptParser';

describe('transcriptParser', () => {
  it('cleans HTML entities and noise tags', () => {
    const raw = '&amp; He said &quot;Wait!&quot; [Music] &lt;tag&gt;';
    expect(cleanSubtitleText(raw)).toBe('& He said "Wait!" <tag>');
  });

  it('normalizes YouTube transcript items with seconds', () => {
    const raw = [
      { offset: 0, duration: 2.5, text: 'Welcome to this clip' },
      { offset: 2.5, duration: 3.0, text: 'This is the next sentence' }
    ];
    const normalized = normalizeYouTubeTranscript(raw);
    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toEqual({
      startSec: 0,
      endSec: 2.5,
      text: 'Welcome to this clip'
    });
    expect(normalized[1].startSec).toBe(2.5);
    expect(normalized[1].endSec).toBe(5.5);
  });

  it('detects milliseconds in YouTube transcript and normalizes', () => {
    const raw = [
      { offset: 1200, duration: 3400, text: 'First line in millis' },
      { offset: 4600, duration: 2100, text: 'Second line in millis' }
    ];
    const normalized = normalizeYouTubeTranscript(raw);
    expect(normalized[0].startSec).toBe(1.2);
    expect(normalized[0].endSec).toBe(4.6);
  });

  it('parses valid SRT subtitle string', () => {
    const srt = `1
00:00:01,000 --> 00:00:04,500
First caption line

2
00:00:05,000 --> 00:00:08,200
Second caption line`;

    const segments = parseSrt(srt);
    expect(segments).toHaveLength(2);
    expect(segments[0].startSec).toBe(1);
    expect(segments[0].endSec).toBe(4.5);
    expect(segments[0].text).toBe('First caption line');
    expect(segments[1].startSec).toBe(5);
    expect(segments[1].endSec).toBe(8.2);
  });

  it('parses WebVTT format', () => {
    const vtt = `WEBVTT

1
00:00:02.000 --> 00:00:05.500
WebVTT line 1`;

    const segments = parseVtt(vtt);
    expect(segments).toHaveLength(1);
    expect(segments[0].startSec).toBe(2);
    expect(segments[0].endSec).toBe(5.5);
    expect(segments[0].text).toBe('WebVTT line 1');
  });

  it('parses timestamped text lines', () => {
    const text = `[00:15] This is the opening point.
[00:45] Here is the key milestone.`;

    const segments = parseTimestampedText(text);
    expect(segments).toHaveLength(2);
    expect(segments[0].startSec).toBe(15);
    expect(segments[0].endSec).toBe(45);
    expect(segments[0].text).toBe('This is the opening point.');
  });

  it('generates real SRT for clip timestamps starting at 00:00:00', () => {
    const segments = [
      { startSec: 10, endSec: 15, text: 'Intro segment' },
      { startSec: 15, endSec: 25, text: 'Hook sentence' },
      { startSec: 25, endSec: 35, text: 'Payoff sentence' },
      { startSec: 40, endSec: 50, text: 'Outside segment' }
    ];

    const srt = generateSrtForClip(segments, 15, 35);
    expect(srt).toContain('00:00:00,000 --> 00:00:10,000');
    expect(srt).toContain('Hook sentence');
    expect(srt).toContain('Payoff sentence');
    expect(srt).not.toContain('Outside segment');
  });
});
