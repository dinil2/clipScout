import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Flame, 
  Scissors, 
  Clock, 
  Copy, 
  AlertTriangle, 
  History, 
  RotateCcw, 
  ExternalLink,
  Sparkles,
  FileText,
  CheckCircle2
} from 'lucide-react';

/**
 * Idle State: Shown when no video is analyzed yet
 */
export function IdleState({ history = [], onSelectHistory, onClearHistory }) {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 mt-12 space-y-10">
      
      {/* 3 Core Value Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="glass-panel p-5 rounded-2xl border border-studio-800 flex flex-col items-start text-left">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
            <Flame className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base">Hook-First Virality</h3>
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed font-normal">
            Algorithms scan for curiosity gaps, emotional peaks, and punchlines that keep retention high in the first 3 seconds.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-studio-800 flex flex-col items-start text-left">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base">Strict 15–58s Limits</h3>
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed font-normal">
            Never exceeds YouTube Shorts' 60s hard ceiling. Every segment is trimmed to a complete, standalone thought.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-studio-800 flex flex-col items-start text-left">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
            <Copy className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-base">1-Click Publish Kit</h3>
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed font-normal">
            Get hook titles, Shorts-tailored descriptions, and trending tags in one copy-ready bundle for YouTube Studio.
          </p>
        </div>
      </div>

      {/* History section if available */}
      {history && history.length > 0 && (
        <div className="pt-6 border-t border-studio-850">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
              <History className="w-4 h-4 text-amber-400" />
              <span>Recent Analyses (Saved Locally)</span>
            </div>
            <button
              onClick={onClearHistory}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition underline underline-offset-2"
            >
              Clear History
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {history.slice(0, 4).map((item, idx) => (
              <button
                key={idx}
                onClick={() => onSelectHistory(item)}
                className="flex items-center gap-3 p-3 rounded-xl bg-studio-900 hover:bg-studio-850 border border-studio-800 hover:border-studio-700 text-left transition group"
              >
                <img
                  src={item.video?.thumbnail}
                  alt={item.video?.title}
                  className="w-16 h-10 object-cover rounded-lg bg-studio-950 shrink-0"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-200 truncate group-hover:text-amber-300 transition-colors">
                    {item.video?.title}
                  </p>
                  <p className="text-[11px] text-zinc-500 flex items-center gap-2 mt-0.5 font-mono">
                    <span>{item.clips?.length || 0} clips</span>
                    <span>•</span>
                    <span>{item.video?.author}</span>
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* How It Works Guide */}
      <div className="text-center pt-2">
        <p className="text-xs text-zinc-500">
          Works with public YouTube videos and livestreams that have English subtitles or auto-captions enabled.
        </p>
      </div>

    </div>
  );
}

/**
 * Loading State: Rotating status messages + Shimmer Skeleton Cards
 */
export function LoadingState() {
  const steps = [
    'Connecting to YouTube & fetching video metadata...',
    'Extracting timed transcript & speech chunks...',
    'AI analyzing hook strength, punchlines & emotional peaks...',
    'Calculating 15–58s virality scores & craft metadata...',
    'Finalizing clips and ranked sorting...'
  ];

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 mt-8 space-y-6 animate-fade-in">
      
      {/* Progress banner */}
      <div className="rounded-2xl bg-studio-900/90 border border-amber-500/20 p-5 text-center shadow-xl backdrop-blur-md">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-500/10 text-amber-400 mb-3 animate-pulse">
          <Sparkles className="w-6 h-6 animate-spin-slow" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-white mb-1">
          Scouting Viral Moments
        </h3>
        <p className="text-xs sm:text-sm text-amber-300/90 font-medium h-5 transition-all duration-300">
          {steps[currentStepIndex]}
        </p>

        {/* Stepped mini bar */}
        <div className="flex items-center justify-center gap-1.5 mt-4 max-w-xs mx-auto">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                i <= currentStepIndex ? 'bg-amber-400' : 'bg-studio-800'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Shimmering Skeleton Cards */}
      <div className="space-y-4">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="rounded-2xl bg-studio-900 border border-studio-800 p-6 space-y-4 animate-pulse"
          >
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-studio-800 rounded-lg"></div>
                <div className="w-40 h-7 bg-studio-800 rounded-xl"></div>
                <div className="w-24 h-7 bg-studio-800 rounded-xl"></div>
              </div>
              <div className="w-28 h-7 bg-studio-800 rounded-xl"></div>
            </div>

            <div className="w-3/4 h-5 bg-studio-800 rounded-md"></div>
            <div className="w-1/2 h-4 bg-studio-800/60 rounded-md"></div>
            <div className="w-full h-14 bg-studio-850 rounded-xl"></div>

            <div className="flex justify-between items-center pt-2">
              <div className="flex gap-2">
                <div className="w-16 h-6 bg-studio-800 rounded-lg"></div>
                <div className="w-16 h-6 bg-studio-800 rounded-lg"></div>
                <div className="w-16 h-6 bg-studio-800 rounded-lg"></div>
              </div>
              <div className="w-32 h-8 bg-studio-800 rounded-xl"></div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

/**
 * Error State: Friendly diagnostic guidance
 */
export function ErrorState({ error, onReset }) {
  const isCaptionsDisabled = error?.toLowerCase().includes('caption') || error?.toLowerCase().includes('transcript');

  return (
    <div className="w-full max-w-2xl mx-auto px-4 mt-12 animate-fade-in">
      <div className="rounded-2xl bg-studio-900 border border-red-500/30 p-6 sm:p-8 text-center shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
          {isCaptionsDisabled ? 'No Captions Available' : 'Analysis Failed'}
        </h3>

        <p className="text-sm text-zinc-300 leading-relaxed max-w-md mx-auto mb-6">
          {error || 'Unable to complete video analysis. Please check the URL and try again.'}
        </p>

        {isCaptionsDisabled && (
          <div className="text-left bg-studio-950 p-4 rounded-xl border border-studio-800 mb-6 text-xs text-zinc-400 space-y-1.5">
            <p className="font-semibold text-zinc-300">💡 Why did this happen?</p>
            <p>• YouTube creator has turned off closed captions and automatic captions.</p>
            <p>• Try podcasts, interviews, keynote speeches, or educational videos where captions are active.</p>
          </div>
        )}

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-studio-800 hover:bg-studio-700 text-white text-sm font-semibold border border-studio-700 transition active:scale-95 shadow-md"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Try Another Video</span>
        </button>
      </div>
    </div>
  );
}
