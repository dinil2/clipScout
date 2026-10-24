import React, { useState } from 'react';
import { 
  Sparkles, Youtube, Clipboard, X, SlidersHorizontal, 
  Clock, Flame, Upload, FileText, ArrowRight, Play, Check,
  HardDrive, Video, Laptop, HelpCircle
} from 'lucide-react';

// Popular podcast samples for instant 1-click testing
const SAMPLE_PODCASTS = [
  {
    id: 'UF8uR6Z6KLc',
    title: 'Steve Jobs',
    topic: 'Stanford Commencement Speech',
    url: 'https://www.youtube.com/watch?v=UF8uR6Z6KLc'
  },
  {
    id: 'P9tF79m0R_k',
    title: 'Huberman Lab',
    topic: 'Focus & Dopamine Hacks',
    url: 'https://www.youtube.com/watch?v=P9tF79m0R_k'
  },
  {
    id: 'h2B_g2sA6b0',
    title: 'Lex Fridman',
    topic: 'AI & The Future',
    url: 'https://www.youtube.com/watch?v=h2B_g2sA6b0'
  },
  {
    id: 'W_aM3z2k_Wk',
    title: 'Joe Rogan',
    topic: 'Discipline & Mindset',
    url: 'https://www.youtube.com/watch?v=W_aM3z2k_Wk'
  }
];

