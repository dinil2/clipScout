import { describe, it, expect } from 'vitest';
import { parseSrt, generateSrtForClip, cleanSubtitleText } from '../src/lib/srt.js';
import { parseVtt } from '../src/lib/vtt.js';
import { planAudioChunks, deduplicateOverlapSegments } from '../src/services/whisper.js';
import { generateAndPreRankWindows } from '../src/lib/windows.js';
import { calculateTotalScore, scoreWindowHeuristic } from '../src/lib/scoring.js';
import { snapToSentenceBoundaries } from '../src/lib/snapping.js';
import { buildFfmpegFilterGraph, buildFfmpegRenderArgs, batchDownloadSectionsWithYtdlp } from '../src/services/render.js';
import { generateAssSubtitles, buildWordChunks, ASS_COLORS } from '../src/lib/ass.js';
import { buildClipHashtags, normalizeTag } from '../src/services/hashtags.js';
import { sourceUrlSchema, verifyEvidenceQuote } from '../src/lib/validate.js';
import { secondsToClock, parseClockToSeconds, secondsToAssTime, secondsToSrtTime } from '../src/lib/timestamps.js';

describe('1. Timestamp Formatting & Parsing', () => {
  it('converts seconds to clock correctly', () => {
    expect(secondsToClock(45)).toBe('00:45');
    expect(secondsToClock(125)).toBe('02:05');
    expect(secondsToClock(3665)).toBe('1:01:05');
  });

  it('parses clock strings to seconds', () => {
    expect(parseClockToSeconds('01:30')).toBe(90);
    expect(parseClockToSeconds('01:02:03')).toBe(3723);
    expect(parseClockToSeconds('00:00:15.500')).toBe(15.5);
  });

  it('formats SRT and ASS timestamps accurately', () => {
    expect(secondsToSrtTime(65.45)).toBe('00:01:05,450');
    expect(secondsToAssTime(65.45)).toBe('0:01:05.45');
  });
});

describe('2. VTT and SRT Subtitle Parsing', () => {
  it('parses SRT content and strips HTML artifacts', () => {
    const srt = `1\n00:00:01,000 --> 00:00:04,000\nHello <i>world</i> &amp; welcome [Music]\n\n2\n00:00:04,500 --> 00:00:08,000\nThis is clip two.\n`;
    const segments = parseSrt(srt);

    expect(segments).toHaveLength(2);
    expect(segments[0].startSec).toBe(1.0);
    expect(segments[0].endSec).toBe(4.0);
    expect(segments[0].text).toBe('Hello world & welcome');
    expect(segments[1].text).toBe('This is clip two.');
  });

  it('parses WebVTT content and deduplicates rolling captions', () => {
    const vtt = `WEBVTT\nKind: captions\n\n00:00:01.000 --> 00:00:03.000\nFirst sentence.\n\n00:00:02.500 --> 00:00:05.000\nFirst sentence. Second sentence.\n`;
    const segments = parseVtt(vtt);

    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe('First sentence. Second sentence.');
    expect(segments[0].endSec).toBe(5.0);
  });

  it('generates relative SRT subtitles for clip slice', () => {
    const segments = [
      { startSec: 10, endSec: 15, text: 'Segment A' },
      { startSec: 15, endSec: 20, text: 'Segment B' }
    ];
    const srt = generateSrtForClip(segments, 10, 20);

    expect(srt).toContain('00:00:00,000 --> 00:00:05,000');
    expect(srt).toContain('Segment A');
    expect(srt).toContain('00:00:05,000 --> 00:00:10,000');
    expect(srt).toContain('Segment B');
  });
});

describe('3. Audio Chunk Planning & Overlap Deduplication', () => {
  it('creates a single chunk for short audio <= 10 min', () => {
    const chunks = planAudioChunks(400, 600, 2.0);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].startSec).toBe(0);
    expect(chunks[0].endSec).toBe(400);
  });

  it('creates multiple chunks with overlap for long podcasts', () => {
    // 25 minutes = 1500 seconds
    const chunks = planAudioChunks(1500, 600, 2.0);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0].startSec).toBe(0);
    expect(chunks[0].endSec).toBe(600);
    // Second chunk starts at 600 - 2 = 598s
    expect(chunks[1].startSec).toBe(598);
  });

  it('deduplicates overlapping segments seamlessly', () => {
    const rawSegments = [
      { startSec: 0, endSec: 5, text: 'Hello everyone.' },
      { startSec: 4.8, endSec: 5, text: 'Hello everyone.' }, // duplicate overlap
      { startSec: 5, endSec: 10, text: 'Welcome to the podcast.' }
    ];
    const deduped = deduplicateOverlapSegments(rawSegments, 2.0);

    expect(deduped).toHaveLength(2);
    expect(deduped[0].text).toBe('Hello everyone.');
    expect(deduped[1].text).toBe('Welcome to the podcast.');
  });
});

