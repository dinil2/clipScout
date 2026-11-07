/**
 * Canvas Title Overlay Generator
 * Creates a transparent 1080x1920 PNG with auto-fitted bold white hook title
 * placed above the video box (centered around y=360).
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { CONFIG } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let fontsInitialized = false;
let fontStatus = {
  registered: false,
  fontName: 'Montserrat ExtraBold',
  fontFile: '',
  emojiFontFound: false,
  emojiFontName: ''
};

/**
 * Initializes and registers Montserrat ExtraBold and system emoji fonts
 */
export function initCanvasFonts() {
  if (fontsInitialized) return fontStatus;

  const fontPath = path.resolve(__dirname, '../../assets/fonts/Montserrat-ExtraBold.ttf');
  if (fs.existsSync(fontPath)) {
    try {
      GlobalFonts.registerFromPath(fontPath, 'Montserrat ExtraBold');
      fontStatus.registered = true;
      fontStatus.fontFile = fontPath;
    } catch (err) {
      console.warn('[titleOverlay] Failed to register Montserrat font:', err.message);
    }
  }

  // Detect system emoji font
  const emojiCandidates = [
    'C:\\Windows\\Fonts\\seguiemj.ttf', // Windows Segoe UI Emoji
    '/System/Library/Fonts/Apple Color Emoji.ttc', // macOS
    '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', // Linux
    '/usr/share/fonts/noto/NotoColorEmoji.ttf'
  ];

  for (const cand of emojiCandidates) {
    if (fs.existsSync(cand)) {
      try {
        const familyName = cand.includes('seguiemj') ? 'Segoe UI Emoji' : 'Noto Color Emoji';
        GlobalFonts.registerFromPath(cand, familyName);
        fontStatus.emojiFontFound = true;
        fontStatus.emojiFontName = familyName;
        break;
      } catch {}
    }
  }

  fontsInitialized = true;
  return fontStatus;
}

/**
 * Gets diagnostics status for fonts
 */
export function getFontDiagnostics() {
  initCanvasFonts();
  return fontStatus;
}

/**
 * Strips unsupported emojis if emoji rendering is unavailable
 * @param {string} text
 * @returns {string}
 */
export function stripEmojis(text) {
  if (!text) return '';
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
}

/**
 * Fits title text into 1 to 3 lines within maxWidth by reducing font size from 84px to 52px
 *
 * @param {string} text
 * @param {number} [maxWidth=920]
 * @param {number} [maxLines=3]
 * @returns {{ lines: string[], fontSize: number, totalHeight: number }}
 */
export function fitTitleText(text, maxWidth = 920, maxLines = 3) {
  initCanvasFonts();

  if (!text || typeof text !== 'string') {
    return { lines: [''], fontSize: 72, totalHeight: 80 };
  }

  const cleanText = text.trim();
  const words = cleanText.split(/\s+/).filter(Boolean);

  // Measure canvas
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext('2d');

  let bestFit = null;

  // Try font sizes from 84px down to 52px
  for (let size = 84; size >= 52; size -= 2) {
    ctx.font = `bold ${size}px "Montserrat ExtraBold", "${fontStatus.emojiFontName || 'Segoe UI Emoji'}", sans-serif`;

    const lines = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
      const metrics = ctx.measureText(testLine);

      if (metrics.width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = words[i];
        } else {
          // A single word exceeds maxWidth, must split
          lines.push(testLine);
          currentLine = '';
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    if (lines.length <= maxLines) {
      bestFit = {
        lines,
        fontSize: size,
        totalHeight: lines.length * size * 1.15
      };
      break;
    }
  }

  // If even at 52px it exceeds maxLines, clamp to maxLines
  if (!bestFit) {
    ctx.font = `bold 52px "Montserrat ExtraBold", "${fontStatus.emojiFontName || 'Segoe UI Emoji'}", sans-serif`;
    const lines = [];
    let currentLine = '';

    for (const w of words) {
      const testLine = currentLine ? `${currentLine} ${w}` : w;
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = w;
      }
      if (lines.length === maxLines - 1) break;
    }
    if (currentLine && lines.length < maxLines) {
      lines.push(currentLine);
    }

    bestFit = {
      lines: lines.slice(0, maxLines),
      fontSize: 52,
      totalHeight: Math.min(lines.length, maxLines) * 52 * 1.15
    };
  }

  return bestFit;
}

/**
 * Renders a full 1080x1920 transparent PNG with bold white hook title centered at y=360
 *
 * @param {string} title
 * @param {string} outputPath
 * @param {Object} [options]
 * @param {number} [options.targetCenterY=360]
 * @param {number} [options.maxWidth=920]
 * @returns {Promise<{ outputPath: string, lines: string[], fontSize: number }>}
 */
export async function renderTitleOverlayPng(title, outputPath, options = {}) {
  initCanvasFonts();

  const targetCenterY = options.targetCenterY || 360;
  const maxWidth = options.maxWidth || 920;

  // Let emoji fallback gracefully
  let renderText = title || '';
  if (!fontStatus.emojiFontFound) {
    // If no emoji font is installed on system, strip emoji so square boxes don't render
    renderText = stripEmojis(renderText);
  }

  const { lines, fontSize } = fitTitleText(renderText, maxWidth, 3);

  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext('2d');

  // Clear to full transparency
  ctx.clearRect(0, 0, 1080, 1920);

  // Text Styling
  const emojiFont = fontStatus.emojiFontName ? `, "${fontStatus.emojiFontName}"` : '';
  ctx.font = `bold ${fontSize}px "Montserrat ExtraBold"${emojiFont}, -apple-system, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Thin soft shadow for crisp legibility over any background
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;

  const lineHeight = fontSize * 1.15;
  const totalBlockHeight = (lines.length - 1) * lineHeight;
  const startY = targetCenterY - (totalBlockHeight / 2);

  for (let i = 0; i < lines.length; i++) {
    const y = startY + (i * lineHeight);
    ctx.fillText(lines[i], 540, y);
  }

  // Write PNG buffer to disk
  const buffer = canvas.toBuffer('image/png');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);

  return {
    outputPath,
    lines,
    fontSize
  };
}

