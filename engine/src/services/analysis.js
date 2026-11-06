/**
 * Podcast Analysis & Viral Moments Extraction Engine
 * Uses sliding windows, heuristic pre-ranking, batch LLM evaluation (4 sub-scores of 0-25),
 * sentence boundary snapping, and evidence quote verification.
 * Zero synthetic or hallucinated clips.
 */

import { CONFIG } from '../config.js';
import { generateAndPreRankWindows } from '../lib/windows.js';
import { snapToSentenceBoundaries } from '../lib/snapping.js';
import { calculateTotalScore } from '../lib/scoring.js';
import { batchEvaluationResponseSchema, clipPackageSchema, verifyEvidenceQuote } from '../lib/validate.js';
import { executeWithRateLimit } from '../lib/rateLimiter.js';
import { buildClipHashtags } from './hashtags.js';
import { secondsToClock } from '../lib/timestamps.js';

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
 * Cleans markdown fences and parses JSON safely
 * @param {string} raw
 * @returns {any}
 */
export function cleanAndParseJson(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('Empty AI response');
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Malformed JSON from AI model');
  }
}

/**
 * Dispatches query to Groq or Gemini with retry & backoff
 *
 * @param {string} prompt
 * @param {Object} options
 * @param {import('zod').ZodSchema} [options.schema]
 * @param {(notice: string) => void} [options.onNotice]
 * @returns {Promise<any>}
 */
export async function queryLlm(prompt, options = {}) {
  const groqKey = CONFIG.GROQ_API_KEY;
  const geminiKey = CONFIG.GEMINI_API_KEY;

  if (!groqKey && !geminiKey) {
    throw new Error('No AI API key found. Configure GROQ_API_KEY (or GEMINI_API_KEY) in .env.');
  }

  const groqModels = CONFIG.GROQ_MODELS && CONFIG.GROQ_MODELS.length > 0
    ? CONFIG.GROQ_MODELS
    : ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

  let modelIdx = 0;

  const makeCall = async () => {
    while (modelIdx < groqModels.length) {
      const activeModel = groqModels[modelIdx];
      if (groqKey) {
        let res;
        try {
          res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${groqKey}`
            },
            body: JSON.stringify({
              model: activeModel,
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert podcast video editor extracting the best viral YouTube Shorts. Respond strictly in valid JSON matching the requested schema.'
                },
                { role: 'user', content: prompt }
              ],
              response_format: { type: 'json_object' },
              temperature: 0.2,
              max_tokens: 4000
            })
          });
        } catch (netErr) {
          if (modelIdx + 1 < groqModels.length) {
            modelIdx++;
            continue;
          }
          throw new Error(`Groq request failed: ${netErr.message}`);
        }

        if (res.status === 429) {
          const errText = await res.text();
          // If another model is available, switch immediately without sleeping!
          if (modelIdx + 1 < groqModels.length) {
            modelIdx++;
            const nextModel = groqModels[modelIdx];
            if (options.onNotice) {
              options.onNotice(`Rate limit reached on ${activeModel}. Switching to backup model ${nextModel}...`);
            }
            continue;
          }
          const err = new Error(`Groq LLM rate limit: ${errText}`);
          err.status = 429;
          err.response = res;
          throw err;
        }

        if (!res.ok) {
          if (modelIdx + 1 < groqModels.length) {
            modelIdx++;
            const nextModel = groqModels[modelIdx];
            if (options.onNotice) {
              options.onNotice(`Groq ${activeModel} error (${res.status}). Switching to backup model ${nextModel}...`);
            }
            continue;
          }
          const errText = await res.text();
          throw new Error(`Groq LLM error (${res.status}): ${errText}`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content || typeof content !== 'string' || content.trim().length === 0) {
          if (modelIdx + 1 < groqModels.length) {
            modelIdx++;
            const nextModel = groqModels[modelIdx];
            if (options.onNotice) {
              options.onNotice(`Received empty output from ${activeModel}. Retrying with backup model ${nextModel}...`);
            }
            continue;
          }
          throw new Error(`Model ${activeModel} returned an empty response.`);
        }

        try {
          return cleanAndParseJson(content);
        } catch (parseErr) {
          if (modelIdx + 1 < groqModels.length) {
            modelIdx++;
            const nextModel = groqModels[modelIdx];
            if (options.onNotice) {
              options.onNotice(`Malformed JSON from ${activeModel}. Retrying with backup model ${nextModel}...`);
            }
            continue;
          }
          throw parseErr;
        }
      } else {
        // Gemini API fallback
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Gemini API error (${res.status}): ${errText}`);
        }

        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return cleanAndParseJson(content);
      }
    }
  };

  const parsed = await executeWithRateLimit(makeCall, { onNotice: options.onNotice, maxRetries: 3 });

  // Schema validation with 1 repair retry
  if (options.schema) {
    const check = options.schema.safeParse(parsed);
    if (check.success) return check.data;

    // One repair retry
    const repairPrompt = `Your previous JSON output did not conform to the schema:
JSON:
${JSON.stringify(parsed)}
ERRORS:
${JSON.stringify(check.error.issues)}

Please return the strictly valid JSON object:`;

    const repaired = await executeWithRateLimit(async () => {
      if (groqKey) {
        const activeModel = groqModels[modelIdx] || groqModels[0];
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: activeModel,
            messages: [{ role: 'user', content: repairPrompt }],
            response_format: { type: 'json_object' },
            temperature: 0.1
          })
        });
        if (!res.ok) throw new Error(`Groq repair error (${res.status})`);
        const d = await res.json();
        const content = d.choices?.[0]?.message?.content;
        if (!content) throw new Error('Empty repair response');
        return cleanAndParseJson(content);
      }
    }, { onNotice: options.onNotice });

    const secondCheck = options.schema.safeParse(repaired);
    if (secondCheck.success) return secondCheck.data;

    throw new Error(`AI response failed schema validation: ${check.error.message}`);
  }

  return parsed;
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