describe('4. Heuristic Pre-Ranking & Scoring', () => {
  it('computes composite score from 4 sub-scores clamped between 0 and 25', () => {
    const score = calculateTotalScore({
      hook: 24,
      standaloneClarity: 22,
      emotionPayoff: 20,
      retentionLoop: 25
    });

    expect(score.total).toBe(91);
    expect(score.hook).toBe(24);
    expect(score.standaloneClarity).toBe(22);
    expect(score.emotionPayoff).toBe(20);
    expect(score.retentionLoop).toBe(25);
  });

  it('clamps out-of-range sub-scores to [0, 25]', () => {
    const score = calculateTotalScore({
      hook: 50, // exceeds 25
      standaloneClarity: -10, // below 0
      emotionPayoff: 15,
      retentionLoop: 20
    });

    expect(score.hook).toBe(25);
    expect(score.standaloneClarity).toBe(0);
    expect(score.total).toBe(60);
  });

  it('penalizes sponsors and filler while rewarding hooks in heuristic score', () => {
    const goodHook = 'The truth is that discipline will change your life completely. Why do people struggle?';
    const sponsorFluff = 'Welcome back to the show, brought to you by our sponsor, use promo code PODCAST.';

    const scoreGood = scoreWindowHeuristic(goodHook, 30);
    const scoreBad = scoreWindowHeuristic(sponsorFluff, 30);

    expect(scoreGood).toBeGreaterThan(scoreBad);
    expect(scoreBad).toBe(0); // Penalized heavily
  });
});

describe('5. Sentence Boundary Snapping', () => {
  const segments = [
    { startSec: 0.0, endSec: 3.2, text: 'Welcome to the conversation.' },
    { startSec: 3.5, endSec: 8.0, text: 'Today we discuss discipline.' },
    { startSec: 8.5, endSec: 15.0, text: 'The secret is building daily habits.' },
    { startSec: 15.2, endSec: 22.0, text: 'Without habits, motivation fails.' },
    { startSec: 22.5, endSec: 35.0, text: 'And that is the real lesson.' }
  ];

  it('snaps approximate timestamps to natural sentence boundaries', () => {
    const snapped = snapToSentenceBoundaries(3.0, 21.0, segments, 15, 40);

    expect(snapped.startSec).toBe(3.5);
    expect(snapped.endSec).toBe(22.0);
    expect(snapped.durationSec).toBe(18.5);
  });

  it('strictly enforces min and max duration bounds', () => {
    const snapped = snapToSentenceBoundaries(0, 5, segments, 20, 40);
    expect(snapped.durationSec).toBeGreaterThanOrEqual(20);
    expect(snapped.durationSec).toBeLessThanOrEqual(40);
  });
});

describe('6. ASS Subtitle Generation', () => {
  it('generates valid ASS file with Inter font and accent highlights', () => {
    const segments = [
      { startSec: 0, endSec: 4, text: 'Discipline beats motivation every day.' }
    ];
    const ass = generateAssSubtitles(segments, 0, 4, { fontName: 'Inter' });

    expect(ass).toContain('[Script Info]');
    expect(ass).toContain('PlayResX: 1080');
    expect(ass).toContain('PlayResY: 1920');
    expect(ass).toContain('Style: Default,Inter,58');
    expect(ass).toContain(ASS_COLORS.ACCENT_AMBER); // #FFB020
    expect(ass).toContain('Dialogue:');
  });

  it('partitions segments into 3-6 word chunks', () => {
    const segments = [
      { startSec: 0, endSec: 6, text: 'One two three four five six seven eight nine ten.' }
    ];
    const chunks = buildWordChunks(segments, 0, 6, 4);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].words.length).toBeLessThanOrEqual(5);
  });
});

