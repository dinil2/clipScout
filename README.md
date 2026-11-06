# 🎬 ClipScout — AI Podcast to YouTube Shorts Studio

> **Single-User Snazo-Style Clipper running at $0 with No Sign-In.**  
> Turn full-length podcasts into viral, vertical 9:16 MP4 clips with burned-in animated captions, titles, descriptions, and hashtags formatted for YouTube Studio.

---

## 🌟 What ClipScout Does

ClipScout provides a calm, premium studio workflow designed for **one creator** to process their own podcast episodes without subscriptions, cloud server costs, or artificial restrictions:

1. **Source Ingestion**: Paste a YouTube or public Google Drive link, or drop a video file directly from your laptop (`.mp4`, `.mov`, `.webm`, `.mkv`).
2. **Dialogue Transcription**:
   - Downloads official YouTube captions via `yt-dlp` (manual creator tracks first, then auto-generated WebVTT).
   - If captions do not exist (or for Google Drive and laptop uploads), extracts 16 kHz mono audio and transcribes with Groq Whisper (`whisper-large-v3-turbo`) using silence-aware chunking (<= 10 min, < 24 MB per request) with overlap deduplication.
   - Caches transcripts on disk by fingerprint for instant subsequent re-runs.
3. **Viral Moments Extraction**:
   - Scans 100% of the speech timeline with sliding candidate windows.
   - Evaluates 4 distinct sub-scores (0–25 each, totaling 0–100 calculated in code):
     - **Hook** (0–25): Immediate attention grab in the opening 3 seconds.
     - **Standalone Clarity** (0–25): Self-contained idea; penalizes dangling context.
     - **Emotion & Payoff** (0–25): Intellectual realization, emotional punch, or humor.
     - **Retention** (0–25): Ends on a strong beat with high replay appeal.
   - Snaps clip timestamps to authentic sentence pauses (Short 20–40s, Standard 30–60s, Long 60–120s, hard cap 180s).
   - Verifies verbatim evidence quotes against the source transcript (zero hallucinated clips).
4. **9:16 Vertical Video Rendering with Burned-In Captions**:
   - Cuts exact clips with FFmpeg accurate seeking (`libx264`, `preset veryfast`, `crf 20`, `aac 128k`, `+faststart`).
   - Scales the original video centered over an aesthetically blurred, scaled background copy of itself.
   - Generates and burns in animated subtitles via `libass` using the bundled open-license **Inter** font with bold white text, thick black outline, and active word highlighting in `#FFB020`.
   - Verifies each output clip with `ffprobe` before marking ready.
5. **YouTube Studio Package**:
   - **Download MP4**: 1-click download of the rendered 1080x1920 MP4 video clip.
   - **Copy for YouTube Studio**: 1-click copy of Title (under 70 chars with #Shorts), Description, and Hashtags (3–5 tags, always includes `#Shorts`, hard cap 15).
   - **Captions .srt**: Download synchronized subtitle file.
   - **Download All (ZIP)**: Stream a complete package archive of all clips, subtitles, and a `clips.txt` index.

---

## 💰 How It Runs at $0 Cost

ClipScout requires no paid subscriptions, no monthly cloud servers, and no paid database:

| Component | Technology | Cost |
| :--- | :--- | :--- |
| **Compute & Rendering** | Local PC CPU/GPU via FFmpeg & yt-dlp | **$0** (Free, Open Source) |
| **Speech-to-Text** | Groq Cloud Whisper (`whisper-large-v3-turbo`) | **$0** (Free Tier: 25 MB/req, generous RPM) |
| **AI Evaluation & Copy** | Groq Cloud LLM (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`) or Gemini 2.5 Flash | **$0** (Free Tier) |
| **Trending Tags (Optional)** | YouTube Data API v3 Search | **$0** (Free Daily Quota: 10,000 units) |
| **Application Server** | Fastify (Node 20) on `127.0.0.1:8787` | **$0** (Localhost) |

---

## 🛠️ System Prerequisites

To run ClipScout locally, install **Node.js 20+**, **FFmpeg** (with libass enabled), and **yt-dlp**:

### Windows
```powershell
# Using Winget (recommended)
winget install Gyan.FFmpeg
winget install yt-dlp.yt-dlp
winget install OpenJS.NodeJS.LTS
```

### macOS
```bash
# Using Homebrew
brew install node ffmpeg yt-dlp
```

### Linux (Ubuntu / Debian)
```bash
sudo apt update
sudo apt install -y nodejs npm ffmpeg
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

---

## 🚀 Quickstart

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/dinil2/clipScout.git
cd clipScout
npm install
```

### 2. Configure Environment (`.env`)
Copy the example file and add your free Groq API key:
```bash
cp .env.example .env
```
Edit `.env`:
```env
# Free key from https://console.groq.com/keys
GROQ_API_KEY=gsk_your_groq_api_key_here

# Optional: Google Gemini API Key from https://aistudio.google.com/app/apikey
GEMINI_API_KEY=

# Optional: YouTube Data API Key for trending tags from https://console.cloud.google.com
YOUTUBE_API_KEY=

# Optional: Port and security token
ENGINE_PORT=8787
ENGINE_DATA_DIR=./.engine_data
ENGINE_TOKEN=
```

### 3. Launch ClipScout
Run the all-in-one command:
```bash
npm run app
```
This builds the React frontend with Vite and starts the Fastify Engine at:
👉 **[http://127.0.0.1:8787](http://127.0.0.1:8787)**

---

## 🔄 Keeping yt-dlp Updated

YouTube frequently updates video stream formats. To keep yt-dlp working seamlessly:
```bash
npm run update:ytdlp
```

---

## 🧪 Testing

Run all unit tests (VTT/SRT parsers, audio chunking, sentence snapping, ASS subtitle generation, FFmpeg argument builders, and hashtag limits):
```bash
npm test
```

---

## ❓ Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **"Engine is Offline"** | Node engine process not running on port 8787 | Run `npm run app` in your terminal. |
| **"Missing libass"** | FFmpeg was compiled without `--enable-libass` | Install a full FFmpeg build (e.g. `winget install Gyan.FFmpeg` on Windows, or `brew install ffmpeg` on macOS). |
| **"Free limit reached"** | Groq free tier rate limit encountered | ClipScout automatically pauses with a countdown and resumes safely without failing. |
| **"Google Drive video not public"** | Link sharing is restricted | In Google Drive, click Share -> change to **"Anyone with the link can view"**, or upload the `.mp4` file directly. |
| **"YouTube bot check"** | YouTube restricted unauthenticated stream | Set `YTDLP_COOKIES_FROM_BROWSER=chrome` in `.env` or upload the file directly. |
