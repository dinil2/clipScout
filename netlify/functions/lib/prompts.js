/**
 * Campaign-Driven LLM Prompt Engineering Module
 * Grounded strictly in the source transcript and active campaign brief.
 */

import { formatSecondsToTimestamp } from '../../../src/utils/youtube.js';

/**
 * Builds prompt for batch scoring candidate windows
 * @param {Array<Object>} windowsBatch
 * @param {Object} campaign
 * @returns {string}
 */
export function buildBatchScoringPrompt(windowsBatch, campaign = {}) {
  const campaignContext = `CAMPAIGN BRIEF:
- Campaign Name: ${campaign.name || 'Content Rewards Standard'}
- Target Clip Length: ${campaign.minClipSec || 15} to ${campaign.maxClipSec || 58} seconds
- Allowed Platforms: ${(campaign.allowedPlatforms || ['YouTube Shorts', 'TikTok']).join(', ')}
- Required Hashtags: ${(campaign.requiredHashtags || []).join(' ')}
- Required Mentions: ${(campaign.requiredMentions || []).join(' ')}
- Banned Words (DO NOT USE): ${(campaign.bannedWords || []).join(', ')}
- Campaign Rules & Objectives: ${campaign.rules || 'Find viral, standalone insights or engaging moments.'}`;

  const windowsFormatted = windowsBatch.map((win, idx) => {
    return `[CANDIDATE WINDOW #${idx + 1} - ID: "${win.id}"]
Time Range: ${formatSecondsToTimestamp(win.startSec)} to ${formatSecondsToTimestamp(win.endSec)} (${Math.round(win.durationSec)}s)
TRANSCRIPT:
"${win.text}"`;
  }).join('\n\n');

  return `You are a professional video clipper and virality analyst for a creator Content Rewards campaign.

${campaignContext}

TASK:
Analyze the dialogue in each candidate window below. For each window, provide four sub-scores (each strictly an integer from 0 to 25):
1. hook (0-25): Does it have a captivating opening hook in the first 3 seconds?
2. standaloneClarity (0-25): Does it make complete sense on its own without requiring outside context?
3. emotionPayoff (0-25): Does it deliver an emotional peak, twist, humor, or tangible insight?
4. campaignFit (0-25): Does it align with the campaign brief and respect banned topic rules?

CRITICAL ANTI-HALLUCINATION RULES:
- Ground every evaluation strictly in the provided transcript words.
- Each item MUST include an "evidenceQuote": an exact verbatim quote of 3 to 10 words from that window's transcript.
- "suggestedStartSec" and "suggestedEndSec" MUST fall strictly within that window's startSec and endSec, and span ${campaign.minClipSec || 15} to ${campaign.maxClipSec || 58} seconds.

CANDIDATE WINDOWS:
${windowsFormatted}

RETURN STRICT JSON ONLY:
{
  "evaluations": [
    {
      "windowId": "${windowsBatch[0]?.id || 'win-1'}",
      "hook": 21,
      "standaloneClarity": 22,
      "emotionPayoff": 20,
      "campaignFit": 24,
      "reasoning": "Clear opening hook followed by a concrete takeaway on creator growth.",
      "evidenceQuote": "the exact words from transcript",
      "suggestedStartSec": ${windowsBatch[0]?.startSec || 0},
      "suggestedEndSec": ${(windowsBatch[0]?.startSec || 0) + 30}
    }
  ]
}`;
}

/**
 * Builds prompt for packaging a single refined clip with campaign-compliant metadata
 * @param {Object} clip
 * @param {string} transcriptSlice
 * @param {Object} campaign
 * @returns {string}
 */
export function buildClipPackagingPrompt(clip, transcriptSlice, campaign = {}) {
  const reqTags = (campaign.requiredHashtags || []).filter(Boolean);
  const reqMentions = (campaign.requiredMentions || []).filter(Boolean);

  return `You are an elite YouTube Shorts / TikTok editor.
Package this exact video clip for publication in accordance with the campaign brief.

CAMPAIGN BRIEF:
- Campaign: ${campaign.name || 'Content Rewards'}
- Required Hashtags (MUST include all): ${reqTags.join(' ')}
- Required Mentions (MUST include all): ${reqMentions.join(' ')}
- Banned Words (NEVER include): ${(campaign.bannedWords || []).join(', ')}
- Campaign Rules: ${campaign.rules || 'Focus on high retention and engagement.'}

CLIP TIME RANGE: ${formatSecondsToTimestamp(clip.startSec)} to ${formatSecondsToTimestamp(clip.endSec)} (${Math.round(clip.durationSec)}s)
EXACT TRANSCRIPT SLICE:
"${transcriptSlice}"

TASK:
Generate a publication-ready package:
1. hookText: Punchy 3-second on-screen text overlay for the video editor (under 40 chars).
2. title: Hook-driven title under 60 characters. Include ${reqMentions.join(' ')} if natural or append.
3. description: 1-2 sentence description summarizing the clip. Include ${reqMentions.join(' ')}.
4. hashtags: Array of hashtags including ${reqTags.join(', ')} plus 2-3 trending relevant tags.
5. pinnedComment: Engaging comment asking viewers a question to drive algorithm comments.
6. editingTip: Actionable editing instruction for CapCut/Premiere (zoom, sound effect, pace).
7. evidenceQuote: A verbatim 3-8 word quote from the transcript slice confirming authenticity.

RETURN STRICT JSON ONLY:
{
  "hookText": "Short text for video overlay",
  "title": "Title under 60 chars",
  "description": "Shorts description with ${reqMentions[0] || '@brand'}",
  "hashtags": [${reqTags.map(t => `"${t}"`).join(', ')}],
  "pinnedComment": "Question to spark discussion in comments?",
  "editingTip": "Punch-in zoom 1.2x at 0:02 on key phrase",
  "evidenceQuote": "exact quote from transcript"
}`;
}
