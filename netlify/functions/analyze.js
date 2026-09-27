import { YoutubeTranscript } from 'youtube-transcript';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

/**
 * Formats seconds into mm:ss or hh:mm:ss
 */
function formatSeconds(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Parses timestamp string (mm:ss or hh:mm:ss) into seconds
 */
function parseTimestamp(timestamp) {
  if (!timestamp || typeof timestamp !== 'string') return 0;
  const parts = timestamp.trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

/**
 * Condenses transcript to <= targetMaxWords (~2200 words / ~2900 tokens)
 * Samples evenly across 100% of the timeline so the end is never cut off.
 */
function condenseTranscript(items, targetMaxWords = 2200) {
  if (!items || items.length === 0) return '';

  // 1. Clean items
  const cleaned = [];
  for (const item of items) {
    const text = (item.text || '')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\[(Music|Applause|Laughter)\]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length > 0) {
      cleaned.push({
        offset: item.offset,
        duration: item.duration,
        text
      });
    }
  }

  if (cleaned.length === 0) return '';

  // 2. Group into 10-15s sentences
  const blocks = [];
  let current = {
    start: cleaned[0].offset,
    end: cleaned[0].offset + cleaned[0].duration,
    text: cleaned[0].text
  };

  for (let i = 1; i < cleaned.length; i++) {
    const it = cleaned[i];
    const dur = (it.offset + it.duration) - current.start;
    const words = current.text.split(/\s+/).length;

    if (dur <= 15 && words < 35) {
      current.text += ' ' + it.text;
      current.end = it.offset + it.duration;
    } else {
      blocks.push({ ...current });
      current = {
        start: it.offset,
        end: it.offset + it.duration,
        text: it.text
      };
    }
  }
  blocks.push(current);

  // 3. Count total words
  const totalWords = blocks.reduce((acc, b) => acc + b.text.split(/\s+/).length, 0);

  if (totalWords <= targetMaxWords) {
    return blocks.map(b => `[${formatSeconds(b.start)}] ${b.text}`).join('\n');
  }

  // 4. Sample evenly across 100% of the timeline without breaking early
  const avgWordsPerBlock = Math.max(1, totalWords / blocks.length);
  const maxSampledBlocks = Math.max(20, Math.floor(targetMaxWords / avgWordsPerBlock));
  const step = (blocks.length - 1) / Math.max(1, maxSampledBlocks - 1);
  const sampledIndices = new Set();

  for (let i = 0; i < maxSampledBlocks; i++) {
    const idx = Math.min(blocks.length - 1, Math.round(i * step));
    sampledIndices.add(idx);
  }

  const sortedIndices = Array.from(sampledIndices).sort((a, b) => a - b);
  return sortedIndices.map(idx => `[${formatSeconds(blocks[idx].start)}] ${blocks[idx].text}`).join('\n');
}

/**
 * Extracts stream duration, description, and chapters from YouTube watch page
 */
async function fetchStreamDetails(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (!res.ok) return { durationSec: 7200, description: '', chapters: [] };
    const html = await res.text();
    
    let durationSec = 7200;
    const durMatch = html.match(/"approxDurationMs":"(\d+)"/);
    if (durMatch) {
      durationSec = Math.floor(parseInt(durMatch[1]) / 1000);
    } else {
      const lenMatch = html.match(/"lengthSeconds":"(\d+)"/);
      if (lenMatch) {
        durationSec = parseInt(lenMatch[1]);
      }
    }

    // YouTube hard maximum video limit is 12 hours (43,200s); cap infinite 24/7 streams to 4 hours (14,400s)
    if (durationSec > 43200) {
      durationSec = 14400;
    }

    let description = '';
    const descMatch = html.match(/"shortDescription":"(.*?)"/s);
    if (descMatch) {
      description = descMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\r/g, '')
        .trim();
    }

    // Extract potential chapters/timestamps from description
    const chapters = [];
    if (description) {
      const lines = description.split('\n');
      for (const line of lines) {
        const timeMatch = line.match(/(?:(\d{1,2}):)?(\d{1,2}):(\d{2})/);
        if (timeMatch && line.length < 120) {
          chapters.push(line.trim());
        }
      }
    }

    return { durationSec, description, chapters };
  } catch (err) {
    console.warn('Failed to scrape stream details:', err.message);
    return { durationSec: 7200, description: '', chapters: [] };
  }
}

