import React from 'react';
import { Sparkles, AlertTriangle, RotateCcw, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';

/**
 * Loading State with real multi-stage progress indicator
 */
export function LoadingState({ progressMessage, progressPercent = 15 }) {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 mt-8 space-y-6 animate-fade-in">
      
      {/* Progress banner */}
      <div className="rounded-2xl bg-studio-900 border border-amber-500/20 p-6 text-center shadow-xl backdrop-blur-md space-y-3">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-500/10 text-amber-400 animate-pulse">
          <Sparkles className="w-6 h-6 animate-spin-slow" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-white">
          Orchestrating Real Clip Analysis
        </h3>
        <p className="text-xs sm:text-sm text-amber-300 font-mono font-medium min-h-[20px]">
          {progressMessage || 'Processing full transcript across sliding windows...'}
        </p>

        {/* Progress bar */}
        <div className="w-full max-w-md mx-auto bg-studio-950 rounded-full h-2 p-0.5 border border-studio-800 overflow-hidden">
          <div
            className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
          />
        </div>
        <span className="text-[10px] text-zinc-500 font-mono block">
          Evaluating transcript & campaign rules without hallucinations
        </span>
      </div>

      {/* Shimmering Skeleton Cards */}
      <div className="space-y-4">
        {[1, 2].map((n) => (
          <div
            key={n}
            className="rounded-2xl bg-studio-900 border border-studio-800 p-6 space-y-4 animate-pulse"
          >
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-studio-800 rounded-lg" />
                <div className="w-40 h-7 bg-studio-800 rounded-xl" />
              </div>
              <div className="w-24 h-7 bg-studio-800 rounded-xl" />
            </div>
            <div className="w-3/4 h-5 bg-studio-800 rounded-md" />
            <div className="w-full h-12 bg-studio-850 rounded-xl" />
          </div>
        ))}
      </div>

    </div>
  );
}

/**
 * Honest Error State with exact diagnostic reason and clear actions
 */
export function ErrorState({ error, onRetry, onSwitchToPaste }) {
  const isNoCaptions = error?.toLowerCase().includes('caption') || error?.toLowerCase().includes('transcript');
  const isRateLimit = error?.toLowerCase().includes('rate limit') || error?.includes('429');
  const isPasscode = error?.toLowerCase().includes('passcode') || error?.includes('401');

  return (
    <div className="w-full max-w-2xl mx-auto px-4 mt-8 animate-fade-in">
      <div className="rounded-2xl bg-studio-900 border border-red-500/30 p-6 sm:p-8 text-center shadow-2xl space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-white">
          {isNoCaptions
            ? 'Captions Disabled on Video'
            : isRateLimit
            ? 'AI Engine Rate Limit (429)'
            : isPasscode
            ? 'Passcode Protected'
            : 'Analysis Failed'}
        </h3>

        <div className="bg-studio-950 p-4 rounded-xl border border-studio-800 text-left space-y-1.5 text-xs text-zinc-300 font-mono">
          <span className="text-zinc-500 text-[10px] uppercase font-bold block">Diagnostic Error Details:</span>
          <p className="text-red-300">{error || 'An unexpected server error occurred.'}</p>
        </div>

        {isNoCaptions && (
          <p className="text-xs text-zinc-400 leading-relaxed max-w-md mx-auto">
            ClipScout strictly parses authentic spoken dialogue. Since YouTube captions are disabled for this video, you can paste or upload the transcript directly.
          </p>
        )}

        {isRateLimit && (
          <p className="text-xs text-zinc-400 leading-relaxed max-w-md mx-auto">
            The free-tier Groq token/minute threshold was reached. Wait 10-20 seconds and click Retry below.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-studio-950 text-xs sm:text-sm font-bold transition shadow-md active:scale-95"
            >
              <RotateCcw className="w-4 h-4 text-studio-950" />
              <span>Retry Analysis</span>
            </button>
          )}

          {isNoCaptions && onSwitchToPaste && (
            <button
              type="button"
              onClick={onSwitchToPaste}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-studio-800 hover:bg-studio-750 text-white text-xs sm:text-sm font-semibold border border-studio-700 transition"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Paste / Upload Transcript</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Idle State shown when no video has been scouted yet in the clips tab
 */
export function EmptyClipsState({ onGoToSource, campaignName }) {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 mt-12 text-center space-y-4 animate-fade-in">
      <div className="p-8 rounded-2xl bg-studio-900 border border-studio-800 space-y-3">
        <h3 className="text-base font-bold text-white">No Clips Scouted Yet</h3>
        <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
          Provide a YouTube link or paste a transcript for <span className="text-amber-400 font-semibold">{campaignName}</span> in Step 2: Source to begin extracting clips.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onGoToSource}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-studio-950 font-bold text-xs sm:text-sm transition shadow-md shadow-amber-500/20"
          >
            <span>Proceed to Step 2: Source</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