describe('7. FFmpeg Filter Graph & Render Args', () => {
  it('builds 9:16 vertical complex filter graph with blurred background and libass', () => {
    const filter = buildFfmpegFilterGraph({
      format: 'vertical',
      burnedCaptions: true,
      assFilePath: 'C:/temp/sub.ass',
      fontsDir: 'C:/temp/fonts'
    });

    expect(filter).toContain('scale=180:320:force_original_aspect_ratio=increase');
    expect(filter).toContain('boxblur=4:1');
    expect(filter).toContain('scale=1080:1920');
    expect(filter).toContain('overlay=(W-w)/2:(H-h)/2');
    expect(filter).toContain('ass=filename=');
  });

  it('builds accurate seeking ffmpeg execution args with libx264 veryfast crf 20', () => {
    const args = buildFfmpegRenderArgs({
      inputPath: 'input.mp4',
      startSec: 10,
      durationSec: 30,
      outputPath: 'output.mp4',
      filterGraph: 'dummy_filter'
    });

    expect(args).toContain('-ss');
    expect(args).toContain('10');
    expect(args).toContain('-t');
    expect(args).toContain('30');
    expect(args).toContain('-c:v');
    expect(args).toContain('libx264');
    expect(args).toContain('-preset');
    expect(args).toContain('veryfast');
    expect(args).toContain('-crf');
    expect(args).toContain('20');
    expect(args).toContain('-threads');
    expect(args).toContain('2');
    expect(args).toContain('-movflags');
    expect(args).toContain('+faststart');
  });

  it('safely handles empty clips array in batchDownloadSectionsWithYtdlp', async () => {
    const res = await batchDownloadSectionsWithYtdlp('https://youtube.com', [], 'outputDir');
    expect(res).toBeInstanceOf(Map);
    expect(res.size).toBe(0);
  });
});

describe('8. Hashtag Normalization and YouTube Limits', () => {
  it('normalizes hashtags and always includes #Shorts', () => {
    const tags = buildClipHashtags(['mindset', '#discipline', 'podcast']);
    const tagStrings = tags.map(t => t.tag);

    expect(tagStrings[0]).toBe('#Shorts');
    expect(tagStrings).toContain('#mindset');
    expect(tagStrings).toContain('#discipline');
    expect(tagStrings).toContain('#podcast');
  });

  it('enforces YouTube hard cap of 15 hashtags', () => {
    const manyTags = Array.from({ length: 25 }, (_, i) => `tag${i}`);
    const result = buildClipHashtags(manyTags);

    expect(result.length).toBeLessThanOrEqual(15);
  });
});

describe('9. URL Validation & Anti-Hallucination Guard', () => {
  it('validates YouTube URLs and Google Drive URLs', () => {
    expect(sourceUrlSchema.safeParse('https://www.youtube.com/watch?v=dQw4w9WgXcQ').success).toBe(true);
    expect(sourceUrlSchema.safeParse('https://youtu.be/dQw4w9WgXcQ').success).toBe(true);
    expect(sourceUrlSchema.safeParse('dQw4w9WgXcQ').success).toBe(true);
    expect(sourceUrlSchema.safeParse('https://drive.google.com/file/d/12345/view').success).toBe(true);

    // Invalid URLs
    expect(sourceUrlSchema.safeParse('https://vimeo.com/12345').success).toBe(false);
    expect(sourceUrlSchema.safeParse('https://evil-site.com').success).toBe(false);
  });

  it('verifies evidence quotes against real transcript text', () => {
    const transcript = 'The most important thing in life is daily discipline and consistency.';
    expect(verifyEvidenceQuote('daily discipline and consistency', transcript)).toBe(true);
    expect(verifyEvidenceQuote('this quote was never said', transcript)).toBe(false);
  });
});

describe('10. Custom Timestamp Ranges & Priority', () => {
  it('prioritizes creator pinned timestamps as Clip #1 with top priority score', async () => {
    const { findPodcastMoments } = await import('../src/services/analysis.js');
    const segments = [
      { startSec: 4740, endSec: 4760, text: 'This is the carbonara moment right here.' },
      { startSec: 4760, endSec: 4787, text: 'It tastes absolutely fantastic and crispy.' },
      { startSec: 5000, endSec: 5040, text: 'Another conversation later in the podcast.' }
    ];

    const clips = await findPodcastMoments(segments, {
      clipCount: 1,
      customRanges: [
        { start: '01:19:00', end: '01:19:47', label: 'S-Tier Carbonara' }
      ]
    });

    expect(clips).toHaveLength(1);
    expect(clips[0].id).toBe('clip-1');
    expect(clips[0].rank).toBe(1);
    expect(clips[0].isPinned).toBe(true);
    expect(clips[0].startSeconds).toBe(4740);
    expect(clips[0].endSeconds).toBe(4787);
    expect(clips[0].durationSeconds).toBe(47);
    expect(clips[0].title).toContain('S-Tier Carbonara');
    expect(clips[0].viralityScore).toBe(100);
  });
});


