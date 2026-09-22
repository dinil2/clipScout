# 🎬 ClipScout — AI YouTube Shorts Clipper

> **🌐 Live Production URL:** [https://clipscout-ai.netlify.app](https://clipscout-ai.netlify.app)  
> **📦 GitHub Repository:** [https://github.com/dinil2/clipScout](https://github.com/dinil2/clipScout)

# **Role:**
You are a senior full-stack engineer building a lightweight, single-purpose internal tool. Prioritize working functionality and clean code over visual flourish — this is a personal productivity tool, not a marketing site.

# **Objective:**
Build "ClipScout" — a single-page web app where I paste any YouTube video/livestream URL, and it returns a ranked list of the best moments to cut into YouTube Shorts, each with a suggested timestamp range, title, description, hashtags, and an AI-estimated virality score. No login, no database, no user accounts — this is used by one person (me) only.

# **Context:**
- Stack: React (Vite) + Tailwind CSS, deployed as a static site on Netlify with a single Netlify Function as the backend.
- No Supabase, no auth, no persistent storage — everything happens in one request/response cycle. Optionally cache the last few results in the browser's localStorage so a refresh doesn't lose them, but this is not required to work.
- AI backend: Google Gemini API via direct REST call (not the SDK, to avoid dependency/version drift) — `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=API_KEY`, with `generationConfig.responseMimeType` set to `application/json` so the model returns clean structured JSON.
- The Gemini API key is read from `process.env.GEMINI_API_KEY` inside the Netlify Function only — it must never be sent to or embedded in the frontend bundle.
- Transcript source: use the `youtube-transcript` npm package (no API key required) inside the Netlify Function to pull the timed transcript (array of `{ text, offset, duration }`) for the given video ID.
- Video metadata (title, thumbnail, channel name): fetch from YouTube's public oEmbed endpoint `https://www.youtube.com/oembed?url=<VIDEO_URL>&format=json` — no API key required.

# **Instructions:**

## Instruction 1 — Project setup
Scaffold a Vite + React + Tailwind project with a `/netlify/functions/analyze.js` serverless function and a `netlify.toml` that points the functions directory correctly and redirects `/api/*` to `/.netlify/functions/*`.

## Instruction 2 — Landing UI
Single page, dark theme, centered layout. At the top: app name "ClipScout", a one-line subtitle, and a single large input field for "Paste a YouTube video or livestream link" with an "Analyze" button. Validate that the pasted URL is a real YouTube URL (watch, youtu.be, or live URL formats) and extract the 11-character video ID from it before submitting. Show the fetched video thumbnail, title, and channel name above the results once analysis starts.

## Instruction 3 — Backend function: `analyze.js`
On POST, receive `{ videoId }`. Steps:
1. Fetch metadata from the oEmbed endpoint.
2. Fetch the transcript via `youtube-transcript`. If no transcript exists (captions disabled), return a clear error the frontend can display ("This video has no captions available, so it can't be analyzed").
3. Build a single prompt for Gemini containing: the full timed transcript (formatted as `[mm:ss] text` per line) and the total video duration. Ask it to return 6–8 candidate Shorts clips as JSON, each 15–58 seconds long (never over 60s — YouTube Shorts' hard limit), non-overlapping where possible, chosen for hook strength, punchline/payoff, emotional peak, or a self-contained story beat.
4. Require this exact JSON shape back from Gemini (use `responseSchema` if supported, otherwise strict prompt instructions):

{
"clips": [
{
"startTime": "mm:ss",
"endTime": "mm:ss",
"title": "string, under 60 chars, hook-driven",
"description": "1-2 sentence YouTube Shorts description",
"hashtags": ["#tag1", "#tag2", "..."],
"viralityScore": 0-100,
"reasoning": "one sentence on why this moment works"
}
]
}

5. Sort clips by `viralityScore` descending before returning them to the frontend, alongside the video metadata.

## Instruction 4 — Results UI
Render each clip as a card, ordered by score, in a vertical list:
- A colored score badge (green ≥80, yellow 50-79, gray <50) labeled "AI Virality Score" (make clear in a small caption under the score that this is an AI estimate, not a guarantee).
- The timestamp range in monospace, with a "▶ Preview on YouTube" link that opens `https://youtu.be/<videoId>?t=<startSeconds>` in a new tab.
- Title, description, and hashtags, each with its own small copy-to-clipboard icon button, plus one "Copy all" button per card that copies title + description + hashtags together in one paste-ready block.
- A brief italic line showing the `reasoning` field.

## Instruction 5 — States
Handle and visually design: idle (empty state with instructions), loading (skeleton cards + a short rotating status message like "Reading transcript…" → "Finding the best moments…"), error (invalid URL, no captions, API failure — each with a distinct friendly message), and success.

## Instruction 6 — Deployment
Ensure the app runs with `netlify dev` locally and builds cleanly with `netlify build`. Do not commit any API key — confirm `.env` is in `.gitignore` and document in a short README that `GEMINI_API_KEY` must be set in Netlify's environment variables before the function will work in production.

# **Notes:**
- Keep dependencies minimal: React, Tailwind, `youtube-transcript`, and native `fetch` — no extra state-management or UI libraries needed for a page this small.
- Fast, selective 1080p clip download powered by Python 3.12 + yt-dlp + FFmpeg.
- No authentication, no user accounts, no database — a single anonymous visitor flow only.
- Must be usable comfortably from a phone browser, since I'll likely paste links on the go.
- API Key configured in `.env` (GROQ_API_KEY) and Netlify environment variables.