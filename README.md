# 🎬 ClipScout — AI YouTube Shorts & Livestream Clipper

> **🌐 Live Production URL:** [https://clipscout-ai.netlify.app](https://clipscout-ai.netlify.app)  
> **📦 GitHub Repository:** [https://github.com/dinil2/clipScout](https://github.com/dinil2/clipScout)

---

## 🌟 Overview
**ClipScout** is a high-performance creator productivity tool that extracts viral moments from long-form YouTube videos and multi-hour livestreams, automatically packaging them into ready-to-publish YouTube Shorts with hook titles, descriptions, hashtags, AI virality scoring, and 1-click **1080p clip downloading**.

Designed to be lightweight, fast, and completely ephemeral — **no accounts, no database, zero storage costs**.

---

## 🚀 Key Features

- **Hook-First Virality Scoring (0–100)**: Evaluates dialogue pacing, 3-second hook strength, punchlines, and emotional peaks with editorial reasoning.
- **Strict 15–58s Limits**: Guarantees candidate moments never exceed YouTube Shorts' 60-second limit and form complete, self-contained story beats.
- **⚡ Direct 1080p Clip Downloads**: Downloads **only the exact 15–58s slice** in high-definition 1080p directly to your computer using selective HTTP range requests — eliminating the need to download 5–10 GB livestream files.
- **⚡ Livestream Story Arc Milestone Engine**: Automatically handles recent livestreams and videos where YouTube has not yet processed captions by mapping creator milestone arcs across the stream duration.
- **Smart Timeline-Stride Transcript Condenser**: Intelligently compresses massive multi-hour transcripts down to ~900 high-density words (~1,200 tokens), preventing rate limits and token exhaustion.
- **1-Click YouTube Studio Kit**: Individual copy buttons for titles, descriptions, and hashtags, plus a **"Copy All"** button for instant pasting into YouTube Studio.
- **Persistent Local History**: Stores recent video analyses in browser `localStorage` for instant re-opening without re-querying the API.

---

## 🛠️ Architecture & Technologies Used

```
┌────────────────────────────────────────────────────────┐
│                   ClipScout Frontend                   │
│         React 18 + Vite + Tailwind CSS (Dark)          │
└───────────────▲────────────────────────▲───────────────┘
                │                        │
        POST /api/analyze        GET /api/download
                │                        │
┌───────────────▼───────────────┐ ┌──────▼───────────────┐
│     Netlify Serverless Fn     │ │ Python 1080p Clipper │
│      (analyze.js / Node)      │ │  (server/clipper.py) │
├───────────────────────────────┤ ├──────────────────────┤
│ 1. YouTube oEmbed (Metadata)  │ │ • yt-dlp             │
│ 2. youtube-transcript (Subs)  │ │ • FFmpeg 9.0         │
│ 3. Timeline-Stride Condenser  │ │ • HTTP Range Slicing │
│ 4. Groq Cloud / Gemini REST   │ │ • Direct MP4 Stream  │
└───────────────────────────────┘ └──────────────────────┘
```

### 1. Frontend: React + Vite + Tailwind CSS
- **React 18**: Component-driven UI managing asynchronous analysis states (Idle, Loading with skeleton cards and stepped messages, Error, and Success).
- **Vite 6**: Ultra-fast bundler providing lightning-fast HMR and custom local development middleware simulating Netlify functions.
- **Tailwind CSS**: Custom "Studio Darkroom" color palette (`#07080a` onyx, slate zincs, amber accents, and emerald virality badges) designed specifically for video editors.
- **Lucide React**: Clean, accessible iconography for clipboard copy, YouTube links, and download status.

### 2. Backend & Serverless API: Netlify Functions
- **Serverless Endpoint (`/netlify/functions/analyze.js`)**: Executes ephemerally on-demand with zero persistent server maintenance.
- **YouTube oEmbed API**: Public API endpoint fetching video title, channel name, and high-resolution thumbnail with zero credentials required.
- **`youtube-transcript`**: Directly scrapes and normalizes timed subtitles (`{ text, offset, duration }`) across multi-language tracks.

### 3. Artificial Intelligence: Groq Cloud LLM
- **Model**: `openai/gpt-oss-120b` (with automatic failover to `openai/gpt-oss-20b` and `qwen/qwen3.8-27b`).
- **Dual Support**: Also supports **Google Gemini (`gemini-2.5-flash`)** via direct REST calls.
- **Structured JSON Mode**: Enforces strict JSON output conforming to `{ clips: [{ startTime, endTime, title, description, hashtags, viralityScore, reasoning }] }`.
- **Timeline-Stride Condensation**: Overcomes free-tier token limits (8,000 TPM) by downsampling dialogue clusters evenly across the video timeline, allowing 3-hour streams to be analyzed in under 3 seconds.

### 4. Direct 1080p Slicer: Python 3.12 + `yt-dlp` + FFmpeg
- **`server/clipper.py`**: A specialized Python worker utilizing `yt-dlp`'s `download_ranges` callback and FFmpeg keyframe cutting.
- **Zero Waste**: Uses HTTP range requests to download **only the required seconds of video** rather than the entire multi-gigabyte source file, outputting high-definition MP4 files in seconds.

---

## 💻 Local Development Setup

### Prerequisites
- **Node.js** (v18 or higher)
- **Python 3.10+** (with `pip install yt-dlp`)
- **FFmpeg** (installed and added to PATH)

### 1. Clone the Repository
```bash
git clone https://github.com/dinil2/clipScout.git
cd clipScout
```

### 2. Install Node Dependencies
```bash
npm install
```

### 3. Install Python Dependencies
```bash
python -m pip install yt-dlp
```

### 4. Configure Environment Variables
Create a `.env` file in the root directory:
```env
# Groq API Key (from console.groq.com)
GROQ_API_KEY=your_groq_api_key_here

# Optional: Google Gemini API Key
GEMINI_API_KEY=
```

### 5. Launch Local Dev Server
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🌐 Deployment to Netlify

1. Fork or push this repository to GitHub / GitLab.
2. In Netlify, click **"Add new site" > "Import an existing project"**.
3. Select your repository. Netlify will auto-detect settings from `netlify.toml`:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
4. In **Site Configuration > Environment Variables**, add:
   - `GROQ_API_KEY` = your Groq API key
5. Click **Deploy**. Your site will be live immediately!

---

## 📜 License
MIT License. Built for creators and clippers.
