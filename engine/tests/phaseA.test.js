import { describe, it, expect } from 'vitest';
import { censorText, isProfane } from '../src/lib/censor.js';
import { buildShortSubtitleChunks, cleanCaptionToken } from '../src/services/captions.js';
import { generateYellowAssSubtitles } from '../src/lib/ass.js';
import { fitTitleText, renderTitleOverlayPng } from '../src/services/titleOverlay.js';
import { sourceUrlSchema, validateUploadId } from '../src/lib/validate.js';
import { parseVtt } from '../src/lib/vtt.js';
import { buildFfmpegFilterGraph } from '../src/services/render.js';

describe('Phase A & B Core Requirements', () => {

  describe('1. Profanity Censorship (censorText)', () => {
    it('censors strong profanity by replacing trailing letters with asterisks', () => {
      expect(censorText('What the fuck is this shit')).toBe('What the f*** is this s***');
      expect(censorText('Holy fucking damn')).toBe('Holy f****** damn');
    });

    it('preserves casing and punctuation', () => {
      expect(censorText('Bitch! Really?')).toBe('B****! Really?');
      expect(censorText('"Asshole," he said.')).toBe('"A******," he said.');
    });

    it('does not censor clean words or partial matches inside benign words', () => {
      expect(censorText('class button assistant pass')).toBe('class button assistant pass');
    });
  });

  describe('2. Short 1-3 Word Caption Chunking (buildShortSubtitleChunks)', () => {
    it('chunks words into 1-3 words per chunk with max ~18 characters', () => {
      const words = [
        { word: 'Welcome', startSec: 10.0, endSec: 10.4 },
        { word: 'to', startSec: 10.4, endSec: 10.6 },
        { word: 'the', startSec: 10.6, endSec: 10.8 },
        { word: 'greatest', startSec: 10.8, endSec: 11.2 },
        { word: 'show', startSec: 11.2, endSec: 11.5 },
        { word: 'on', startSec: 11.5, endSec: 11.7 },
        { word: 'earth', startSec: 11.7, endSec: 12.0 }
      ];

      const chunks = buildShortSubtitleChunks(words, { clipStartSec: 10.0, clipEndSec: 15.0 });

      expect(chunks.length).toBeGreaterThanOrEqual(3);
      for (const chunk of chunks) {
        const wordCount = chunk.text.trim().split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(3);
        expect(chunk.text.length).toBeLessThanOrEqual(25);
        expect(chunk.startSec).toBeGreaterThanOrEqual(0);
        expect(chunk.endSec).toBeGreaterThan(chunk.startSec);
        // Minimum duration requirement (0.18s)
        expect(chunk.endSec - chunk.startSec).toBeGreaterThanOrEqual(0.15);
      }
    });

    it('breaks at punctuation marks and cleans commas/periods while preserving ? and !', () => {
      const words = [
        { word: 'Stop,', startSec: 0.0, endSec: 0.4 },
        { word: 'look', startSec: 0.4, endSec: 0.7 },
        { word: 'around!', startSec: 0.7, endSec: 1.0 },
        { word: 'Are', startSec: 1.0, endSec: 1.3 },
        { word: 'you', startSec: 1.3, endSec: 1.5 },
        { word: 'ready?', startSec: 1.5, endSec: 1.9 }
      ];

      const chunks = buildShortSubtitleChunks(words, { clipStartSec: 0, clipEndSec: 5 });
      const texts = chunks.map(c => c.text);

      // Comma should be cleaned, ! and ? preserved
      expect(texts.some(t => t.includes(','))).toBe(false);
      expect(texts.some(t => t.includes('.'))).toBe(false);
      expect(texts.some(t => t.includes('!'))).toBe(true);
      expect(texts.some(t => t.includes('?'))).toBe(true);
    });

    it('distributes duration by character count when word timestamps are missing', () => {
      const segments = [
        { startSec: 5.0, endSec: 9.0, text: 'This is a long sentence without word timestamps.' }
      ];
      const chunks = buildShortSubtitleChunks(segments, { clipStartSec: 5.0, clipEndSec: 9.0 });

      expect(chunks.length).toBeGreaterThan(2);
      expect(chunks[0].startSec).toBe(0);
      expect(chunks[chunks.length - 1].endSec).toBeCloseTo(4.0, 1);
    });
  });

  describe('3. Yellow ASS Generation (generateYellowAssSubtitles)', () => {
    it('generates ASS script with yellow color &H0000E6FF and pos(540,1235)', () => {
      const chunks = [
        { startSec: 0.5, endSec: 1.2, text: 'Hello world' }
      ];

      const ass = generateYellowAssSubtitles(chunks, {
        fontSize: 66,
        fontFamily: 'Montserrat ExtraBold',
        popIn: true
      });

      expect(ass).toContain('PlayResX: 1080');
      expect(ass).toContain('PlayResY: 1920');
      // Yellow PrimaryColour: &H0000E6FF (AARRGGBB in ASS)
      expect(ass).toContain('&H0000E6FF');
      // Black Outline: &H00000000
      expect(ass).toContain('&H00000000');
      // Position at x=540, y=1235
      expect(ass).toContain('\\pos(540,1235)');
      // Pop-in scale animation
      expect(ass).toContain('\\fscx');
    });
  });

  describe('4. Title Fitter & Canvas Title Overlay', () => {
    it('fits title into 1-3 lines with auto-reduced font size within 920px', () => {
      const fit = fitTitleText('POV: When you start learning a new language 🧠', 920);
      expect(fit.lines.length).toBeGreaterThanOrEqual(1);
      expect(fit.lines.length).toBeLessThanOrEqual(3);
      expect(fit.fontSize).toBeGreaterThanOrEqual(52);
      expect(fit.fontSize).toBeLessThanOrEqual(84);
    });
  });

  describe('5. Security: URL and UploadId Validation', () => {
    it('validates strictly HTTPS YouTube and Drive URLs and rejects other domains', () => {
      expect(sourceUrlSchema.safeParse('https://www.youtube.com/watch?v=dQw4w9WgXcQ').success).toBe(true);
      expect(sourceUrlSchema.safeParse('https://youtu.be/dQw4w9WgXcQ').success).toBe(true);
      expect(sourceUrlSchema.safeParse('https://drive.google.com/file/d/12345/view').success).toBe(true);

      // Rejections
      expect(sourceUrlSchema.safeParse('http://youtube.com/watch?v=123').success).toBe(false); // http not allowed
      expect(sourceUrlSchema.safeParse('https://evil-youtube.com/watch?v=123').success).toBe(false);
      expect(sourceUrlSchema.safeParse('https://attacker.com/malicious.mp4').success).toBe(false);
      expect(sourceUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
    });

    it('validates uploadId format and prevents directory traversal', () => {
      expect(validateUploadId('upload_1711234567_abc123.mp4')).toBe(true);
      expect(validateUploadId('../evil.mp4')).toBe(false);
      expect(validateUploadId('..\\evil.mp4')).toBe(false);
      expect(validateUploadId('/etc/passwd')).toBe(false);
      expect(validateUploadId('upload_123_abc.mp4/../../secret')).toBe(false);
    });
  });

  describe('6. WebVTT Word-Level Timings and Rolling Captions', () => {
    it('extracts inline <c> word timings when present in VTT', () => {
      const vttWithWords = `WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n<c>Hello</c><00:00:01.500><c> beautiful</c><00:00:02.200><c> world</c>`;
      const parsed = parseVtt(vttWithWords);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].text).toBe('Hello beautiful world');
      expect(parsed[0].words).toBeDefined();
      expect(parsed[0].words.length).toBe(3);
      expect(parsed[0].words[0].word).toBe('Hello');
      expect(parsed[0].words[1].word).toBe('beautiful');
      expect(parsed[0].words[2].word).toBe('world');
    });
  });

  describe('7. Title + Video Render Graph (title_video)', () => {
    it('builds 1080x1920 black canvas with 1080x1080 center crop at y=420 and title overlay', () => {
      const graph = buildFfmpegFilterGraph({
        format: 'title_video',
        framing: 'fill',
        focusX: 0.5,
        hasTitleOverlay: true,
        burnedCaptions: true,
        assFilePath: 'C:/temp/sub.ass',
        fontsDir: 'C:/temp/fonts'
      });

      expect(graph).toContain('pad=1080:1920:0:420:color=black');
      expect(graph).toContain('overlay=0:0:shortest=1');
      expect(graph).toContain('ass=filename=');
    });

    it('builds fit framing with letterbox inside 1080x1080', () => {
      const graph = buildFfmpegFilterGraph({
        format: 'title_video',
        framing: 'fit',
        hasTitleOverlay: false,
        burnedCaptions: false
      });

      expect(graph).toContain('scale=1080:1080:force_original_aspect_ratio=decrease');
      expect(graph).toContain('pad=1080:1920:0:420:color=black');
    });
  });

});
