import React from 'react';
import { ExternalLink, User, Scissors, Play, RotateCcw, Sparkles } from 'lucide-react';

export default function VideoBanner({ video, clipsCount, onReset }) {
  if (!video) return null;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 mb-8 animate-fade-in">
      <div className="relative rounded-2xl bg-studio-900/90 border border-studio-750 p-4 sm:p-5 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 backdrop-blur-xl">
        
        {/* Left: Thumbnail & Info */}
        <div className="flex items-center gap-4 min-w-0">
          {video.thumbnail && (
            <div className="relative shrink-0 w-28 sm:w-36 aspect-video rounded-xl overflow-hidden bg-studio-950 border border-studio-800 shadow-md">
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover"
              />
              {video.durationText && (
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/85 text-[10px] font-mono text-white rounded font-medium">
                  {video.durationText}
                </div>
              )}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                {clipsCount} Viral Shorts Found
              </span>
              {video.author && (
                <span className="text-xs text-zinc-400 truncate hidden sm:inline">
                  {video.author}
                </span>
              )}
            </div>

            <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-xl">
              {video.title}
            </h2>

            {video.videoId && video.videoId !== 'custom-source' && (
              <a
                href={`https://www.youtube.com/watch?v=${video.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition mt-1"
              >
                <span>Watch full episode</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Right: New Video Action */}
        <div className="shrink-0 flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-studio-800">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-studio-850 hover:bg-studio-800 border border-studio-700/80 text-zinc-200 hover:text-white text-xs font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
            <span>Clip Another Video</span>
          </button>
        </div>

      </div>
    </div>
  );
}
