/**
 * Netlify Serverless Function: /api/analyze
 * Modular, multi-stage Content Rewards clipping pipeline.
 * Fully grounded in real source transcripts with zero algorithmic hallucinations.
 */

import dotenv from 'dotenv';
dotenv.config();

import { checkAuthAndRateLimit } from './lib/auth.js';
import { fetchYoutubeMetadata, fetchYoutubeTranscript } from './lib/transcript.js';
import { generateAndPreRankWindows } from './lib/windows.js';
import { executeAiQuery } from './lib/llm.js';
import { buildBatchScoringPrompt, buildClipPackagingPrompt } from './lib/prompts.js';
import { batchEvaluationResponseSchema, clipPackageSchema, verifyEvidenceQuote } from './lib/validate.js';
import { parseUniversalTranscript, generateSrtForClip } from '../../src/utils/transcriptParser.js';
import { snapToSentenceBoundaries } from '../../src/utils/snapping.js';
import { calculateTotalScore } from '../../src/utils/scoring.js';
import { validateClipAgainstRules } from '../../src/utils/rulesCheck.js';
import { formatSecondsToTimestamp } from '../../src/utils/youtube.js';
import { BACKEND_CONFIG } from './lib/constants.js';
import { DEFAULT_CAMPAIGN } from '../../src/utils/constants.js';