export default function HeroInput({ 
  onAnalyze, 
  onUploadFile,
  isLoading, 
  options, 
  setOptions 
}) {
  const [activeTab, setActiveTab] = useState('link'); // 'link' (YouTube/Drive) | 'laptop' (Local Video) | 'transcript'
  const [url, setUrl] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [uploadedTranscriptFile, setUploadedTranscriptFile] = useState(null);
  const [laptopVideoFile, setLaptopVideoFile] = useState(null);
  const [copiedSampleId, setCopiedSampleId] = useState(null);

  // Check link type
  const isGoogleDriveLink = url.includes('drive.google.com');
  const isYouTubeLink = url.includes('youtube.com') || url.includes('youtu.be') || /^[a-zA-Z0-9_-]{11}$/.test(url.trim());

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrl(text.trim());
        }
      }
    } catch {
      const el = document.getElementById('video-url-input');
      if (el) el.focus();
    }
  };

  const handleSampleClick = (sample) => {
    setActiveTab('link');
    setUrl(sample.url);
    setCopiedSampleId(sample.id);
    setTimeout(() => setCopiedSampleId(null), 1500);
  };

  const handleSubmitLink = (e) => {
    e?.preventDefault();
    if (isLoading || !url.trim()) return;

    if (isGoogleDriveLink) {
      onAnalyze({
        isGoogleDrive: true,
        googleDriveUrl: url.trim(),
        title: 'Google Drive Podcast'
      });
      return;
    }

    // Extract 11-char YouTube ID
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/|watch\?.+&v=))([\w-]{11})/);
    const videoId = match ? match[1] : (url.trim().length === 11 ? url.trim() : null);

    if (!videoId) {
      alert('Please enter a valid YouTube or Google Drive link.');
      return;
    }

    onAnalyze({ videoId });
  };

  const handleSubmitLaptopVideo = () => {
    if (!laptopVideoFile || isLoading) return;
    onUploadFile(laptopVideoFile);
  };

  const handleSubmitTranscript = () => {
    if (pastedText.trim()) {
      onAnalyze({
        transcriptText: pastedText.trim(),
        title: 'Custom Transcript',
        author: 'Pasted Dialogue',
        fileType: 'txt'
      });
      return;
    }

    if (uploadedTranscriptFile) {
      const reader = new FileReader();
      const ext = uploadedTranscriptFile.name.split('.').pop().toLowerCase();
      reader.onload = (event) => {
        onAnalyze({
          transcriptText: event.target.result,
          title: uploadedTranscriptFile.name.replace(/\.[^/.]+$/, ''),
          author: 'Uploaded Subtitles',
          fileType: ext
        });
      };
      reader.readAsText(uploadedTranscriptFile);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6">
      
      {/* Hero Headline */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold uppercase tracking-wider mb-4 animate-fade-in">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <span>AI Podcast to YouTube Shorts Studio</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
          Turn Any Podcast into <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-amber-300 to-emerald-400">
            Viral YouTube Shorts
          </span>
        </h1>
        <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Paste a YouTube or Google Drive link, or upload directly from your laptop. ClipScout finds meaningful, high-retention moments and prepares ready-to-upload clips.
        </p>
      </div>

      {/* Main Container Card */}
      <div className="relative rounded-2xl bg-studio-900/90 border border-studio-700/80 shadow-2xl backdrop-blur-xl p-4 sm:p-6 transition-all duration-300 hover:border-violet-500/30">
        
        {/* Source Mode Tabs */}
        <div className="flex items-center gap-2 pb-4 mb-5 border-b border-studio-800 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 ${
              activeTab === 'link'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/20'
                : 'text-zinc-400 hover:text-white hover:bg-studio-800'
            }`}
          >
            <Youtube className="w-4 h-4 text-red-400" />
            <span>YouTube / Google Drive Link</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('laptop')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 ${
              activeTab === 'laptop'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/20'
                : 'text-zinc-400 hover:text-white hover:bg-studio-800'
            }`}
          >
            <Laptop className="w-4 h-4 text-amber-400" />
            <span>Upload from Laptop (MP4 / MOV)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transcript')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 ${
              activeTab === 'transcript'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/20'
                : 'text-zinc-400 hover:text-white hover:bg-studio-800'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Paste Transcript (.SRT / Text)</span>
          </button>
        </div>

        {/* TAB 1: Link Input (YouTube & Google Drive) */}
        {activeTab === 'link' && (
          <form onSubmit={handleSubmitLink} className="space-y-4">
            <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1 flex items-center">
                <div className="absolute left-4 pointer-events-none flex items-center justify-center">
                  {isGoogleDriveLink ? (
                    <HardDrive className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <Youtube className="w-6 h-6 text-red-500" />
                  )}
                </div>
                <input
                  id="video-url-input"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste YouTube or Google Drive link..."
                  className="w-full pl-12 pr-20 py-4 rounded-xl bg-studio-950/80 border border-studio-700 text-white placeholder-zinc-500 text-base focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition shadow-inner"
                  disabled={isLoading}
                />
                
                <div className="absolute right-3 flex items-center gap-1.5">
                  {url ? (
                    <button
                      type="button"
                      onClick={() => setUrl('')}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-studio-800 transition"
                      title="Clear"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 text-zinc-300 text-xs font-medium transition"
                      title="Paste from clipboard"
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      <span>Paste</span>
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !url.trim()}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98] text-white font-semibold text-base shadow-lg shadow-violet-600/25 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span>Generate Shorts</span>
                  </>
                )}
              </button>
            </div>

            {/* Google Drive Link Help Note */}
            {isGoogleDriveLink && (
              <div className="flex items-center gap-2 text-xs text-emerald-300/90 bg-emerald-950/30 border border-emerald-500/20 p-2.5 rounded-lg">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Google Drive video detected! Ensure the link access is set to <strong>"Anyone with the link can view"</strong> so ClipScout can extract audio for Whisper transcription.</span>
              </div>
            )}

            {/* Quick Samples Section */}
            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="font-medium text-zinc-500">Try a sample podcast:</span>
              {SAMPLE_PODCASTS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSampleClick(sample)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border transition ${
                    copiedSampleId === sample.id
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                      : 'bg-studio-850/60 border-studio-700/60 text-zinc-300 hover:border-violet-500/40 hover:text-white'
                  }`}
                >
                  <Play className="w-2.5 h-2.5 text-violet-400" />
                  <span className="font-medium">{sample.title}</span>
                  <span className="text-zinc-500">({sample.topic})</span>
                  {copiedSampleId === sample.id && <Check className="w-3 h-3 text-emerald-400 ml-1" />}
                </button>
              ))}
            </div>
          </form>
        )}

        {/* TAB 2: Upload Video from Laptop */}
        {activeTab === 'laptop' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-studio-700/80 hover:border-violet-500/50 rounded-2xl p-8 text-center transition bg-studio-950/40">
              <div className="w-12 h-12 rounded-2xl bg-violet-600/15 border border-violet-500/30 text-violet-400 flex items-center justify-center mx-auto mb-3">
                <Video className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white mb-1">
                {laptopVideoFile ? laptopVideoFile.name : 'Drag & drop your podcast or video file here'}
              </p>
              <p className="text-xs text-zinc-400 mb-4">
                Supports MP4, MOV, WebM, MKV, MP3, WAV. ClipScout transcribes via Groq Whisper in seconds.
              </p>

              <label className="inline-block px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold cursor-pointer transition shadow-md shadow-violet-600/20">
                Browse Video from Laptop
                <input
                  type="file"
                  accept="video/*,audio/*,.mp4,.mov,.webm,.mkv,.mp3,.wav,.m4a"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setLaptopVideoFile(f);
                  }}
                  className="hidden"
                />
              </label>

              {laptopVideoFile && (
                <div className="mt-5 p-3 rounded-xl bg-studio-900 border border-studio-750 flex items-center justify-between gap-3 text-left max-w-md mx-auto">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{laptopVideoFile.name}</p>
                    <p className="text-[11px] text-zinc-400">
                      {(laptopVideoFile.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSubmitLaptopVideo}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shrink-0 shadow-md shadow-emerald-600/20"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Transcribe & Generate</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Paste or Upload Transcript */}
        {activeTab === 'transcript' && (
          <div className="space-y-4">
            <textarea
              rows={6}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste podcast dialogue or transcript here... (Supports timestamps like 00:01:23 or plain text)"
              className="w-full p-4 rounded-xl bg-studio-950/80 border border-studio-700 text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
            />
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <label className="text-xs text-zinc-400 hover:text-white cursor-pointer inline-flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-violet-400" />
                <span>Or upload .srt / .vtt file</span>
                <input
                  type="file"
                  accept=".srt,.vtt,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setUploadedTranscriptFile(f);
                  }}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleSubmitTranscript}
                disabled={isLoading || (!pastedText.trim() && !uploadedTranscriptFile)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition disabled:opacity-50"
              >
                Analyze Transcript
              </button>
            </div>
          </div>
        )}

        {/* Clip Tuning Drawer Toggle */}
        <div className="mt-4 pt-4 border-t border-studio-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition font-medium"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-violet-400" />
            <span>Customize Duration & Style</span>
            <span className="text-zinc-500 font-mono">({options.duration}s • {options.clipCount} clips)</span>
          </button>
        </div>

        {/* Options Panel */}
        {showOptions && (
          <div className="mt-4 p-4 rounded-xl bg-studio-950/70 border border-studio-800 space-y-4 animate-fade-in text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Target Duration */}
              <div>
                <label className="block text-zinc-400 font-semibold mb-2">
                  <Clock className="w-3.5 h-3.5 inline mr-1 text-violet-400" />
                  Clip Duration
                </label>
                <div className="flex flex-col gap-1.5">
                  {[
                    { id: '15-30', label: '⚡ 15–30s (Punchy Hook)' },
                    { id: '30-60', label: '🎯 30–60s (Recommended Shorts)' },
                    { id: '60-90', label: '📖 60–90s (Extended Story)' }
                  ].map((dur) => (
                    <button
                      key={dur.id}
                      type="button"
                      onClick={() => setOptions({ ...options, duration: dur.id })}
                      className={`px-3 py-2 rounded-lg text-left transition font-medium ${
                        options.duration === dur.id
                          ? 'bg-violet-600/25 border border-violet-500/40 text-violet-200'
                          : 'bg-studio-850/60 text-zinc-400 hover:text-zinc-200 hover:bg-studio-800/50'
                      }`}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number of Clips */}
              <div>
                <label className="block text-zinc-400 font-semibold mb-2">
                  <Sparkles className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
                  Clips to Extract
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { count: 5, label: '5 Clips' },
                    { count: 10, label: '10 Clips (Default)' },
                    { count: 15, label: '15 Clips' },
                    { count: 20, label: '20 Clips' }
                  ].map(({ count, label }) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setOptions({ ...options, clipCount: count })}
                      className={`py-2 px-2.5 rounded-lg text-center transition font-medium text-xs ${
                        options.clipCount === count
                          ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200 font-bold'
                          : 'bg-studio-850/60 text-zinc-400 hover:text-zinc-200 hover:bg-studio-800/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus / Vibe */}
              <div>
                <label className="block text-zinc-400 font-semibold mb-2">
                  <Flame className="w-3.5 h-3.5 inline mr-1 text-red-400" />
                  Meaningful Story Focus
                </label>
                <div className="flex flex-col gap-1.5">
                  {[
                    { id: 'viral_hooks', label: '🔥 High-Retention Viral Hooks' },
                    { id: 'mindset', label: '💡 Mindset & Breakthrough Insights' },
                    { id: 'funny', label: '😂 Banter & Fun Moments' },
                    { id: 'debate', label: '⚔️ Hot Takes & Controversial Debate' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setOptions({ ...options, focus: f.id })}
                      className={`px-3 py-2 rounded-lg text-left transition font-medium ${
                        options.focus === f.id
                          ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200'
                          : 'bg-studio-850/60 text-zinc-400 hover:text-zinc-200 hover:bg-studio-800/50'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