/**
 * Calls AI provider (Groq or Gemini) with rate-limit retry and model fallback
 */
async function generateShortsClips(prompt) {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  
  const useGroq = (groqKey && groqKey.trim().length > 0) || (geminiKey && geminiKey.startsWith('gsk_'));
  const activeKey = useGroq ? (groqKey || geminiKey) : geminiKey;

  if (!activeKey) {
    throw new Error('No AI API key found. Please set GROQ_API_KEY or GEMINI_API_KEY in environment variables.');
  }

  if (useGroq) {
    // openai/gpt-oss-120b supports full 8000 TPM with no restrictive OTPM cap, returning up to 15 clips reliably
    const candidateModels = [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b'
    ];

    let lastError = null;

    for (const model of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${activeKey}`
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: 'system',
                  content: `You are an elite YouTube Shorts producer, virality algorithm specialist, and video editor.
Identify viral, hook-driven, self-contained moments (15 to 58 seconds) from video content.
Always output valid JSON conforming strictly to the requested schema with 12 to 15 viral clips.`
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              response_format: { type: 'json_object' },
              max_tokens: 3600,
              temperature: 0.3
            })
          });

          if (res.status === 429) {
            console.warn(`Groq model ${model} rate-limited (429). Attempt ${attempt}.`);
            if (attempt === 1) {
              await new Promise(r => setTimeout(r, 4000));
              continue;
            }
            break; // Try next model
          }

          if (!res.ok) {
            const errText = await res.text();
            lastError = new Error(`Groq model ${model} error (${res.status}): ${errText}`);
            break;
          }

          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (!content) {
            lastError = new Error(`Empty content from Groq model ${model}`);
            break;
          }
          return JSON.parse(content);
        } catch (err) {
          lastError = err;
          break;
        }
      }
    }

    throw lastError || new Error('All Groq model attempts failed.');
  } else {
    // GEMINI REST API Call
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Empty response from Gemini');
    }
    return JSON.parse(rawText);
  }
}

/**
 * Netlify Function Handler
 */
export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

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

  let videoId = '';
  try {
    const payload = JSON.parse(event.body || '{}');
    videoId = (payload.videoId || '').trim();
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON body.' })
    };
  }

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid or missing 11-character YouTube video ID.' })
    };
  }

  try {
    // 1. Fetch metadata from YouTube oEmbed endpoint
    let metadata = {
      title: 'YouTube Video',
      author: 'Creator',
      authorUrl: '',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    };

    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        metadata = {
          title: oembed.title || metadata.title,
          author: oembed.author_name || metadata.author,
          authorUrl: oembed.author_url || '',
          thumbnail: oembed.thumbnail_url || metadata.thumbnail
        };
      }
    } catch (e) {
      console.warn('oEmbed fetch warning:', e.message);
    }

    // 2. Fetch transcript via youtube-transcript
    let rawTranscript = null;
    let hasTranscript = false;
    let normalizedTranscript = [];

    try {
      rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);
      if (rawTranscript && rawTranscript.length > 0) {
        hasTranscript = true;
      }
    } catch (transcriptErr) {
      console.warn(`Captions not directly available for ${videoId}:`, transcriptErr.message);
    }

    let totalDurationSec = 0;
    let prompt = '';
    let isLivestreamArc = false;

    if (hasTranscript) {
      // Robust detection of millisecond offsets vs seconds
      const isMilliseconds = rawTranscript.some(t => t.duration > 50 || t.offset > 86400);

      normalizedTranscript = rawTranscript.map(item => {
        let offsetSec = item.offset;
        let durSec = item.duration;
        if (isMilliseconds) {
          offsetSec = offsetSec / 1000;
          durSec = durSec / 1000;
        }
        return {
          offset: offsetSec,
          duration: Math.max(0.5, durSec),
          text: item.text
        };
      });

      const lastItem = normalizedTranscript[normalizedTranscript.length - 1];
      totalDurationSec = Math.ceil(lastItem.offset + lastItem.duration);

      // Smart transcript condensing to stay strictly under token limits (up to 2200 words)
      const condensed = condenseTranscript(normalizedTranscript, 2200);

      prompt = `You are an elite YouTube Shorts virality algorithm specialist and video editor.
Analyze this timed transcript from "${metadata.title}" by "${metadata.author}" (Duration: ${formatSeconds(totalDurationSec)}).

Extract exactly 15 candidate viral Shorts moments (each strictly 15 to 58 seconds).
Choose moments distributed across the entire video timeline from beginning to end with strong 3-second hooks, punchlines/emotional peaks, and complete self-contained thoughts.

CRITICAL RULES:
1. Return exactly 15 candidate clips.
2. Every clip MUST be strictly between 15 and 58 seconds long (never exceed 58s).
3. Timestamps must be in "mm:ss" or "hh:mm:ss" and fall within 00:00 and ${formatSeconds(totalDurationSec)}.
4. Ensure clips span the entire video timeline: early, mid, late, and climax sections.
5. Provide high-converting titles (under 60 chars), descriptions, 3-5 hashtags, virality scores (0-100), categories, on-screen 3-second hook text overlays, engaging pinned comment questions, and actionable editing cues (zooms, SFX, B-roll).

REQUIRED JSON FORMAT:
{
  "clips": [
    {
      "startTime": "mm:ss",
      "endTime": "mm:ss",
      "title": "Hook-driven title under 60 chars",
      "description": "1-2 sentence YouTube Shorts description",
      "hashtags": ["#tag1", "#tag2", "#tag3"],
      "viralityScore": 92,
      "category": "Luxury & Lifestyle | Controversy & Debate | Comedy & Rage | Mindset & Advice | Plot Twist & Drama | Peak Climax",
      "hookText": "Exact 3-second on-screen text overlay for editor",
      "pinnedComment": "Engaging question to pin in comments for maximum comment bait",
      "editingTip": "Actionable editing cue e.g. Punch-in zoom at 0:02, whoosh SFX on hook, highlight subtitles at punchline",
      "reasoning": "one sentence on why this moment works"
    }
  ]
}

SPECIAL VIRALITY DIRECTIVE:
Pay special attention to luxury lifestyle & flex moments (supercars, private jets, luxury watches, penthouses, high-end dinners, wealth flexing, aesthetic life shots) and categorize them as "Luxury & Lifestyle" since these generate astronomical view counts on Shorts.

TRANSCRIPT:
${condensed}`;

    } else {
      // 3. Fallback: Livestream / No Captions Pacing Engine
      isLivestreamArc = true;
      const streamDetails = await fetchStreamDetails(videoId);
      totalDurationSec = streamDetails.durationSec || 7200;

      const chaptersContext = streamDetails.chapters.length > 0 
        ? `\nStream Chapters / Timestamps:\n${streamDetails.chapters.slice(0, 25).join('\n')}\n`
        : '';
      const descContext = streamDetails.description 
        ? `\nStream Description Context:\n${streamDetails.description.slice(0, 400)}\n`
        : '';

      prompt = `You are an elite YouTube Shorts editor and virality algorithm specialist.
The user wants to find the best 15 moments to cut into YouTube Shorts from this YouTube livestream/video:
Title: "${metadata.title}"
Creator: "${metadata.author}"
Total Duration: ${formatSeconds(totalDurationSec)} (${totalDurationSec} seconds)${chaptersContext}${descContext}

NOTE: Closed captions are not yet available from YouTube for this stream.
Based on the creator's style, the title/challenge ("${metadata.title}"), and typical high-converting livestream story arcs, scout exactly 15 high-energy peak moments across the entire stream timeline.

CRITICAL RULES:
1. Provide exactly 15 candidate clips.
2. Every clip MUST be 15 to 58 seconds long (never exceed 58s).
3. Timestamps must be in "mm:ss" or "hh:mm:ss" and must fall strictly within 00:00 and ${formatSeconds(totalDurationSec)}.
4. Spread the 15 moments strategically across the ENTIRE duration:
   - Early Phase (0% to 25% of timeline): 3-4 clips (Opening Hook, Stream Warmup, Initial Rant/Challenge)
   - Mid Phase (25% to 65% of timeline): 5-6 clips (Major confrontations, Hot Takes, Hilarious Fails, Game Highlights, Luxury/Lifestyle flex)
   - Late Phase (65% to 85% of timeline): 3-4 clips (Intense peak, dramatic turn, emotional moment, fan reactions)
   - Climax & Signoff (85% to 100% of timeline): 2-3 clips (Final boss/payoff, end challenge resolution, final wisdom)
5. Generate high-converting hook titles (under 60 chars), 1-2 sentence descriptions, 3-5 hashtags, virality scores (0-100), categories, 3-second on-screen hook text overlays, suggested pinned comments, and actionable editing cues.
6. Tag any supercars, penthouses, private jets, expensive dinners, or aesthetic wealth flex as "Luxury & Lifestyle".

REQUIRED JSON FORMAT:
{
  "clips": [
    {
      "startTime": "hh:mm:ss",
      "endTime": "hh:mm:ss",
      "title": "Hook title under 60 chars",
      "description": "Shorts description with hook",
      "hashtags": ["#tag1", "#tag2", "#tag3"],
      "viralityScore": 92,
      "category": "Luxury & Lifestyle | Controversy & Debate | Comedy & Rage | Mindset & Advice | Plot Twist & Drama | Peak Climax",
      "hookText": "Exact 3-second on-screen text overlay for editor",
      "pinnedComment": "Engaging question to pin in comments for maximum comment bait",
      "editingTip": "Actionable editing cue e.g. Punch-in zoom at 0:02, whoosh SFX on hook, highlight subtitles at punchline",
      "reasoning": "Reason why this milestone is a viral candidate"
    }
  ]
}`;
    }

    const durationText = formatSeconds(totalDurationSec);

    // 4. Call AI Model
    const aiResult = await generateShortsClips(prompt);
    let rawClips = Array.isArray(aiResult?.clips) ? aiResult.clips : [];

    if (rawClips.length === 0 && Array.isArray(aiResult)) {
      rawClips = aiResult;
    }

    if (rawClips.length === 0) {
      throw new Error('AI could not identify suitable clips for this video.');
    }

    // 5. Clean, validate, and compute timestamps for each clip
    const processedClips = rawClips.map((clip, index) => {
      let startSec = parseTimestamp(clip.startTime);
      let endSec = parseTimestamp(clip.endTime);

      if (startSec > totalDurationSec) {
        startSec = Math.max(0, Math.floor(totalDurationSec * (index / (rawClips.length + 1))));
        endSec = startSec + 35;
      }

      let clipDur = endSec - startSec;
      if (clipDur <= 0 || clipDur > 58) {
        if (clipDur <= 0) {
          endSec = Math.min(totalDurationSec, startSec + 35);
        } else if (clipDur > 58) {
          endSec = startSec + 55;
        }
        clipDur = endSec - startSec;
      }
      if (clipDur < 15 && startSec + 15 <= totalDurationSec) {
        endSec = startSec + 15;
        clipDur = 15;
      }

      let score = Number(clip.viralityScore);
      if (isNaN(score) || score < 0 || score > 100) {
        score = 80;
      }

      const tags = Array.isArray(clip.hashtags)
        ? clip.hashtags.map(t => (t.startsWith('#') ? t : `#${t}`.replace(/\s+/g, '')))
        : ['#Shorts', '#Viral'];

      const rawCat = (clip.category || '').toLowerCase();
      let matchedCategory = 'Luxury & Lifestyle';
      if (rawCat.includes('lux') || rawCat.includes('life') || rawCat.includes('flex') || rawCat.includes('car') || rawCat.includes('jet') || rawCat.includes('money') || rawCat.includes('wealth') || rawCat.includes('rich') || rawCat.includes('mansion') || rawCat.includes('dinner')) {
        matchedCategory = 'Luxury & Lifestyle';
      } else if (rawCat.includes('controvers') || rawCat.includes('debate') || rawCat.includes('hot take') || rawCat.includes('argument')) {
        matchedCategory = 'Controversy & Debate';
      } else if (rawCat.includes('comed') || rawCat.includes('rage') || rawCat.includes('funny') || rawCat.includes('laugh') || rawCat.includes('fail')) {
        matchedCategory = 'Comedy & Rage';
      } else if (rawCat.includes('mind') || rawCat.includes('advice') || rawCat.includes('insight') || rawCat.includes('lesson') || rawCat.includes('wisdom')) {
        matchedCategory = 'Mindset & Advice';
      } else if (rawCat.includes('twist') || rawCat.includes('drama') || rawCat.includes('shock') || rawCat.includes('reveal')) {
        matchedCategory = 'Plot Twist & Drama';
      } else {
        matchedCategory = clip.category || 'Peak Climax';
      }

      const cleanTitle = (clip.title || 'Must-Watch Moment').trim().substring(0, 65);
      const hookText = (clip.hookText || cleanTitle).trim();
      const pinnedComment = (clip.pinnedComment || 'What do you think about this? Let me know below! 👇').trim();
      const editingTip = (clip.editingTip || 'Punch-in 1.2x zoom at 0:02, whoosh SFX on hook overlay, and animated captions for key words in CapCut.').trim();

      // Extract timed subtitle lines for this slice if transcript exists
      let subtitles = [];
      if (normalizedTranscript && normalizedTranscript.length > 0) {
        subtitles = normalizedTranscript
          .filter(t => (t.offset + t.duration) >= startSec && t.offset <= endSec)
          .map(t => ({
            start: Math.max(0, Math.round((t.offset - startSec) * 10) / 10),
            end: Math.min(clipDur, Math.round((t.offset + t.duration - startSec) * 10) / 10),
            text: t.text
          }))
          .filter(t => t.text && t.text.length > 0);
      }
      if (subtitles.length === 0) {
        subtitles = [
          { start: 0, end: Math.min(3.5, clipDur), text: hookText },
          { start: Math.min(3.5, clipDur), end: clipDur, text: cleanTitle }
        ];
      }

      return {
        id: `clip-${index + 1}`,
        startTime: formatSeconds(startSec),
        endTime: formatSeconds(endSec),
        startSeconds: startSec,
        endSeconds: endSec,
        durationSeconds: clipDur,
        title: cleanTitle,
        description: (clip.description || '').trim(),
        hashtags: tags,
        viralityScore: Math.round(score),
        category: matchedCategory,
        hookText,
        pinnedComment,
        editingTip,
        subtitles,
        reasoning: (clip.reasoning || '').trim(),
        previewUrl: `https://youtu.be/${videoId}?t=${startSec}`
      };
    });

    processedClips.sort((a, b) => b.viralityScore - a.viralityScore);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        isLivestreamArc,
        notice: isLivestreamArc 
          ? "Closed captions were not yet available from YouTube for this stream. ClipScout mapped high-probability viral milestones across the stream duration."
          : null,
        video: {
          videoId,
          title: metadata.title,
          author: metadata.author,
          authorUrl: metadata.authorUrl,
          thumbnail: metadata.thumbnail,
          durationSeconds: totalDurationSec,
          durationText: durationText
        },
        clips: processedClips
      })
    };
  } catch (err) {
    console.error('Server error in analyze handler:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: err.message || 'An unexpected error occurred while analyzing the video.'
      })
    };
  }
};