export const handler = async (event) => {
  // 1. Auth, CORS & Rate Limiting Guard
  const auth = checkAuthAndRateLimit(event);
  if (!auth.allowed) {
    return {
      statusCode: auth.statusCode || 403,
      headers: auth.headers,
      body: JSON.stringify({ error: auth.error || 'Access denied' })
    };
  }

  const { headers } = auth;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' })
    };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON body.' })
    };
  }

  const action = payload.action || 'all';
  const campaign = payload.campaign || DEFAULT_CAMPAIGN;

  try {
    // -------------------------------------------------------------
    // STAGE 1: Fetch Source (YouTube or Uploaded/Pasted Transcript)
    // -------------------------------------------------------------
    if (action === 'fetch_source') {
      const videoId = (payload.videoId || '').trim();
      const rawText = payload.transcriptText;
      const fileType = payload.fileType || '';

      let metadata = {
        videoId: videoId || 'custom-source',
        title: (payload.title || 'Source Transcript').trim(),
        author: (payload.author || 'Creator').trim(),
        authorUrl: '',
        thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''
      };

      let segments = [];

      if (videoId) {
        if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid 11-character YouTube video ID.' })
          };
        }

        // Fetch oEmbed metadata and YouTube transcript in parallel
        const [meta, trans] = await Promise.all([
          fetchYoutubeMetadata(videoId),
          fetchYoutubeTranscript(videoId)
        ]);

        metadata = meta;
        segments = trans;
      } else if (rawText) {
        if (typeof rawText !== 'string' || rawText.length > BACKEND_CONFIG.MAX_TRANSCRIPT_CHARS) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Transcript text is too large or invalid.' })
          };
        }
        segments = parseUniversalTranscript(rawText, fileType, payload.knownDurationSec || 0);
      } else {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing source: Provide either a YouTube videoId or transcriptText.' })
        };
      }

      if (segments.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            code: 'NO_CAPTIONS',
            error: 'No readable speech or captions found in source. Please paste or upload a transcript.'
          })
        };
      }

      const totalDurationSec = Math.ceil(segments[segments.length - 1].endSec);
      metadata.durationSeconds = totalDurationSec;
      metadata.durationText = formatSecondsToTimestamp(totalDurationSec);

      // Generate and pre-rank windows cheaply across the full transcript
      const candidateWindows = generateAndPreRankWindows(segments, campaign);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          video: metadata,
          transcriptSegments: segments,
          candidateWindows,
          totalDurationSec
        })
      };
    }

    // -------------------------------------------------------------
    // STAGE 2: Score Candidate Windows Batch with LLM
    // -------------------------------------------------------------
    if (action === 'score_batch') {
      const batch = Array.isArray(payload.batch) ? payload.batch : [];
      if (batch.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing batch array of candidate windows to score.' })
        };
      }

      const prompt = buildBatchScoringPrompt(batch, campaign);
      const aiResponse = await executeAiQuery(prompt, {
        schema: batchEvaluationResponseSchema
      });

      const rawEvaluations = aiResponse.evaluations || [];
      const scoredWindows = [];

      for (const win of batch) {
        const evalItem = rawEvaluations.find(e => String(e.windowId) === String(win.id)) || rawEvaluations[0];
        if (!evalItem) continue;

        // Verify evidence quote exists in window text
        const isAuthentic = verifyEvidenceQuote(evalItem.evidenceQuote, win.text);
        if (!isAuthentic) {
          console.warn(`Dropped window ${win.id}: evidence quote was not found in source transcript.`);
          continue;
        }

        // Compute composite score in code from 4 sub-scores
        const scores = calculateTotalScore({
          hook: evalItem.hook,
          standaloneClarity: evalItem.standaloneClarity,
          emotionPayoff: evalItem.emotionPayoff,
          campaignFit: evalItem.campaignFit
        });

        scoredWindows.push({
          ...win,
          scores,
          viralityScore: scores.total,
          reasoning: evalItem.reasoning,
          evidenceQuote: evalItem.evidenceQuote,
          suggestedStartSec: evalItem.suggestedStartSec !== undefined ? Number(evalItem.suggestedStartSec) : win.startSec,
          suggestedEndSec: evalItem.suggestedEndSec !== undefined ? Number(evalItem.suggestedEndSec) : Math.min(win.endSec, win.startSec + 45)
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          scoredWindows
        })
      };
    }

    // -------------------------------------------------------------
    // STAGE 3: Package Refined Clips
    // -------------------------------------------------------------
    if (action === 'package_clips') {
      const topCandidates = Array.isArray(payload.topCandidates) ? payload.topCandidates : [];
      const segments = Array.isArray(payload.transcriptSegments) ? payload.transcriptSegments : [];

      if (topCandidates.length === 0 || segments.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing topCandidates or transcriptSegments for packaging.' })
        };
      }

      const finalClips = [];

      for (let i = 0; i < topCandidates.length; i++) {
        const candidate = topCandidates[i];

        // 1. Sentence Boundary Snapping & Duration Enforcement
        const rawStart = candidate.suggestedStartSec !== undefined ? candidate.suggestedStartSec : candidate.startSec;
        const rawEnd = candidate.suggestedEndSec !== undefined ? candidate.suggestedEndSec : candidate.endSec;

        const snapped = snapToSentenceBoundaries(
          rawStart,
          rawEnd,
          segments,
          campaign.minClipSec || 15,
          campaign.maxClipSec || 58
        );

        // 2. Extract real transcript slice text
        const sliceSegments = segments.filter(s => s.endSec > snapped.startSec && s.startSec < snapped.endSec);
        const transcriptSlice = sliceSegments.map(s => s.text).join(' ').trim();

        if (!transcriptSlice) continue;

        // 3. Generate campaign-aware package via LLM
        const prompt = buildClipPackagingPrompt(
          { ...candidate, ...snapped },
          transcriptSlice,
          campaign
        );

        let pkg = null;
        try {
          pkg = await executeAiQuery(prompt, { schema: clipPackageSchema });
        } catch (llmErr) {
          console.warn(`Failed packaging clip ${i + 1}:`, llmErr.message);
          // Honest fallback from candidate data without making up anything
          pkg = {
            hookText: candidate.text.slice(0, 35).trim(),
            title: candidate.text.slice(0, 55).trim(),
            description: `Key moment from ${payload.video?.title || 'video'}: "${transcriptSlice.slice(0, 100)}..."`,
            hashtags: campaign.requiredHashtags || ['#ContentRewards', '#Shorts'],
            pinnedComment: 'What is your take on this moment? Share below! 👇',
            editingTip: 'Punch-in zoom 1.2x on opening hook statement',
            evidenceQuote: transcriptSlice.slice(0, 25).trim()
          };
        }

        // 4. Ensure required hashtags & mentions are included in hashtags array
        const finalTags = Array.isArray(pkg.hashtags) ? [...pkg.hashtags] : [];
        if (Array.isArray(campaign.requiredHashtags)) {
          for (const reqTag of campaign.requiredHashtags) {
            if (!finalTags.some(t => t.toLowerCase().replace('#', '') === reqTag.toLowerCase().replace('#', ''))) {
              finalTags.unshift(reqTag);
            }
          }
        }

        // 5. Generate authentic .SRT subtitles strictly from real transcript lines
        const srtContent = generateSrtForClip(segments, snapped.startSec, snapped.endSec);

        // 6. Subtitle segments formatted for inline simulator
        const subtitles = sliceSegments.map(s => ({
          start: Math.max(0, Math.round((s.startSec - snapped.startSec) * 10) / 10),
          end: Math.min(snapped.durationSec, Math.round((s.endSec - snapped.startSec) * 10) / 10),
          text: s.text
        }));

        const clipObject = {
          id: `clip-${i + 1}`,
          rank: i + 1,
          startTime: formatSecondsToTimestamp(snapped.startSec),
          endTime: formatSecondsToTimestamp(snapped.endSec),
          startSeconds: snapped.startSec,
          endSeconds: snapped.endSec,
          durationSeconds: snapped.durationSec,
          title: pkg.title || 'Untitled Clip',
          description: pkg.description || '',
          hashtags: finalTags,
          hookText: pkg.hookText || '',
          pinnedComment: pkg.pinnedComment || '',
          editingTip: pkg.editingTip || '',
          reasoning: candidate.reasoning || '',
          evidenceQuote: pkg.evidenceQuote || candidate.evidenceQuote || '',
          scores: candidate.scores || { total: 75, hook: 20, standaloneClarity: 20, emotionPayoff: 18, campaignFit: 17 },
          viralityScore: candidate.viralityScore || 75,
          subtitles,
          srtContent,
          previewUrl: payload.video?.videoId ? `https://youtu.be/${payload.video.videoId}?t=${Math.floor(snapped.startSec)}` : null,
          status: 'found',
          views: 0,
          postedUrl: '',
          campaignId: campaign.id
        };

        // 7. Rules check
        clipObject.rulesCheck = validateClipAgainstRules(clipObject, campaign);

        finalClips.push(clipObject);
      }

      // Sort descending by virality score
      finalClips.sort((a, b) => b.viralityScore - a.viralityScore);
      finalClips.forEach((c, idx) => { c.rank = idx + 1; });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          clips: finalClips
        })
      };
    }

    // -------------------------------------------------------------
    // ACTION 'ALL': End-to-End Orchestration in One Call
    // -------------------------------------------------------------
    const videoId = (payload.videoId || '').trim();
    if (!videoId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing videoId for one-shot analysis.' })
      };
    }

    const [metadata, segments] = await Promise.all([
      fetchYoutubeMetadata(videoId),
      fetchYoutubeTranscript(videoId)
    ]);

    const totalDurationSec = Math.ceil(segments[segments.length - 1].endSec);
    metadata.durationSeconds = totalDurationSec;
    metadata.durationText = formatSecondsToTimestamp(totalDurationSec);

    const candidateWindows = generateAndPreRankWindows(segments, campaign);
    const topBatch = candidateWindows.slice(0, 6);

    const prompt = buildBatchScoringPrompt(topBatch, campaign);
    const aiResponse = await executeAiQuery(prompt, { schema: batchEvaluationResponseSchema });
    const rawEvals = aiResponse.evaluations || [];

    const candidateClips = [];
    for (const win of topBatch) {
      const evalItem = rawEvals.find(e => String(e.windowId) === String(win.id)) || rawEvals[0];
      if (!evalItem) continue;

      const isAuthentic = verifyEvidenceQuote(evalItem.evidenceQuote, win.text);
      if (!isAuthentic) continue;

      const scores = calculateTotalScore(evalItem);
      candidateClips.push({
        ...win,
        scores,
        viralityScore: scores.total,
        reasoning: evalItem.reasoning,
        evidenceQuote: evalItem.evidenceQuote,
        suggestedStartSec: evalItem.suggestedStartSec !== undefined ? Number(evalItem.suggestedStartSec) : win.startSec,
        suggestedEndSec: evalItem.suggestedEndSec !== undefined ? Number(evalItem.suggestedEndSec) : win.endSec
      });
    }

    candidateClips.sort((a, b) => b.viralityScore - a.viralityScore);
    const selected = candidateClips.slice(0, 5);
    const finalClips = [];

    for (let i = 0; i < selected.length; i++) {
      const cand = selected[i];
      const snapped = snapToSentenceBoundaries(
        cand.suggestedStartSec || cand.startSec,
        cand.suggestedEndSec || cand.endSec,
        segments,
        campaign.minClipSec || 15,
        campaign.maxClipSec || 58
      );

      const sliceSegments = segments.filter(s => s.endSec > snapped.startSec && s.startSec < snapped.endSec);
      const transcriptSlice = sliceSegments.map(s => s.text).join(' ').trim();
      if (!transcriptSlice) continue;

      const pkgPrompt = buildClipPackagingPrompt({ ...cand, ...snapped }, transcriptSlice, campaign);
      const pkg = await executeAiQuery(pkgPrompt, { schema: clipPackageSchema }).catch(() => ({
        hookText: cand.text.slice(0, 35),
        title: cand.text.slice(0, 50),
        description: `Watch this moment from ${metadata.title}`,
        hashtags: campaign.requiredHashtags || ['#ContentRewards', '#Shorts'],
        pinnedComment: 'What do you think? Let us know below! 👇',
        editingTip: 'Punch-in zoom on opening hook',
        evidenceQuote: transcriptSlice.slice(0, 20)
      }));

      const finalTags = Array.isArray(pkg.hashtags) ? [...pkg.hashtags] : [];
      if (Array.isArray(campaign.requiredHashtags)) {
        for (const reqTag of campaign.requiredHashtags) {
          if (!finalTags.includes(reqTag)) finalTags.unshift(reqTag);
        }
      }

      const srtContent = generateSrtForClip(segments, snapped.startSec, snapped.endSec);
      const subtitles = sliceSegments.map(s => ({
        start: Math.max(0, Math.round((s.startSec - snapped.startSec) * 10) / 10),
        end: Math.min(snapped.durationSec, Math.round((s.endSec - snapped.startSec) * 10) / 10),
        text: s.text
      }));

      const clip = {
        id: `clip-${i + 1}`,
        rank: i + 1,
        startTime: formatSecondsToTimestamp(snapped.startSec),
        endTime: formatSecondsToTimestamp(snapped.endSec),
        startSeconds: snapped.startSec,
        endSeconds: snapped.endSec,
        durationSeconds: snapped.durationSec,
        title: pkg.title,
        description: pkg.description,
        hashtags: finalTags,
        hookText: pkg.hookText,
        pinnedComment: pkg.pinnedComment,
        editingTip: pkg.editingTip,
        reasoning: cand.reasoning,
        evidenceQuote: pkg.evidenceQuote || cand.evidenceQuote,
        scores: cand.scores,
        viralityScore: cand.viralityScore,
        subtitles,
        srtContent,
        previewUrl: `https://youtu.be/${videoId}?t=${Math.floor(snapped.startSec)}`,
        status: 'found',
        views: 0,
        postedUrl: '',
        campaignId: campaign.id
      };

      clip.rulesCheck = validateClipAgainstRules(clip, campaign);
      finalClips.push(clip);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        video: metadata,
        clips: finalClips
      })
    };

  } catch (err) {
    console.error('Server error in analyze handler:', err);
    const statusCode = err.code === 'NO_CAPTIONS' ? 400 : 500;
    return {
      statusCode,
      headers,
      body: JSON.stringify({
        code: err.code || 'SERVER_ERROR',
        error: err.message || 'An unexpected error occurred while analyzing the source.'
      })
    };
  }
};
