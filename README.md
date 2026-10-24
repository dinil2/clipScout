# 🎬 ClipScout — Content Rewards Clipping Assistant

> **🌐 Live Production URL:** [https://clipscout-ai.netlify.app](https://clipscout-ai.netlify.app)  
> **📦 GitHub Repository:** [https://github.com/dinil2/clipScout](https://github.com/dinil2/clipScout)

---

## 🌟 Overview
**ClipScout** is a high-reliability, zero-hallucination **Content Rewards clipping assistant** designed for creators participating in payout campaigns (such as ContentRewards.com).

Unlike generic AI clipping tools that fabricate timestamps, guess story arcs, or pad fake virality scores, ClipScout:
1. Grounded strictly in authentic spoken transcripts (YouTube captions, or user-pasted / uploaded `.srt`, `.vtt`, `.txt` files).
2. Uses sliding windows across **100% of the transcript timeline** rather than discarding 95% of speech.
3. Scores moments deterministically using 4 distinct sub-scores (Hook, Standalone Clarity, Emotion & Payoff, Campaign Fit).
4. Snaps clip boundaries to real sentence edges and enforces campaign duration limits (15–58s).
5. Validates every clip against campaign rules: required hashtags, required @mentions, and banned words.
6. Generates authentic `.SRT` subtitle tracks derived exclusively from real spoken words.
7. Tracks clips across workflow states (*Found*, *Editing*, *Posted*, *Submitted*) and calculates estimated view-based earnings against campaign CPM rates and per-clip caps.

---

## 🚀 Key Features

- **🎯 Campaign-Driven Evaluation**: Set rules, CPM rates, per-clip caps, required hashtags/mentions, and banned topics. The active campaign guides AI prompt scoring, boundary snapping, and compliance validation.
- **🛡️ Zero Hallucinations**: No fake padding, no default scores, no canned text. If a YouTube video lacks captions, the app honestly informs the user and invites them to paste or upload a transcript.
- **🔍 4-Factor Virality Sub-Scores (AI Estimate)**: Evaluates:
  - *Hook* (0–25)
  - *Standalone Clarity* (0–25)
  - *Emotion & Payoff* (0–25)
  - *Campaign Fit* (0–25)
  - *Composite Score* (0–100) calculated deterministically in code.
- **✂️ Sentence Boundary Snapping**: Refines raw start and end timestamps to natural sentence endings and speech pauses within ~3 seconds.
- **📋 Campaign Compliance Checklist**: Immediate pass/fail indicator per clip checking duration limits, required tags, required @mentions, and banned words.
- **📊 Earnings & Workflow Tracker**: Record posted clip URLs and views to track actual estimated earnings (`views / 1000 * CPM`), capped at the campaign maximum.
- **💾 Offline JSON Backup & Privacy**: All campaign data and clip tracking stays private in your browser's `localStorage`. Includes one-click JSON export and import backups.
- **🔐 Quota Protection**: Optional shared passcode protection (`APP_PASSCODE` in Netlify, `x-app-passcode` header) and origin-restricted CORS prevent unauthorized spending of your LLM quota.
- **⚡ Safe Clip Export**: Production provides copy-ready `yt-dlp` CLI commands for selective 1080p downloads. Direct local 1080p MP4 download via Python + FFmpeg is supported in dev with `VITE_ENABLE_LOCAL_DOWNLOAD=true`.

---

## 🛠️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                   ClipScout Frontend                   │
│      React 18 + Vite + Tailwind CSS (Studio Dark)      │
│  [Campaign Brief] -> [Source Input] -> [Clips] -> [Tracker]
└───────────────▲────────────────────────▲───────────────┘
                │                        │
         POST /api/analyze        GET /api/download
                │                        │
┌───────────────▼───────────────┐ ┌──────▼───────────────┐
│     Netlify Serverless Fn     │ │ Safe Download Helper │
│ (netlify/functions/analyze.js)│ │ (download.js / CLI)  │
├───────────────────────────────┤ ├──────────────────────┤
│ • Auth & Passcode Guard       │ │ • yt-dlp CLI command │
│ • oEmbed Metadata Fetcher     │ │ • Dev-only Python    │
│ • Universal Transcript Normal.│ │   clipper bridge     │
│ • 90s/30s Sliding Windows     │ │   (server/clipper.py)│
│ • Heuristic Pre-Ranking (25)  │ └──────────────────────┘
│ • Groq Cloud / Gemini REST    │
│ • Zod Strict Schema Check     │
│ • Anti-Hallucination Verify   │
│ • Sentence Boundary Snapping  │
│ • Campaign Rules Validator    │
└───────────────────────────────┘
```

---

## 💻 Local Development Setup

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- *(Optional for local 1080p dev downloads)*: **Python 3.10+**, `yt-dlp`, and **FFmpeg** in PATH.

### 1. Clone the Repository
```bash
git clone https://github.com/dinil2/clipScout.git
cd clipScout
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the project root:
```env
# Groq API Key (from console.groq.com)
GROQ_API_KEY=gsk_your_groq_api_key_here

# Optional: Google Gemini API Key
GEMINI_API_KEY=

# Optional: Shared passcode protecting API calls
APP_PASSCODE=

# Optional: Enable local 1080p download via Python clipper (dev-only)
VITE_ENABLE_LOCAL_DOWNLOAD=false
```

### 4. Run Unit Tests
```bash
npm test
```

### 5. Launch Local Dev Server
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🌐 Deployment to Netlify

1. Push your repository to GitHub.
2. In the Netlify dashboard, select **"Import from Git"**.
3. Build configuration (configured in `netlify.toml`):
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
4. Set Environment Variables in Netlify **Site Configuration > Environment Variables**:
   - `GROQ_API_KEY`: Your Groq API key
   - `APP_PASSCODE`: *(Optional)* Secret passcode required to invoke analysis
5. Deploy the site.

---

## 🧪 Testing

ClipScout includes a comprehensive test suite powered by **Vitest**:
```bash
npm test
```
Tests cover:
- `tests/transcriptParser.test.js`: YouTube offset normalization, SRT, VTT, and relative `.srt` clip generation.
- `tests/snapping.test.js`: Sentence boundary snapping, tolerance windows, and duration constraints.
- `tests/scoring.test.js`: Deterministic composite scoring, sub-score clamps, and CPM earnings caps.
- `tests/rulesCheck.test.js`: Compliance validation for durations, required hashtags, mentions, and banned words.

---

## 📜 License
MIT License. Built for creator productivity and Content Rewards clippers.