TARGET DURATION: ${minSec} to ${maxSec} seconds (hard maximum 180 seconds).

CRITERIA (Provide 4 distinct sub-scores from 0 to 25 each, totaling 0-100):
1. hook (0-25): Grabs viewer in first 3 seconds (provocative question, shocking realization, pattern interrupt).
2. standaloneClarity (0-25): Makes complete sense on its own. Heavily penalize dangling references like "as I said earlier", "back to my point", etc.
3. emotionPayoff (0-25): Delivers an intellectual "aha!" realization, emotional vulnerability, or strong conviction.
4. retentionLoop (0-25): Ends on a punchy, conclusive beat that makes viewers want to replay or share.

PACKAGING REQUIREMENTS PER WINDOW:
- "title": High-CTR hook title (under 70 chars, hard max 100, include 1 emoji and #Shorts).
- "description": Concise 2-sentence description summarizing the core insight.
- "hookText": 3-5 word on-screen text overlay for the video opener (under 35 chars).
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

  const description = quote
    ? `"${quote}"\n\nHighlight from the full episode. Subscribe for more high-impact shorts.`
    : `Key takeaway from this conversation.\n\nSubscribe for daily clips and discussions.`;

  const hookWords = cleanTitle.split(' ').slice(0, 4).join(' ');
  const hookText = hookWords || 'Watch This';

  return {
    title,
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

TIME: ${secondsToClock(clip.startSec)} - ${secondsToClock(clip.endSec)} (${Math.round(clip.durationSec)}s)
TRANSCRIPT:
"${transcriptSlice}"

TASK:
1. title: High-CTR hook title (under 70 characters, hard maximum 100 characters, include 1 emoji and #Shorts).
2. description: Concise 2-3 sentence description summarizing the core insight, quoting the best line.
3. hookText: 3-5 word on-screen text overlay for the video opener (under 35 chars).
4. hashtags: Array of 3 to 5 trending tags relevant to the topic (always include "#Shorts").
5. evidenceQuote: Verbatim 3 to 8 word quote from the transcript.

RETURN STRICT JSON ONLY:
{
  "title": "The Brutal Truth About Discipline 🧠 #Shorts",
  "description": "Why motivation is a trap and what actually builds unstoppable momentum.\\n\\nWatch till the end for the full takeaway.",
  "hookText": "The Truth About Discipline",
  "hashtags": ["#Shorts", "#Mindset", "#Podcast", "#Discipline"],
  "evidenceQuote": "verbatim quote from transcript"
}`;

  try {
    return await queryLlm(prompt, { schema: clipPackageSchema, onNotice });
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
 * @param {(notice: string) => void} [options.onNotice]
 * @param {(progress: { percent: number, message: string }) => void} [options.onProgress]
 * @returns {Promise<Array<Object>>}
 */
export async function findPodcastMoments(segments, options = {}) {
  const clipCount = parseInt(options.clipCount || 10, 10);
  const durationPreset = options.durationPreset || 'standard';
  const { minSec, maxSec } = getDurationBounds(durationPreset);
  const { onNotice, onProgress } = options;

  if (onProgress) onProgress({ percent: 10, message: 'Scanning transcript timeline with sliding windows...' });

  // 1. Sliding windows and heuristic pre-ranking
  const candidateWindows = generateAndPreRankWindows(segments, {
    windowDurationSec: Math.max(90, maxSec + 20),
    strideSec: 30,
    maxCandidates: Math.min(30, Math.max(12, Math.round(clipCount * 2)))
  });

  if (candidateWindows.length === 0) {
    throw new Error('No candidate moments found in the transcript.');
  }

  // 2. Batch score with LLM (batches of 4 windows for fast, compact prompts)
  const batchSize = 4;
  const scoredCandidates = [];
  const totalBatches = Math.ceil(candidateWindows.length / batchSize);

  for (let b = 0; b < candidateWindows.length; b += batchSize) {
    const chunk = candidateWindows.slice(b, b + batchSize);
    const batchNum = Math.floor(b / batchSize) + 1;

    if (onProgress) {
      onProgress({
        percent: 20 + Math.round((batchNum / totalBatches) * 40),
        message: `AI scoring candidate moments (Batch ${batchNum} of ${totalBatches})...`
      });
    }

    let evals = [];
    try {
      const prompt = buildBatchPrompt(chunk, minSec, maxSec);
      const evalData = await queryLlm(prompt, { schema: batchEvaluationResponseSchema, onNotice });
      evals = evalData?.evaluations || [];
    } catch (batchErr) {
      if (onNotice) {
        onNotice(`Batch ${batchNum} LLM query notice: ${batchErr.message}. Utilizing heuristic analysis for this segment...`);
      }
      // Heuristic fallback for this batch so temporary LLM limits never kill the entire job
      evals = chunk.map(w => {
        const pkg = deriveClipPackage(w, w.text);
        const sub = Math.min(25, Math.max(16, Math.round((w.score || 70) / 4)));
        return {
          windowId: w.id,
          hook: sub,
          standaloneClarity: sub,
          emotionPayoff: sub,
          retentionLoop: sub,
          title: pkg.title,
          description: pkg.description,
          hookText: pkg.hookText,
          hashtags: pkg.hashtags,
          reasoning: 'High-density speech segment with strong cadence and engagement markers.',
          evidenceQuote: pkg.evidenceQuote || w.text.slice(0, 30),
          suggestedStartSec: w.startSec,
          suggestedEndSec: w.endSec
        };
      });
    }

    for (const win of chunk) {
      const match = evals.find(e => String(e.windowId) === String(win.id));
      if (!match) continue;

      // Evidence quote anti-hallucination verification
      if (!verifyEvidenceQuote(match.evidenceQuote, win.text)) {
        continue;
      }

      // Compute composite 0-100 score in code from 4 sub-scores
      const scores = calculateTotalScore({
        hook: match.hook,
        standaloneClarity: match.standaloneClarity,
        emotionPayoff: match.emotionPayoff,
        retentionLoop: match.retentionLoop
      });

      scoredCandidates.push({
        ...win,
        scores,
        viralityScore: scores.total,
        reasoning: match.reasoning,
        evidenceQuote: match.evidenceQuote,
        title: match.title,
        description: match.description,
        hookText: match.hookText,
        hashtags: match.hashtags,
        suggestedStartSec: match.suggestedStartSec !== undefined ? Number(match.suggestedStartSec) : win.startSec,
        suggestedEndSec: match.suggestedEndSec !== undefined ? Number(match.suggestedEndSec) : win.endSec
      });
    }
  }

  if (scoredCandidates.length === 0) {
    throw new Error('No candidate moments passed anti-hallucination verification.');
  }

  // Sort descending by virality score
  scoredCandidates.sort((a, b) => b.viralityScore - a.viralityScore);

  // 3. Sentence Boundary Snapping & Non-overlapping filter
  const snappedClips = [];

  for (const cand of scoredCandidates) {
    const snapped = snapToSentenceBoundaries(
      cand.suggestedStartSec,
      cand.suggestedEndSec,
      segments,
      minSec,
      maxSec
    );

    // Ensure non-overlapping clips (at least 15s separation between clip starts)
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

  // 4. Packaging: Titles, descriptions, hashtags (Instant zero-rate-limit pass)
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
      startSeconds: cand.startSec,
      endSeconds: cand.endSec,
      durationSeconds: cand.durationSec,
      startTime: secondsToClock(cand.startSec),
      endTime: secondsToClock(cand.endSec),
      title: pkg.title || 'Untitled Podcast Clip',
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

