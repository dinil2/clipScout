import React from 'react';
import { ExternalLink, User, Clock, Scissors, Play, Radio, Sparkles } from 'lucide-react';

export default function VideoBanner({ video, clipsCount, onReset, isLivestreamArc, notice }) {
  if (!video) return null;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 mt-8 space-y-3">
      {/* Livestream Notice if captions were unavailable */}
      {isLivestreamArc && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs sm:text-sm text-purple-200 animate-fade-in shadow-sm">
          <Radio className="w-4 h-4 text-purple-400 shrink-0 animate-pulse" />
          <p className="flex-1 font-medium">
            <span className="font-semibold text-purple-300">Livestream Milestone Engine:</span>{' '}
            {notice || 'Captions are not available on this stream. ClipScout analyzed stream duration and narrative pacing to scout high-probability viral milestones.'}
          </p>
        </div>
      )}

      <div className="relative rounded-2xl bg-studio-900 border border-studio-700/80 p-4 sm:p-5 shadow-xl backdrop-blur-sm overflow-hidden flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
        
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-64 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Thumbnail with overlay */}
        <a
          href={`https://www.youtube.com/watch?v=${video.videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="relative group shrink-0 w-full sm:w-48 aspect-video rounded-xl overflow-hidden bg-studio-950 border border-studio-800 shadow-md block"
          title="Open original video on YouTube"
        >
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.target.src = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
            }}
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-amber-500/90 text-studio-950 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </div>
          </div>
          {video.durationText && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 backdrop-blur-sm text-[11px] font-mono text-white rounded font-medium">
              {video.durationText}
            </div>
          )}
        </a>

        {/* Video Information */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
              <Scissors className="w-3 h-3" />
              {clipsCount} Shorts Found
            </span>
            {isLivestreamArc && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-semibold">
                <Radio className="w-3 h-3" />
                Live Arc
              </span>
            )}
            {video.author && (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-400 font-medium truncate max-w-[200px]">
                <User className="w-3 h-3 text-zinc-500" />
                {video.author}
              </span>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-bold text-white leading-snug line-clamp-2 hover:text-amber-300 transition-colors">
            <a
              href={`https://www.youtube.com/watch?v=${video.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline flex items-center gap-1.5"
            >
              <span>{video.title}</span>
              <ExternalLink className="w-3.5 h-3.5 inline text-zinc-500 shrink-0" />
            </a>
          </h2>

          <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500 font-mono">
            <span>ID: {video.videoId}</span>
            <span>•</span>
            <button
              onClick={onReset}
              className="text-zinc-400 hover:text-amber-400 font-sans transition underline underline-offset-2"
            >
              Analyze another link
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
