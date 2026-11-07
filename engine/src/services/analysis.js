/**
 * Podcast Analysis & Viral Moments Extraction Engine
 * Uses sliding windows, heuristic pre-ranking, batch LLM evaluation (4 sub-scores of 0-25),
 * sentence boundary snapping, and evidence quote verification.
 * Zero synthetic or hallucinated clips.
 */

import { generateAndPreRankWindows } from '../lib/windows.js';
import { snapToSentenceBoundaries } from '../lib/snapping.js';
import { calculateTotalScore } from '../lib/scoring.js';
import { batchEvaluationResponseSchema, clipPackageSchema, verifyEvidenceQuote } from '../lib/validate.js';
import { routeLlmRequest } from './llmRouter.js';
import { buildClipHashtags } from './hashtags.js';
import { secondsToClock, parseClockToSeconds } from '../lib/timestamps.js';

/**
 * Returns min and max duration bounds based on preset
 * @param {'short'|'standard'|'long'} preset
 * @returns {{ minSec: number, maxSec: number }}
 */
export function getDurationBounds(preset = 'standard') {
  switch (preset) {
    case 'short':
      return { minSec: 20, maxSec: 40 };
    case 'long':
      return { minSec: 60, maxSec: 120 };
    case 'standard':
    default:
      return { minSec: 30, maxSec: 60 };
  }
}

/**
 * Builds batch evaluation prompt for candidate transcript windows
 */
export function buildBatchPrompt(windows, minSec, maxSec) {
  const formattedWindows = windows.map((w, idx) => {
    return `[WINDOW #${idx + 1} - ID: "${w.id}"]
Time: ${secondsToClock(w.startSec)} to ${secondsToClock(w.endSec)} (${Math.round(w.durationSec)}s)
TRANSCRIPT:
"${w.text}"`;
  }).join('\n\n');

  return `You are an elite YouTube Shorts & TikTok podcast editor (like OpusClip and Descript).
Analyze these candidate conversation windows from a podcast to find high-impact, standalone viral moments.
Language: English only.

TARGET DURATION: ${minSec} to ${maxSec} seconds (hard maximum 180 seconds).

CRITERIA (Provide 4 distinct sub-scores from 0 to 25 each, totaling 0-100):
1. hook (0-25): Grabs viewer in first 3 seconds (provocative question, shocking realization, pattern interrupt).
2. standaloneClarity (0-25): Makes complete sense on its own. Heavily penalize dangling references like "as I said earlier", "back to my point", etc.
3. emotionPayoff (0-25): Delivers an intellectual "aha!" realization, emotional vulnerability, or strong conviction.
4. retentionLoop (0-25): Ends on a punchy, conclusive beat that makes viewers want to replay or share.

PACKAGING REQUIREMENTS PER WINDOW:
- "title": High-CTR YouTube Studio title (under 70 chars, include 1 emoji and #Shorts).
- "onScreenTitle": Bold hook title rendered on top of the video (max 60 chars, 1-3 lines, 1-2 emoji at end, e.g. "He Donates $12,000 And They Go Crazy 💀💔" or "POV: When You Start Learning A New Language 😂").
- "description": Concise 2-sentence description summarizing the core insight.
- "hookText": 3-5 word on-screen text opener (under 35 chars).
- "hashtags": Array of 3 to 5 relevant tags (always include "#Shorts").
- "evidenceQuote": A verbatim 3 to 10 word quote from the transcript text.
- "suggestedStartSec" and "suggestedEndSec": Precise timestamps within that window.

RULES:
- Reject conversational fluff, mic checks, sponsor reads, or housekeeping.
- Every evaluation MUST include "evidenceQuote": a verbatim 3 to 10 word quote from the transcript text.
- Never invent speech not present in the transcript.

CANDIDATE WINDOWS:
${formattedWindows}

RETURN STRICT JSON ONLY:
{
  "evaluations": [
    {
      "windowId": "${windows[0]?.id || 'win-1'}",
      "hook": 23,
      "standaloneClarity": 24,
      "emotionPayoff": 22,
      "retentionLoop": 21,
      "title": "Beat LeBron In Basketball, Win $100,000 🏀 #Shorts",
      "onScreenTitle": "He Challenged LeBron for $100K 🏀😱",
      "description": "Here is what happened when we took on the challenge.\\n\\nWatch till the end for the full takeaway.",
      "hookText": "Can Anyone Beat LeBron?",
      "hashtags": ["#Shorts", "#Basketball", "#Challenge"],
      "reasoning": "Strong hook about basketball challenge followed by a concrete, memorable moment.",
      "evidenceQuote": "exact verbatim words from transcript",
      "suggestedStartSec": ${windows[0]?.startSec || 0},
      "suggestedEndSec": ${(windows[0]?.startSec || 0) + 40}
    }
  ]
}`;
}

