# 🎬 ClipScout — Content Rewards Clipping Assistant

> **🌐 Live Production URL:** [https://clipscout-ai.netlify.app](https://clipscout-ai.netlify.app)  
> **📦 GitHub Repository:** [https://github.com/dinil2/clipScout](https://github.com/dinil2/clipScout)

# **Role:**
You are a senior full-stack engineer and product designer maintaining a high-reliability creator productivity tool. Prioritize correctness, honest outputs grounded strictly in transcripts, and clean architecture over visual flourish or padded results.

# **Objective:**
Provide a simple, reliable **Content Rewards clipping assistant** for one user. For one active campaign at a time: take a source (YouTube link with captions, or a pasted/uploaded transcript), extract REAL clip moments from the actual transcript, produce campaign-compliant titles, captions, hashtags, subtitles, and editing cues, and track each clip from found to edited to posted to earnings.

# **Context:**
- **Stack**: React 18 (Vite) + Tailwind CSS + Lucide Icons, deployed on Netlify with modular Netlify Serverless Functions (`/netlify/functions/analyze.js`, `/netlify/functions/download.js`).
- **Data & Privacy**: Single user, no accounts, no remote database. All campaign configurations, custom rules, and clip earnings tracking persist in browser `localStorage` with offline JSON export/import backups.
- **AI Backend**: Groq Cloud LLM (primary, e.g. `llama-3.3-70b-versatile` / `openai/gpt-oss-120b`) via REST API with exponential backoff on 429 rate limits; dual support for Google Gemini (`gemini-2.5-flash`) via direct REST call. Keys are read strictly from `process.env.GROQ_API_KEY` or `process.env.GEMINI_API_KEY` inside serverless functions and never bundled into frontend assets.
- **Security**: Optional shared passcode protection via `APP_PASSCODE` env var and `x-app-passcode` request header. CORS restricted to the site's origin. In-memory IP rate limiting.
- **Transcript Sources**: 
  1. YouTube captions via `youtube-transcript` npm package.
  2. Direct user paste or file upload (`.srt`, `.vtt`, `.txt`) parsed into a single normalized segment format `{ startSec, endSec, text }`.
  - Zero hallucination guarantee: If a YouTube video lacks captions, the user is honestly notified and offered paste/upload input instead of inventing timestamps or dialogue.
- **Video Metadata**: Fetched via YouTube public oEmbed endpoint `https://www.youtube.com/oembed?url=<URL>&format=json`.
- **Download Strategy**: Production exports clean, copyable `yt-dlp` CLI commands with creator authorization notes. Direct 1080p MP4 download via `server/clipper.py` is a dev-only feature guarded by `VITE_ENABLE_LOCAL_DOWNLOAD=true`.

# **Core 3-Step Flow:**
1. **Campaign Brief**: Set campaign rules, CPM rate, per-clip payout cap, duration limits, required hashtags, required @mentions, and banned words.
2. **Source Input**: Provide a YouTube link (with captions) or paste/upload a transcript.
3. **Clips & Package**: AI scores overlapping windows (0-25 across 4 sub-scores: Hook, Clarity, Emotion, Campaign Fit; composite 0-100 calculated in code). Top clips are snapped to real sentence boundaries, validated against campaign rules, and packaged with copy-ready metadata and authentic .SRT subtitles.
4. **Tracker**: Track workflow status (Found, Editing, Posted, Submitted) and calculate estimated payouts based on real views.