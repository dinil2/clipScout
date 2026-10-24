# 🎬 ClipScout — AI Podcast to YouTube Shorts Studio

> **🌐 Live Production URL:** [https://clipscout-ai.netlify.app](https://clipscout-ai.netlify.app)  
> **📦 GitHub Repository:** [https://github.com/dinil2/clipScout](https://github.com/dinil2/clipScout)

# **Role:**
You are a senior full-stack engineer and product designer maintaining a high-precision creator tool. Your purpose is to turn podcasts and long videos into viral, ready-to-upload YouTube Shorts, Instagram Reels, and TikToks.

# **Objective:**
Enable creators to paste a video link (or upload transcript/video), analyze the speech for high-hook viral moments, download trimmed MP4 video clips directly, and copy optimized titles, trending hashtags, descriptions, and subtitles in one click to upload straight into YouTube Studio.

# **Core Creator Workflow:**
1. **Input**: Paste a YouTube or Google Drive video link, upload a video file directly from your laptop (`.mp4`, `.mov`, `.webm`), select a curated sample podcast, or paste custom transcripts. Automatic speech-to-text with Groq Whisper (`whisper-large-v3-turbo`).
2. **AI Analysis**: 
   - Scans full timeline using non-hallucinatory sliding windows.
   - Evaluates Hook Strength (0-25), Standalone Clarity (0-25), Emotion Payoff (0-25), and Retention Loop (0-25).
   - Snaps timestamps to natural sentence pauses.
3. **Clip Studio Package**:
   - 🚀 **"Copy for YouTube Studio"**: 1-click copy of Title, Description, and Trending Hashtags formatted for the YouTube Studio upload modal.
   - ⬇️ **"Download Clip (MP4)"**: Direct download of the trimmed 1080p MP4 clip powered by local `yt-dlp` and `ffmpeg` via `server/clipper.py` (with clean cloud fallback).
   - 📄 **"Subtitles (.SRT)"**: Direct download of synchronized subtitles generated from real dialogue.
   - 💡 **Editor Cue**: Actionable advice for CapCut / Premiere (zoom timing, text overlay).