import React, { useState } from 'react';
import { 
  Sparkles, Youtube, Clipboard, X, SlidersHorizontal, 
  Clock, Flame, Upload, FileText, ArrowRight, Play, Check 
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
  isLoading, 
  options, 
  setOptions 
}) {
  const [url, setUrl] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [showAltInput, setShowAltInput] = useState(false);
  const [altTab, setAltTab] = useState('paste'); // 'paste' | 'upload'
  const [pastedText, setPastedText] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [copiedSampleId, setCopiedSampleId] = useState(null);

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrl(text.trim());
        }
      }
    } catch {
      // Fallback: focus input
      const el = document.getElementById('youtube-url-input');
      if (el) el.focus();
    }
  };

  const handleSampleClick = (sample) => {
    setUrl(sample.url);
    setCopiedSampleId(sample.id);
    setTimeout(() => setCopiedSampleId(null), 1500);
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (isLoading) return;

    if (showAltInput) {
      if (altTab === 'paste' && pastedText.trim()) {
        onAnalyze({
          transcriptText: pastedText.trim(),
          title: 'Custom Transcript',
          author: 'Pasted Text',
          fileType: 'txt'
        });
        return;
      }

      if (altTab === 'upload' && uploadedFile) {
        const reader = new FileReader();
        const ext = uploadedFile.name.split('.').pop().toLowerCase();
        reader.onload = (event) => {
          onAnalyze({
            transcriptText: event.target.result,
            title: uploadedFile.name.replace(/\.[^/.]+$/, ''),
            author: 'Uploaded File',
            fileType: ext
          });
        };
        reader.readAsText(uploadedFile);
        return;
      }
    }

    if (!url.trim()) return;

    // Extract 11-char YouTube ID
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/|watch\?.+&v=))([\w-]{11})/);
    const videoId = match ? match[1] : (url.trim().length === 11 ? url.trim() : null);

    if (!videoId) {
      alert('Please enter a valid YouTube video link (e.g. https://www.youtube.com/watch?v=...)');
      return;
    }

    onAnalyze({ videoId });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
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
          Paste a video link. ClipScout pinpoints the highest-retention hooks, writes high-CTR titles & trending hashtags, and prepares ready-to-download clips for YouTube Studio.
        </p>
      </div>

      {/* Main Input Card */}
      <div className="relative rounded-2xl bg-studio-900/90 border border-studio-700/80 shadow-2xl backdrop-blur-xl p-4 sm:p-6 transition-all duration-300 hover:border-violet-500/30">
        
        {/* URL Form */}
        {!showAltInput ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* YouTube Icon & Input Field */}
              <div className="relative flex-1 flex items-center">
                <div className="absolute left-4 pointer-events-none flex items-center justify-center">
                  <Youtube className="w-6 h-6 text-red-500" />
                </div>
                <input
                  id="youtube-url-input"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste YouTube podcast link (e.g. https://www.youtube.com/watch?v=...)"
                  className="w-full pl-12 pr-20 py-4 rounded-xl bg-studio-950/80 border border-studio-700 text-white placeholder-zinc-500 text-base focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition shadow-inner"
                  disabled={isLoading}
                />
                
                {/* Clear or Paste Button */}
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

              {/* Generate Shorts Primary Button */}
              <button
                type="submit"
                disabled={isLoading || !url.trim()}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98] text-white font-semibold text-base shadow-lg shadow-violet-600/25 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shrink-0"
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

            {/* Quick Samples Section */}
            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="font-medium text-zinc-500">Try a sample:</span>
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
        ) : (
          /* Alternative Paste / Upload Area */
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-studio-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAltTab('paste')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    altTab === 'paste' 
                      ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4 inline mr-1.5" />
                  Paste Transcript
                </button>
                <button
                  type="button"
                  onClick={() => setAltTab('upload')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    altTab === 'upload' 
                      ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' 
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Upload className="w-4 h-4 inline mr-1.5" />
                  Upload (.srt, .vtt, .txt)
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowAltInput(false)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Back to YouTube Link
              </button>
            </div>

            {altTab === 'paste' ? (
              <div>
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste podcast transcript or dialogue here... (Supports timestamps like 00:01:23 or plain text)"
                  className="w-full p-4 rounded-xl bg-studio-950/80 border border-studio-700 text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                />
                <div className="flex justify-between items-center mt-2 text-xs text-zinc-500">
                  <span>{pastedText.split(/\s+/).filter(Boolean).length} words</span>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading || !pastedText.trim()}
                    className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition disabled:opacity-50"
                  >
                    Analyze Transcript
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-studio-700 rounded-xl p-8 text-center hover:border-violet-500/50 transition">
                <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <p className="text-sm text-zinc-300 font-medium mb-1">
                  {uploadedFile ? uploadedFile.name : 'Choose a transcript file (.srt, .vtt, .txt)'}
                </p>
                <p className="text-xs text-zinc-500 mb-4">Max file size 5MB</p>
                <label className="inline-block px-4 py-2 rounded-lg bg-studio-800 hover:bg-studio-700 text-white text-xs font-semibold cursor-pointer transition">
                  Browse Files
                  <input
                    type="file"
                    accept=".srt,.vtt,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {uploadedFile && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isLoading}
                      className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition"
                    >
                      Extract Shorts from {uploadedFile.name}
                    </button>
                  </div>
                )}
              </div>
            )}
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
            <span className="text-zinc-600">({options.duration} • {options.clipCount} clips)</span>
          </button>

          {!showAltInput && (
            <button
              type="button"
              onClick={() => setShowAltInput(true)}
              className="text-zinc-400 hover:text-violet-300 transition"
            >
              Or upload video/transcript file →
            </button>
          )}
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
                <div className="grid grid-cols-3 gap-2">
                  {[3, 5, 8].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setOptions({ ...options, clipCount: count })}
                      className={`py-2 rounded-lg text-center transition font-medium ${
                        options.clipCount === count
                          ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200'
                          : 'bg-studio-850/60 text-zinc-400 hover:text-zinc-200 hover:bg-studio-800/50'
                      }`}
                    >
                      {count} Clips
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus / Vibe */}
              <div>
                <label className="block text-zinc-400 font-semibold mb-2">
                  <Flame className="w-3.5 h-3.5 inline mr-1 text-red-400" />
                  Hook Focus
                </label>
                <div className="flex flex-col gap-1.5">
                  {[
                    { id: 'viral_hooks', label: '🔥 Maximum Virality' },
                    { id: 'mindset', label: '💡 Mindset & Wisdom' },
                    { id: 'funny', label: '😂 Banter & Fun' },
                    { id: 'debate', label: '⚔️ Hot Takes & Debate' }
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
