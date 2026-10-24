/**
 * Podcast-to-Shorts LLM Prompt Engineering Module
 * Grounded strictly in the source transcript to extract high-retention viral moments.
 */

import { formatSecondsToTimestamp } from '../../../src/utils/youtube.js';

/**
 * Builds prompt for batch scoring candidate windows from podcast transcript
 * @param {Array<Object>} windowsBatch
 * @param {Object} options
 * @returns {string}
 */
export function buildBatchScoringPrompt(windowsBatch, options = {}) {
  const minSec = options.minClipSec || 20;
  const maxSec = options.maxClipSec || 58;
  const focus = options.focus || 'viral_hooks';

  const windowsFormatted = windowsBatch.map((win, idx) => {
    return `[CANDIDATE WINDOW #${idx + 1} - ID: "${win.id}"]
Time Range: ${formatSecondsToTimestamp(win.startSec)} to ${formatSecondsToTimestamp(win.endSec)} (${Math.round(win.durationSec)}s)
TRANSCRIPT:
"${win.text}"`;
  }).join('\n\n');

  return `You are a world-class YouTube Shorts & TikTok viral content strategist and podcast editor (like OpusClip, Klap, Descript).
Your goal is to extract the single most captivating, viral moments from this podcast transcript that will stop viewers from scrolling on YouTube Shorts.

TARGET CLIP LENGTH: ${minSec} to ${maxSec} seconds.
CLIP FOCUS: ${focus === 'mindset' ? 'Deep mindset shifts, psychology & life wisdom' : focus === 'funny' ? 'Humor, unexpected banter & funny moments' : focus === 'debate' ? 'Hot takes, controversy & provocative arguments' : 'Maximum virality, curiosity gaps & high retention hooks'}

EVALUATION CRITERIA (Provide 4 sub-scores from 0 to 25 each, totaling 0-100):
1. hook (0-25): Does the opening 3 seconds grab immediate attention (provocative question, bold realization, or pattern interrupt)?
2. standaloneClarity (0-25): Does this thought make complete, satisfying sense on its own without needing the full 2-hour podcast?
3. emotionPayoff (0-25): Does it deliver an "aha!" moment, emotional punch, intense value, or shock factor?
4. retentionLoop (0-25): Will viewers watch all the way to the end and share it on YouTube Shorts / TikTok?

CRITICAL ANTI-HALLUCINATION RULES:
- Ground every single score strictly in the actual spoken transcript words provided.
- Each evaluation MUST include an "evidenceQuote": an exact verbatim quote of 3 to 10 words from that candidate window.
- "suggestedStartSec" and "suggestedEndSec" MUST fall strictly within that window's startSec and endSec, spanning between ${minSec} and ${maxSec} seconds.

CANDIDATE WINDOWS:
${windowsFormatted}

RETURN STRICT JSON ONLY (no markdown outside JSON):
{
  "evaluations": [
    {
      "windowId": "${windowsBatch[0]?.id || 'win-1'}",
      "hook": 24,
      "standaloneClarity": 23,
      "emotionPayoff": 22,
      "retentionLoop": 23,
      "reasoning": "Opens with an unforgettable hook about daily dopamine followed by a powerful life insight.",
      "evidenceQuote": "exact verbatim words from transcript",
      "suggestedStartSec": ${windowsBatch[0]?.startSec || 0},
      "suggestedEndSec": ${(windowsBatch[0]?.startSec || 0) + 38}
    }
  ]
}`;
}

/**
 * Builds prompt for packaging a single refined clip with ready-to-upload YouTube Studio metadata
 * @param {Object} clip
 * @param {string} transcriptSlice
 * @param {Object} options
 * @returns {string}
 */
export function buildClipPackagingPrompt(clip, transcriptSlice, options = {}) {
  const minSec = Math.round(clip.durationSec || 35);

  return `You are an elite YouTube Shorts producer and copywriter.
Package this exact podcast clip with everything needed for the creator to copy and paste directly into YouTube Studio.

CLIP TIME RANGE: ${formatSecondsToTimestamp(clip.startSec)} to ${formatSecondsToTimestamp(clip.endSec)} (${minSec}s)
EXACT TRANSCRIPT SLICE:
"${transcriptSlice}"

TASK:
Generate a complete, high-CTR YouTube Shorts metadata package:
1. hookText: Punchy 3-5 word on-screen text overlay for the video hook (under 35 chars, e.g. "The Truth About Success 🧠").
2. title: High-CTR, curiosity-driven YouTube Shorts title under 60 characters with emojis and ending with #Shorts (e.g. "The 1 Habit That Changed Everything 🧠 #Shorts").
3. description: Engaging 2-sentence description summarizing the core lesson/hook, including quotation of the best line, and ending with hashtags.
4. trendingHashtags: Array of 6 to 8 trending, high-traffic hashtags relevant to the topic (always include "#shorts", "#podcast", plus 4-6 specific tags like "#mindset", "#success", etc.).
5. pinnedComment: A high-engagement question to pin in the comments that forces viewers to reply and debate.
6. editingTip: Actionable editing instruction for CapCut/Premiere (e.g., "Add fast punch-in zoom at 0:02 on key realization, use bold yellow captions center-screen").
7. evidenceQuote: A verbatim 3 to 8 word quote from the transcript slice confirming authenticity.

RETURN STRICT JSON ONLY:
{
  "hookText": "On-screen hook under 35 chars",
  "title": "Viral Hook Title Under 60 chars ⚡ #Shorts",
  "description": "Engaging description ready for YouTube Studio.\\n\\nWatch till the end for the full takeaway.",
  "trendingHashtags": ["#shorts", "#podcast", "#mindset", "#viral", "#motivation", "#lifeadvice"],
  "pinnedComment": "Do you agree with this? Let me know in the comments 👇",
  "editingTip": "Punch-in zoom 1.15x at 0:02 on speaker realization. Use center yellow captions.",
  "evidenceQuote": "exact quote from transcript"
}`;
}
