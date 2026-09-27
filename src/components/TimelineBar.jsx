import React, { useState } from 'react';
import { Clock, Sparkles, Flame, Zap } from 'lucide-react';

export default function TimelineBar({ clips = [], durationSeconds = 0, onSelectClip }) {
  const [hoveredClip, setHoveredClip] = useState(null);

  if (!durationSeconds || durationSeconds <= 0 || !clips.length) return null;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 mt-4">
      <div className="bg-studio-900 border border-studio-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-zinc-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Livestream Timeline Distribution</span>
            <span className="text-zinc-500 font-normal">({clips.length} viral candidate moments mapped across entire stream)</span>
          </div>
          <span className="font-mono text-zinc-400 text-[11px]">
            00:00 → {clips[0]?.endTime ? clips[clips.length - 1]?.endTime : ''}
          </span>
        </div>

        {/* Phase Bands Indicator */}
        <div className="grid grid-cols-4 gap-1 text-[10px] text-zinc-500 font-medium mb-1.5 uppercase tracking-wider px-1">
          <span>Early Hook (0-25%)</span>
          <span className="text-center">Mid Escalation (25-60%)</span>
          <span className="text-center">Late Turn (60-85%)</span>
          <span className="text-right">Climax (85-100%)</span>
        </div>

        {/* Scrubber Track */}
        <div className="relative h-6 bg-studio-950 rounded-xl border border-studio-800 p-0.5 overflow-visible">
          {/* Phase dividers */}
          <div className="absolute top-0 bottom-0 left-[25%] w-px bg-studio-800/80 pointer-events-none" />
          <div className="absolute top-0 bottom-0 left-[60%] w-px bg-studio-800/80 pointer-events-none" />
          <div className="absolute top-0 bottom-0 left-[85%] w-px bg-studio-800/80 pointer-events-none" />

          {/* Clip Pin Markers */}
          {clips.map((clip, idx) => {
            const startPct = Math.min(98, Math.max(0.5, (clip.startSeconds / durationSeconds) * 100));
            const isHigh = clip.viralityScore >= 80;
            const isMid = clip.viralityScore >= 50 && clip.viralityScore < 80;

            return (
              <button
                key={clip.id || idx}
                type="button"
                onClick={() => onSelectClip && onSelectClip(clip.id || idx)}
                onMouseEnter={() => setHoveredClip(clip)}
                onMouseLeave={() => setHoveredClip(null)}
                style={{ left: `${startPct}%` }}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-125 hover:z-20 cursor-pointer shadow-md ${
                  isHigh
                    ? 'bg-emerald-500 text-studio-950 ring-2 ring-emerald-500/30'
                    : isMid
                    ? 'bg-amber-500 text-studio-950 ring-2 ring-amber-500/30'
                    : 'bg-zinc-600 text-zinc-200'
                }`}
                title={`#${idx + 1}: ${clip.title} (${clip.startTime} - ${clip.endTime})`}
              >
                <span className="text-[8px] font-bold font-mono">
                  {idx + 1}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tooltip / Active Highlight */}
        <div className="mt-2.5 min-h-[24px] flex items-center justify-between text-xs text-zinc-400">
          {hoveredClip ? (
            <div className="flex items-center gap-2 truncate animate-fade-in">
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                {hoveredClip.startTime} - {hoveredClip.endTime}
              </span>
              <span className="font-semibold text-white truncate max-w-sm">
                {hoveredClip.title}
              </span>
              <span className="text-zinc-500">•</span>
              <span className="text-emerald-400 font-medium">
                {hoveredClip.viralityScore}/100 Virality
              </span>
              {hoveredClip.category && (
                <span className="text-xs text-zinc-400">({hoveredClip.category})</span>
              )}
            </div>
          ) : (
            <span className="text-zinc-500 text-[11px]">
              💡 Hover over any numbered marker to preview moment • Click to jump directly to card
            </span>
          )}

          <div className="flex items-center gap-3 shrink-0 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> High (80+)
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Solid (50-79)
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
