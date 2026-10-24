import React from 'react';
import { Sparkles, CheckCircle2, Film, Brain, Scissors, Share2 } from 'lucide-react';

const STAGES = [
  {
    id: 1,
    title: 'Connecting & Extracting Speech',
    desc: 'Fetching YouTube transcript and audio timeline...',
    icon: Film
  },
  {
    id: 2,
    title: 'Detecting Viral Hooks',
    desc: 'Scanning full conversation for curiosity gaps and pattern interrupts...',
    icon: Brain
  },
  {
    id: 3,
    title: 'Snapping Sentence Boundaries',
    desc: 'Locking clip start and end timestamps to natural speech cadence...',
    icon: Scissors
  },
  {
    id: 4,
    title: 'Packaging for YouTube Studio',
    desc: 'Crafting high-CTR titles, trending hashtags & .SRT captions...',
    icon: Share2
  }
];

export default function ProcessingState({ progress, videoData, onCancel }) {
  const percent = Math.min(100, Math.max(5, progress.percent || 15));

  // Determine current active stage index (0 to 3)
  let currentStageIndex = 0;
  if (percent >= 80) currentStageIndex = 3;
  else if (percent >= 50) currentStageIndex = 2;
  else if (percent >= 25) currentStageIndex = 1;

  return (
    <div className="w-full max-w-3xl mx-auto py-12 px-4 animate-fade-in">
      <div className="rounded-2xl bg-studio-900/90 border border-studio-700 shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-studio-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-violet-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Analyzing Podcast</h3>
              <p className="text-xs text-zinc-400">Finding the best moments to turn into YouTube Shorts</p>
            </div>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Video Preview Card if available */}
        {videoData && (
          <div className="flex items-center gap-4 p-3 rounded-xl bg-studio-950/60 border border-studio-800 mb-6">
            {videoData.thumbnail && (
              <img
                src={videoData.thumbnail}
                alt="Thumbnail"
                className="w-20 h-14 object-cover rounded-lg border border-studio-700 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-white truncate">{videoData.title}</h4>
              <p className="text-xs text-zinc-400 truncate">{videoData.author} {videoData.durationText && `• ${videoData.durationText}`}</p>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center text-xs text-zinc-400 mb-2 font-medium">
            <span className="text-violet-300 font-semibold">{progress.message || 'Analyzing audio...'}</span>
            <span>{Math.round(percent)}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-studio-950 overflow-hidden border border-studio-800/80">
            <div
              className="h-full bg-gradient-to-r from-violet-600 via-indigo-500 to-emerald-400 transition-all duration-500 ease-out rounded-full shadow-lg shadow-violet-600/30"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Stages Stepper */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STAGES.map((stg, idx) => {
            const isCompleted = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;
            const Icon = stg.icon;

            return (
              <div
                key={stg.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-300 ${
                  isCurrent
                    ? 'bg-violet-950/20 border-violet-500/40 shadow-sm'
                    : isCompleted
                    ? 'bg-studio-950/40 border-emerald-500/20 text-zinc-300'
                    : 'bg-studio-950/20 border-studio-800/50 opacity-50'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <div className="w-4 h-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4 text-zinc-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${isCurrent ? 'text-violet-300' : isCompleted ? 'text-zinc-200' : 'text-zinc-500'}`}>
                    {stg.title}
                  </p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {stg.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
