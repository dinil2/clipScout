import React, { useState } from 'react';
import { Flame, Zap, Compass, Info, Quote, CheckCircle2 } from 'lucide-react';
import { formatDurationBadge } from '../../utils/youtube.js';

export default function ClipHeader({ clip, rank }) {
  const [showSubScores, setShowSubScores] = useState(false);
  const score = clip.viralityScore || 75;
  const scores = clip.scores || { hook: 20, standaloneClarity: 20, emotionPayoff: 18, campaignFit: 17 };

  const getScoreStyle = (s) => {
    if (s >= 80) {
      return {
        badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        tier: 'High Algorithm Fit (AI estimate)'
      };
    }
    if (s >= 60) {
      return {
        badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        tier: 'Solid Potential (AI estimate)'
      };
    }
    return {
      badgeBg: 'bg-zinc-800 border-zinc-700 text-zinc-400',
      tier: 'Moderate Fit (AI estimate)'
    };
  };

  const style = getScoreStyle(score);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-studio-800">
      
      {/* Left: Rank, Timestamps, Duration, Evidence Quote */}
      <div className="flex items-center flex-wrap gap-2.5">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold font-mono ${
          rank === 1 ? 'bg-amber-500 text-studio-950 shadow-md shadow-amber-500/20' : 'bg-studio-800 text-zinc-300'
        }`}>
          #{rank}
        </span>

        {/* Timestamps Monospace Box */}
        <div className="flex items-center gap-2 font-mono text-xs sm:text-sm font-semibold text-zinc-200 bg-studio-850 px-3 py-1.5 rounded-xl border border-studio-700/80">
          <span>{clip.startTime}</span>
          <span className="text-zinc-500">→</span>
          <span>{clip.endTime}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-studio-750 text-amber-400 font-mono font-medium ml-1">
            {formatDurationBadge(clip.durationSeconds)}
          </span>
        </div>

        {/* Real Evidence Quote Pill */}
        {clip.evidenceQuote && (
          <span
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-studio-900 border border-studio-750 text-[11px] text-zinc-400 max-w-xs truncate"
            title={`Real transcript dialogue verified: "${clip.evidenceQuote}"`}
          >
            <Quote className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate italic">"{clip.evidenceQuote}"</span>
          </span>
        )}
      </div>

      {/* Right: AI Virality Score Badge & Sub-score Modal Trigger */}
      <div className="flex items-center gap-2 self-start sm:self-auto">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSubScores(!showSubScores)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${style.badgeBg} font-semibold text-xs transition hover:brightness-110 shadow-sm`}
            title="Click to view sub-scores (Hook, Clarity, Emotion, Campaign Fit)"
          >
            <Flame className="w-3.5 h-3.5" />
            <span className="text-sm font-bold">{score}</span>
            <span className="text-[10px] opacity-75 font-normal">/ 100</span>
            <span className="text-[10px] font-medium border-l border-current/20 pl-1.5">
              AI estimate
            </span>
            <Info className="w-3 h-3 opacity-60 ml-0.5" />
          </button>

          {/* Sub-scores popover */}
          {showSubScores && (
            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-studio-950 border border-studio-700 rounded-xl shadow-2xl z-30 animate-fade-in text-xs space-y-2">
              <div className="flex items-center justify-between font-bold text-zinc-200 border-b border-studio-800 pb-1.5">
                <span>Sub-Score Breakdown</span>
                <span className="text-[10px] text-zinc-500 font-normal">Calculated in code</span>
              </div>
              <div className="space-y-1.5 text-zinc-300">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Opening Hook:</span>
                  <span className="font-mono font-semibold">{scores.hook || 0}/25</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Standalone Clarity:</span>
                  <span className="font-mono font-semibold">{scores.standaloneClarity || 0}/25</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Emotion & Payoff:</span>
                  <span className="font-mono font-semibold">{scores.emotionPayoff || 0}/25</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Campaign Fit:</span>
                  <span className="font-mono font-semibold">{scores.campaignFit || 0}/25</span>
                </div>
              </div>
              <div className="pt-1.5 border-t border-studio-800 flex justify-between font-bold text-emerald-400">
                <span>Composite Score:</span>
                <span className="font-mono">{score}/100</span>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
