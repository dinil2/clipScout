import React, { useState } from 'react';
import { Search, Sparkles, Clipboard, X, Loader2, ArrowRight } from 'lucide-react';
import { extractYouTubeVideoId } from '../utils/youtube';

const SAMPLE_VIDEOS = [
  {
    title: 'Steve Jobs 2005 Speech',
    url: 'https://www.youtube.com/watch?v=UF8uR6Z6KLc'
  },
  {
    title: 'Rick Astley - Never Gonna Give You Up',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  },
  {
    title: 'Veritasium - The Science of Thinking',
    url: 'https://www.youtube.com/watch?v=UBVV8pch1Rs'
  }
];

export default function UrlInput({ onSubmit, isLoading, currentUrl, onUrlChange }) {
  const [validationError, setValidationError] = useState('');

  const handleInputChange = (e) => {
    const val = e.target.value;
    onUrlChange(val);
    if (validationError) setValidationError('');
  };

  const handleClear = () => {
    onUrlChange('');
    setValidationError('');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onUrlChange(text.trim());
        setValidationError('');
      }
    } catch (err) {
      console.warn('Clipboard read failed:', err);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (isLoading) return;

    const trimmed = (currentUrl || '').trim();
    if (!trimmed) {
      setValidationError('Please paste a YouTube video or livestream link.');
      return;
    }

    const videoId = extractYouTubeVideoId(trimmed);
    if (!videoId) {
      setValidationError('Please enter a valid YouTube URL (e.g. youtube.com/watch?v=... or youtu.be/...).');
      return;
    }

    setValidationError('');
    onSubmit(videoId, trimmed);
  };

  const handleSelectSample = (sampleUrl) => {
    onUrlChange(sampleUrl);
    setValidationError('');
    const videoId = extractYouTubeVideoId(sampleUrl);
    if (videoId) {
      onSubmit(videoId, sampleUrl);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      <form onSubmit={handleSubmit} className="relative group">
        <div className={`relative flex flex-col sm:flex-row items-stretch sm:items-center rounded-2xl bg-studio-900 border ${
          validationError 
            ? 'border-red-500/70 shadow-lg shadow-red-500/10 ring-2 ring-red-500/20' 
            : 'border-studio-700 hover:border-studio-600 focus-within:border-amber-500/80 focus-within:ring-2 focus-within:ring-amber-500/20 shadow-xl'
        } transition-all duration-200 p-2 sm:p-2.5 gap-2`}>
          
          {/* Input Area */}
          <div className="flex-1 flex items-center gap-3 px-3 py-1.5 sm:py-0 min-w-0">
            <Search className="w-5 h-5 text-zinc-500 shrink-0" />
            <input
              type="text"
              value={currentUrl}
              onChange={handleInputChange}
              placeholder="Paste YouTube video or livestream link (e.g. https://youtu.be/...)"
              disabled={isLoading}
              className="w-full bg-transparent text-sm sm:text-base text-zinc-100 placeholder-zinc-500 focus:outline-none disabled:opacity-60 font-normal"
            />
            {currentUrl && !isLoading && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-studio-800 transition"
                title="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {!currentUrl && !isLoading && (
              <button
                type="button"
                onClick={handlePaste}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-400 bg-studio-800 hover:bg-studio-700 hover:text-zinc-200 rounded-md transition"
                title="Paste from clipboard"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Paste</span>
              </button>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !currentUrl.trim()}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-studio-950 font-semibold text-sm shadow-md shadow-amber-500/20 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 active:scale-[0.98]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-studio-950" />
                <span>Scouting Clips...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-studio-950" />
                <span>Analyze</span>
                <ArrowRight className="w-4 h-4 hidden sm:inline-block" />
              </>
            )}
          </button>
        </div>

        {/* Validation Error Message */}
        {validationError && (
          <p className="mt-2 text-xs sm:text-sm text-red-400 font-medium px-2 flex items-center gap-1.5 animate-fade-in">
            <span>⚠️</span> {validationError}
          </p>
        )}
      </form>

      {/* Quick Test Samples */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-500">
        <span className="font-medium text-zinc-400">Try a sample:</span>
        {SAMPLE_VIDEOS.map((sample, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSelectSample(sample.url)}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-lg bg-studio-900 border border-studio-800 hover:border-amber-500/40 hover:text-amber-300 text-zinc-400 transition text-left truncate max-w-[220px]"
            title={sample.url}
          >
            {sample.title}
          </button>
        ))}
      </div>
    </div>
  );
}