/**
 * Deterministic, instant clip packaging derived strictly from transcript slice
 * Requires zero LLM calls, completely preventing rate-limit stalls.
 *
 * @param {Object} cand
 * @param {string} sliceText
 * @returns {Object}
 */
export function deriveClipPackage(cand, sliceText = '') {
  const quote = cand.evidenceQuote || '';
  const firstSentence = sliceText.split(/[.?!]\s+/)[0]?.trim() || '';

  let baseTitle = '';
  if (firstSentence && firstSentence.length >= 10 && firstSentence.length <= 60) {
    baseTitle = firstSentence.replace(/[^\w\s'-]/g, '');
  } else if (quote && quote.length >= 8 && quote.length <= 55) {
    baseTitle = quote.replace(/[^\w\s'-]/g, '');
  } else {
    baseTitle = sliceText.slice(0, 50).replace(/[^\w\s'-]/g, '').trim();
  }

  const cleanTitle = (baseTitle.charAt(0).toUpperCase() + baseTitle.slice(1)).slice(0, 58).trim();
  const title = `${cleanTitle || 'Powerful Podcast Moment'} 🧠 #Shorts`;
  const onScreenTitle = cleanTitle.length > 5 ? `${cleanTitle} 🔥` : 'Must Watch Moment 🔥';

  const description = quote
    ? `"${quote}"\n\nHighlight from the full episode. Subscribe for more high-impact shorts.`
    : `Key takeaway from this conversation.\n\nSubscribe for daily clips and discussions.`;

  const hookWords = cleanTitle.split(' ').slice(0, 4).join(' ');
  const hookText = hookWords || 'Watch This';

  return {
    title,
    onScreenTitle,
    description,
    hookText,
    hashtags: ['#Shorts', '#Podcast', '#Mindset', '#Viral'],
    evidenceQuote: quote || sliceText.slice(0, 30).trim()
  };
}

/**
 * Packages a selected clip with YouTube Studio title, description, and hashtags
 */
export async function packageClipMetadata(clip, transcriptSlice, onNotice) {
  const prompt = `You are a YouTube Shorts strategist. Package this podcast moment for YouTube Studio.
Language: English only.

TIME: ${secondsToClock(clip.startSec)} - ${secondsToClock(clip.endSec)} (${Math.round(clip.durationSec)}s)
TRANSCRIPT:
"${transcriptSlice}"

TASK:
1. title: High-CTR hook title (under 70 characters, hard maximum 100 characters, include 1 emoji and #Shorts).
2. onScreenTitle: Bold hook title rendered on top of the video (max 60 chars, 1-2 emoji at end).
3. description: Concise 2-3 sentence description summarizing the core insight, quoting the best line.
4. hookText: 3-5 word on-screen text overlay for the video opener (under 35 chars).
5. hashtags: Array of 3 to 5 trending tags relevant to the topic (always include "#Shorts").
6. evidenceQuote: Verbatim 3 to 8 word quote from the transcript.

RETURN STRICT JSON ONLY:
{
  "title": "The Brutal Truth About Discipline 🧠 #Shorts",
  "onScreenTitle": "The Brutal Truth About Discipline 🧠🔥",
  "description": "Why motivation is a trap and what actually builds unstoppable momentum.\\n\\nWatch till the end for the full takeaway.",
  "hookText": "The Truth About Discipline",
  "hashtags": ["#Shorts", "#Mindset", "#Podcast", "#Discipline"],
  "evidenceQuote": "verbatim quote from transcript"
}`;

  try {
    return await routeLlmRequest(prompt, { schema: clipPackageSchema, onNotice });
  } catch (err) {
    return deriveClipPackage(clip, transcriptSlice);
  }
}

/**
 * Analyzes transcript, finds viral moments, snaps boundaries, and packages top clips
 *
 * @param {Array<{startSec: number, endSec: number, text: string}>} segments
 * @param {Object} options
 * @param {number} [options.clipCount=10]
 * @param {'short'|'standard'|'long'} [options.durationPreset='standard']
 * @param {(notice: string|null) => void} [options.onNotice]
 * @param {(progress: { percent: number, message: string }) => void} [options.onProgress]
 * @returns {Promise<Array<Object>>}
 */
export async function findPodcastMoments(segments, options = {}) {
  const clipCount = parseInt(options.clipCount || 10, 10);
  const durationPreset = options.durationPreset || 'standard';
  const { minSec, maxSec } = getDurationBounds(durationPreset);
  const { onNotice, onProgress } = options;

  // 0. Extract & prioritize creator-specified custom timestamp ranges
  const customMoments = [];
  if (Array.isArray(options.customRanges) && options.customRanges.length > 0) {
    for (let i = 0; i < options.customRanges.length; i++) {
      const cr = options.customRanges[i];
      if (!cr) continue;
      const startSec = typeof cr.start === 'number' ? cr.start : parseClockToSeconds(String(cr.start));
      const endSec = typeof cr.end === 'number' ? cr.end : parseClockToSeconds(String(cr.end));
      if (endSec > startSec && (endSec - startSec) >= 5) {
        const durationSec = Math.round((endSec - startSec) * 10) / 10;
        const sliceSegs = (segments || []).filter(s => s.endSec > startSec && s.startSec < endSec);
        const sliceText = sliceSegs.map(s => s.text).join(' ').trim();
        const pkg = deriveClipPackage({ text: sliceText }, sliceText);
        if (cr.label && cr.label.trim()) {
          pkg.title = `${cr.label.trim()} #Shorts`;
          pkg.onScreenTitle = `${cr.label.trim()} 🔥`;
        }

        customMoments.push({
          id: `custom-${i + 1}`,
          isCustom: true,
          isPinned: true,
          startSec,
          endSec,
          durationSec,
          suggestedStartSec: startSec,
          suggestedEndSec: endSec,
          title: pkg.title,
          onScreenTitle: pkg.onScreenTitle,
          description: pkg.description,
          hookText: pkg.hookText,
          hashtags: pkg.hashtags,
          reasoning: `Creator preferred timestamp #${i + 1} (${secondsToClock(startSec)} - ${secondsToClock(endSec)}). Top priority.`,
          evidenceQuote: pkg.evidenceQuote || sliceText.slice(0, 40) || 'Creator pinned timestamp',
          scores: {
            hook: 25,
            standaloneClarity: 25,
            emotionPayoff: 25,
            retentionLoop: 25,
            total: 100
          },
          viralityScore: 100 - i
        });
      }
    }
  }

  const remainingCount = Math.max(0, clipCount - customMoments.length);
  const scoredCandidates = [];

  if (remainingCount > 0) {
    if (onProgress) onProgress({ percent: 10, message: 'Scanning transcript timeline with sliding windows...' });

    // 1. Sliding windows and heuristic pre-ranking
    const candidateWindows = generateAndPreRankWindows(segments, {
      windowDurationSec: Math.max(90, maxSec + 20),
      strideSec: 30,
      maxCandidates: Math.min(30, Math.max(12, Math.round(remainingCount * 2)))
    });

    if (candidateWindows.length === 0 && customMoments.length === 0) {
      throw new Error('No candidate moments found in the transcript.');
    }

    // 2. Batch score with LLM Router (batches of 4 windows for compact prompts)
    const batchSize = 4;
    const totalBatches = Math.ceil(candidateWindows.length / batchSize);

    for (let b = 0; b < candidateWindows.length; b += batchSize) {
      const chunk = candidateWindows.slice(b, b + batchSize);
      const batchNum = Math.floor(b / batchSize) + 1;

      if (onProgress) {
        onProgress({
          percent: 20 + Math.round((batchNum / Math.max(1, totalBatches)) * 40),
          message: `AI scoring candidate moments (Batch ${batchNum} of ${totalBatches})...`
        });
      }

      let evals = [];
      let isAiEvaluated = false;

      try {
        const prompt = buildBatchPrompt(chunk, minSec, maxSec);
        const evalData = await routeLlmRequest(prompt, { schema: batchEvaluationResponseSchema, onNotice });
        evals = evalData?.evaluations || [];
        isAiEvaluated = true;
      } catch (batchErr) {
        if (onNotice) {
          onNotice(`Batch ${batchNum} AI notice: ${batchErr.message}. Utilizing heuristic analysis for this segment...`);
        }
        evals = chunk.map(w => {
          const pkg = deriveClipPackage(w, w.text);
          const sub = Math.min(18, Math.max(12, Math.round((w.score || 60) / 5)));
          return {
            windowId: w.id,
            hook: sub,
            standaloneClarity: sub,
            emotionPayoff: sub,
            retentionLoop: sub,
            title: pkg.title,
            onScreenTitle: pkg.onScreenTitle,
            description: pkg.description,
            hookText: pkg.hookText,
            hashtags: pkg.hashtags,
            reasoning: 'Heuristic high-density speech segment with strong rhythm.',
            evidenceQuote: pkg.evidenceQuote || w.text.slice(0, 30),
            suggestedStartSec: w.startSec,
            suggestedEndSec: w.endSec
          };
        });
      }

      for (const win of chunk) {
        const match = evals.find(e => String(e.windowId) === String(win.id));
        if (!match) continue;

        if (!verifyEvidenceQuote(match.evidenceQuote, win.text)) {
          continue;
        }

        const scores = calculateTotalScore({
          hook: match.hook,
          standaloneClarity: match.standaloneClarity,
          emotionPayoff: match.emotionPayoff,
          retentionLoop: match.retentionLoop
        });

        scoredCandidates.push({
          ...win,
          isAiEvaluated,
          scores,
          viralityScore: isAiEvaluated ? scores.total : Math.round(scores.total * 0.8),
          reasoning: match.reasoning,
          evidenceQuote: match.evidenceQuote,
          title: match.title,
          onScreenTitle: match.onScreenTitle,
          description: match.description,
          hookText: match.hookText,
          hashtags: match.hashtags,
          suggestedStartSec: match.suggestedStartSec !== undefined ? Number(match.suggestedStartSec) : win.startSec,
          suggestedEndSec: match.suggestedEndSec !== undefined ? Number(match.suggestedEndSec) : win.endSec
        });
      }
    }
  }

  // 3. Sentence Boundary Snapping & Non-overlapping filter
  // Creator preferred custom moments always come first!
  const snappedClips = [...customMoments];

  if (remainingCount > 0) {
    if (scoredCandidates.length === 0 && customMoments.length === 0) {
      throw new Error('No candidate moments passed anti-hallucination verification.');
    }

    // Sort descending by virality score
    scoredCandidates.sort((a, b) => b.viralityScore - a.viralityScore);

    for (const cand of scoredCandidates) {
      const snapped = snapToSentenceBoundaries(
        cand.suggestedStartSec,
        cand.suggestedEndSec,
        segments,
        minSec,
        maxSec
      );

      // Ensure non-overlapping with custom moments and existing clips
      const overlaps = snappedClips.some(existing => 
        (snapped.startSec < existing.endSec && snapped.endSec > existing.startSec)
      );

      if (!overlaps) {
        snappedClips.push({
          ...cand,
          startSec: snapped.startSec,
          endSec: snapped.endSec,
          durationSec: snapped.durationSec
        });
      }

      if (snappedClips.length >= clipCount) break;
    }
  }

  // 4. Packaging: Titles, descriptions, hashtags
  const finalClips = [];
  const packageTotal = snappedClips.length;

  for (let i = 0; i < snappedClips.length; i++) {
    const cand = snappedClips[i];
    if (onProgress) {
      onProgress({
        percent: 60 + Math.round(((i + 1) / packageTotal) * 10),
        message: `Finalizing Shorts titles & metadata (${i + 1} of ${packageTotal})...`
      });
    }

    // Extract exact transcript slice
    const sliceSegs = segments.filter(s => s.endSec > cand.startSec && s.startSec < cand.endSec);
    const sliceText = sliceSegs.map(s => s.text).join(' ').trim();

    // Use metadata returned in the batch evaluation, or deterministic instant synthesis
    const pkg = (cand.title && cand.description)
      ? {
          title: cand.title,
          onScreenTitle: cand.onScreenTitle,
          description: cand.description,
          hookText: cand.hookText,
          hashtags: cand.hashtags || [],
          evidenceQuote: cand.evidenceQuote
        }
      : deriveClipPackage(cand, sliceText);

    const finalHashtags = buildClipHashtags(pkg.hashtags || []);

    finalClips.push({
      id: `clip-${i + 1}`,
      rank: i + 1,
      isPinned: Boolean(cand.isPinned),
      startSeconds: cand.startSec,
      endSeconds: cand.endSec,
      durationSeconds: cand.durationSec,
      startTime: secondsToClock(cand.startSec),
      endTime: secondsToClock(cand.endSec),
      title: pkg.title || 'Untitled Podcast Clip',
      onScreenTitle: pkg.onScreenTitle || cand.onScreenTitle || pkg.title,
      framing: 'fill',
      focusX: 0.5,
      format: 'title_video',
      description: pkg.description || '',
      hookText: pkg.hookText || '',
      hashtags: finalHashtags.map(h => h.tag),
      hashtagDetails: finalHashtags,
      reasoning: cand.reasoning,
      evidenceQuote: pkg.evidenceQuote || cand.evidenceQuote,
      scores: cand.scores,
      viralityScore: cand.viralityScore
    });
  }

  // Re-rank
  finalClips.sort((a, b) => b.viralityScore - a.viralityScore);
  finalClips.forEach((c, idx) => { c.rank = idx + 1; });

  return finalClips;
}
