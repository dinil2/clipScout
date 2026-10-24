import React from 'react';
import { ExternalLink, User, Scissors, Play } from 'lucide-react';

export default function VideoBanner({ video, clipsCount, onReset }) {
  if (!video) return null;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 mt-6 space-y-3 animate-fade-in">
      <div className="relative rounded-2xl bg-studio-900 border border-studio-800 p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
        
        {/* Thumbnail with overlay (if available) */}
        {video.thumbnail ? (
          <a
            href={video.videoId && video.videoId !== 'custom-source' ? `https://www.youtube.com/watch?v=${video.videoId}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="relative group shrink-0 w-full sm:w-48 aspect-video rounded-xl overflow-hidden bg-studio-950 border border-studio-800 shadow-md block"
            title="Open original source"
          >
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            {video.videoId && video.videoId !== 'custom-source' && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-9 h-9 rounded-full bg-amber-500 text-studio-950 flex items-center justify-center shadow-lg">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
              </div>
            )}
            {video.durationText && (
              <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 backdrop-blur-sm text-[11px] font-mono text-white rounded font-medium">
                {video.durationText}
              </div>
            )}
          </a>
        ) : null}

        {/* Video Information */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
              <Scissors className="w-3 h-3" />
              {clipsCount} Verified Clips
            </span>
            {video.author && (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-400 font-medium truncate max-w-[200px]">
                <User className="w-3 h-3 text-zinc-500" />
                {video.author}
              </span>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-bold text-white leading-snug line-clamp-2">
            {video.videoId && video.videoId !== 'custom-source' ? (
              <a
                href={`https://www.youtube.com/watch?v=${video.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-amber-300 transition-colors flex items-center gap-1.5"
              >
                <span>{video.title}</span>
                <ExternalLink className="w-3.5 h-3.5 inline text-zinc-500 shrink-0" />
              </a>
            ) : (
              <span>{video.title}</span>
            )}
          </h2>

          <div className="mt-2.5 flex items-center gap-3 text-xs text-zinc-500 font-mono">
            {video.durationText && <span>Duration: {video.durationText}</span>}
            <span>•</span>
            <button
              onClick={onReset}
              className="text-zinc-400 hover:text-amber-400 font-sans transition underline underline-offset-2"
            >
              Analyze new source
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
