import React, { useState } from 'react';
import { 
  Youtube, FileText, Upload, Sparkles, Loader2, ArrowRight, 
  Search, X, Clipboard, AlertCircle, CheckCircle2, SlidersHorizontal 
} from 'lucide-react';
import { extractYouTubeVideoId } from '../utils/youtube.js';

const SAMPLE_VIDEOS = [
  {
    title: 'Steve Jobs 2005 Stanford Commencement',
    url: 'https://www.youtube.com/watch?v=UF8uR6Z6KLc'
  },
  {
    title: 'Veritasium - The Science of Thinking',
    url: 'https://www.youtube.com/watch?v=UBVV8pch1Rs'
  },
  {
    title: 'Rick Astley - Never Gonna Give You Up',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  }
];

export default function SourceStep({
  onSubmitSource,
  isLoading,
  campaign,
  captionError,
  onClearCaptionError,
  clipCount,
  onChangeClipCount
}) {
  const [sourceMode, setSourceMode] = useState('youtube'); // 'youtube' | 'paste' | 'upload'
  const [url, setUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleUrlSubmit = (e) => {
    e?.preventDefault();
    if (isLoading) return;
    setValidationError('');
    if (onClearCaptionError) onClearCaptionError();

    const trimmed = url.trim();
    if (!trimmed) {
      setValidationError('Please enter a YouTube video URL.');
      return;
    }

    const videoId = extractYouTubeVideoId(trimmed);
    if (!videoId) {
      setValidationError('Please enter a valid YouTube link (e.g. https://youtu.be/... or youtube.com/watch?v=...).');
      return;
    }

    onSubmitSource({
      type: 'youtube',
      videoId,
      url: trimmed
    });
  };

  const handleTextSubmit = (e) => {
    e?.preventDefault();
    if (isLoading) return;
    setValidationError('');
    if (onClearCaptionError) onClearCaptionError();

    const trimmed = pastedText.trim();
    if (!trimmed || trimmed.length < 50) {
      setValidationError('Please paste a substantial transcript (at least 50 characters).');
      return;
    }

    onSubmitSource({
      type: 'text',
      transcriptText: trimmed,
      title: customTitle.trim() || 'Uploaded Transcript',
      author: customAuthor.trim() || 'Creator',
      fileType: 'text'
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setValidationError('');
    if (onClearCaptionError) onClearCaptionError();

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setPastedText(content);
        setCustomTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsText(file);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setValidationError('');
      }
    } catch {}
  };

  return (
    <section className="w-full max-w-4xl mx-auto px-4 mt-6 animate-fade-in space-y-5">
      
      {/* Active Campaign Reminder Header */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-studio-900 border border-studio-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 font-medium">Active Campaign:</span>
          <span className="font-bold text-amber-400">{campaign.name}</span>
          <span className="text-zinc-600">•</span>
          <span className="font-mono text-emerald-400 font-semibold">${Number(campaign.cpmRate || 0).toFixed(2)} CPM</span>
          <span className="text-zinc-600">•</span>
          <span className="font-mono text-zinc-400">${Number(campaign.perClipMax || 0).toFixed(2)} Cap</span>
        </div>

        {/* Clip count target */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-zinc-400">Target:</span>
          <select
            value={clipCount}
            onChange={(e) => onChangeClipCount(parseInt(e.target.value, 10))}
            className="bg-studio-950 border border-studio-700 text-zinc-200 font-mono text-xs rounded-lg px-2 py-1"
          >
            {[5, 8, 10, 12, 15].map(n => (
              <option key={n} value={n}>{n} clips</option>
            ))}
          </select>
        </div>
      </div>

      {/* Caption Error Notice & Mode Switcher CTA */}
      {captionError && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs sm:text-sm animate-fade-in space-y-2">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300">Closed Captions Unavailable on YouTube</p>
              <p className="text-xs text-amber-200/90 mt-0.5 leading-relaxed">
                ClipScout avoids hallucinating or inventing timestamps. To analyze this video accurately, you can paste its transcript or upload a .srt/.vtt file below.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSourceMode('paste');
              if (onClearCaptionError) onClearCaptionError();
            }}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-studio-950 font-bold text-xs transition hover:bg-amber-400 shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Switch to Paste / Upload Transcript</span>
          </button>
        </div>
      )}

      {/* Source Selection Tabs */}
      <div className="flex items-center gap-2 border-b border-studio-800 pb-2">
        <button
          type="button"
          onClick={() => { setSourceMode('youtube'); setValidationError(''); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
            sourceMode === 'youtube'
              ? 'bg-amber-500 text-studio-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-studio-900'
          }`}
        >
          <Youtube className="w-4 h-4" />
          <span>YouTube URL</span>
        </button>

        <button
          type="button"
          onClick={() => { setSourceMode('paste'); setValidationError(''); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
            sourceMode === 'paste'
              ? 'bg-amber-500 text-studio-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-studio-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Paste Transcript</span>
        </button>

        <button
          type="button"
          onClick={() => { setSourceMode('upload'); setValidationError(''); }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
            sourceMode === 'upload'
              ? 'bg-amber-500 text-studio-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-studio-900'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Upload .SRT / .VTT</span>
        </button>
      </div>

      {/* Mode A: YouTube URL */}
      {sourceMode === 'youtube' && (
        <form onSubmit={handleUrlSubmit} className="space-y-4">
          <div className={`flex flex-col sm:flex-row items-stretch sm:items-center rounded-2xl bg-studio-900 border ${
            validationError ? 'border-red-500/60 ring-2 ring-red-500/20' : 'border-studio-700 hover:border-studio-600 focus-within:border-amber-500'
          } p-2 sm:p-2.5 gap-2 transition`}>
            <div className="flex-1 flex items-center gap-3 px-3 min-w-0">
              <Search className="w-5 h-5 text-zinc-500 shrink-0" />
              <input
                type="text"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setValidationError(''); }}
                placeholder="Paste YouTube video or livestream link (e.g. https://youtu.be/...)"
                disabled={isLoading}
                className="w-full bg-transparent text-sm sm:text-base text-zinc-100 placeholder-zinc-500 focus:outline-none"
              />
              {url && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="p-1 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {!url && (
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs text-zinc-400 bg-studio-800 hover:bg-studio-750 rounded-md"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  <span>Paste</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-studio-950 font-bold text-sm transition shadow-md shadow-amber-500/20 disabled:opacity-40 shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-studio-950" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-studio-950" />
                  <span>Scout Moments</span>
                  <ArrowRight className="w-4 h-4 hidden sm:inline-block" />
                </>
              )}
            </button>
          </div>

          {validationError && (
            <p className="text-xs text-red-400 font-medium px-2">⚠️ {validationError}</p>
          )}

          {/* Quick Samples */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 pt-1">
            <span className="font-medium text-zinc-400">Try a sample:</span>
            {SAMPLE_VIDEOS.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setUrl(s.url);
                  setValidationError('');
                  const videoId = extractYouTubeVideoId(s.url);
                  if (videoId) onSubmitSource({ type: 'youtube', videoId, url: s.url });
                }}
                className="px-2.5 py-1 rounded-lg bg-studio-900 border border-studio-800 hover:border-amber-500/40 hover:text-amber-300 text-zinc-400 transition truncate max-w-[220px]"
              >
                {s.title}
              </button>
            ))}
          </div>
        </form>
      )}

      {/* Mode B: Paste Transcript */}
      {sourceMode === 'paste' && (
        <form onSubmit={handleTextSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Video or Audio Title (optional)"
              className="bg-studio-900 border border-studio-750 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
            <input
              type="text"
              value={customAuthor}
              onChange={(e) => setCustomAuthor(e.target.value)}
              placeholder="Creator / Speaker Name (optional)"
              className="bg-studio-900 border border-studio-750 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <textarea
              rows={8}
              value={pastedText}
              onChange={(e) => { setPastedText(e.target.value); setValidationError(''); }}
              placeholder="Paste dialogue transcript here. Supports timestamped lines (e.g. [01:23] Hello) or plain text..."
              className="w-full bg-studio-900 border border-studio-750 rounded-xl p-4 text-xs sm:text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono leading-relaxed"
            />
            <div className="flex items-center justify-between mt-1 text-[11px] text-zinc-500 px-1">
              <span>{pastedText.length.toLocaleString()} characters</span>
              <span>Accepts plain text, [mm:ss] lines, SRT or VTT</span>
            </div>
          </div>

          {validationError && (
            <p className="text-xs text-red-400 font-medium px-2">⚠️ {validationError}</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isLoading || !pastedText.trim()}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-studio-950 font-bold text-sm transition shadow-md shadow-amber-500/20 disabled:opacity-40"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-studio-950" />
                  <span>Analyzing Transcript...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-studio-950" />
                  <span>Scout Moments from Transcript</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Mode C: Upload File */}
      {sourceMode === 'upload' && (
        <div className="space-y-4">
          <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-studio-750 hover:border-amber-500/60 rounded-2xl bg-studio-900/60 cursor-pointer transition text-center group">
            <Upload className="w-8 h-8 text-zinc-500 group-hover:text-amber-400 transition mb-2" />
            <span className="text-sm font-semibold text-zinc-200 group-hover:text-white">
              {uploadedFileName ? `Selected: ${uploadedFileName}` : 'Click or Drag & Drop .srt, .vtt, or .txt file'}
            </span>
            <span className="text-xs text-zinc-500 mt-1">
              Directly parses timestamps and dialogue lines
            </span>
            <input
              type="file"
              accept=".srt,.vtt,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {pastedText && (
            <div className="p-4 rounded-2xl bg-studio-900 border border-studio-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Loaded {uploadedFileName || 'file'}</span>
                </span>
                <span className="text-zinc-500 font-mono">{pastedText.length.toLocaleString()} characters</span>
              </div>
              <div className="max-h-32 overflow-y-auto font-mono text-[11px] text-zinc-400 bg-studio-950 p-2.5 rounded-lg border border-studio-800 whitespace-pre-wrap">
                {pastedText.slice(0, 500)}...
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleTextSubmit}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-studio-950 font-bold text-xs sm:text-sm transition shadow-md shadow-amber-500/20"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-studio-950" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-studio-950" />
                      <span>Scout Moments from File</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </section>
  );
}
