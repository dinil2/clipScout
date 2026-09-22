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
 * Condenses transcript to <= targetMaxWords (~900 words / ~1200 tokens)
 * to stay safely within Groq's 8,000 TPM limit on free tier.
 */
function condenseTranscript(items, targetMaxWords = 900) {
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

  // 4. Sample evenly across timeline
  const step = Math.ceil(totalWords / targetMaxWords);
  const sampled = [];
  let wordCount = 0;

  for (let i = 0; i < blocks.length; i += step) {
    const b = blocks[i];
    const bWords = b.text.split(/\s+/).length;
    if (wordCount + bWords > targetMaxWords) break;
    sampled.push(`[${formatSeconds(b.start)}] ${b.text}`);
    wordCount += bWords;
  }

  return sampled.join('\n');
}

/**
 * Attempts to extract stream duration from YouTube watch page
 */
async function fetchStreamDuration(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (!res.ok) return 7200; // fallback 2 hours
    const html = await res.text();
    const match = html.match(/\"approxDurationMs\":\"(\d+)\"/);
    if (match) {
      return Math.floor(parseInt(match[1]) / 1000);
    }
    const lenMatch = html.match(/\"lengthSeconds\":\"(\d+)\"/);
    if (lenMatch) {
      return parseInt(lenMatch[1]);
    }
  } catch (err) {
    console.warn('Failed to scrape stream duration:', err.message);
  }
  return 7200;
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
    const candidateModels = [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.8-27b'
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
                  content: `You are an elite YouTube Shorts producer and algorithm specialist.
Identify viral, hook-driven, self-contained moments (15 to 58 seconds) from video content.
Always output valid JSON conforming strictly to the requested schema with 6 to 8 clips.`
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              response_format: { type: 'json_object' },
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

      const normalizedTranscript = rawTranscript.map(item => {
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

      // Smart transcript condensing to stay strictly under token limits
      const condensed = condenseTranscript(normalizedTranscript, 900);

      prompt = `You are an elite YouTube Shorts editor.
Analyze this timed transcript from "${metadata.title}" by "${metadata.author}" (Duration: ${formatSeconds(totalDurationSec)}).

Extract 6 to 8 candidate Shorts moments (each strictly 15 to 58 seconds).
Choose moments with strong 3-second hooks, punchlines/emotional peaks, and complete self-contained thoughts.

REQUIRED JSON FORMAT:
{
  "clips": [
    {
      "startTime": "mm:ss",
      "endTime": "mm:ss",
      "title": "string under 60 chars, hook-driven",
      "description": "1-2 sentence YouTube Shorts description",
      "hashtags": ["#tag1", "#tag2", "#tag3"],
      "viralityScore": 85,
      "reasoning": "one sentence on why this moment works"
    }
  ]
}

TRANSCRIPT:
${condensed}`;

    } else {
      // 3. Fallback: Livestream / No Captions Pacing Engine
      isLivestreamArc = true;
      totalDurationSec = await fetchStreamDuration(videoId);

      prompt = `You are an elite YouTube Shorts editor and virality analyst.
The user wants to find the best moments to cut into YouTube Shorts from this YouTube livestream/video:
Title: "${metadata.title}"
Creator: "${metadata.author}"
Total Duration: ${formatSeconds(totalDurationSec)} (${totalDurationSec} seconds)

NOTE: Closed captions are not yet available from YouTube for this stream.
Based on the creator's style, the title/challenge ("${metadata.title}"), and typical high-energy livestream story arcs (e.g. initial challenge hook, early escalation, mid-stream twist, peak confrontation/hype, climax, payoff), scout 6 to 8 high-energy peak moments across the stream timeline.

CRITICAL RULES:
1. Every clip MUST be 15 to 58 seconds long (never exceed 58s).
2. Timestamps must be in "mm:ss" or "hh:mm:ss" (if over 1 hour) and must fall strictly within 00:00 and ${formatSeconds(totalDurationSec)}.
3. Spread the moments strategically across early, mid, and climax phases of the duration.
4. Generate high-converting hook titles (under 60 chars), 1-2 sentence descriptions, 3-5 hashtags, virality scores (0-100), and reasoning.

REQUIRED JSON FORMAT:
{
  "clips": [
    {
      "startTime": "hh:mm:ss",
      "endTime": "hh:mm:ss",
      "title": "Hook title under 60 chars",
      "description": "Shorts description",
      "hashtags": ["#tag1", "#tag2"],
      "viralityScore": 90,
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

      return {
        id: `clip-${index + 1}`,
        startTime: formatSeconds(startSec),
        endTime: formatSeconds(endSec),
        startSeconds: startSec,
        endSeconds: endSec,
        durationSeconds: clipDur,
        title: (clip.title || 'Must-Watch Moment').trim().substring(0, 65),
        description: (clip.description || '').trim(),
        hashtags: tags,
        viralityScore: Math.round(score),
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
