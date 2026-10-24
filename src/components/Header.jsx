import React from 'react';
import { Sparkles, Youtube, Settings, RotateCcw, Video, Download } from 'lucide-react';

export default function Header({ 
  clipsCount = 0, 
  onReset, 
  onOpenSettings 
}) {
  return (
    <header className="w-full border-b border-studio-800/80 bg-studio-950/80 backdrop-blur-md sticky top-0 z-40 select-none">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        
        {/* Branding */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/20 text-white font-black text-lg">
            <span>CS</span>
            <div className="absolute -bottom-1 -right-1 bg-red-600 rounded-full p-0.5 border-2 border-studio-950">
              <Youtube className="w-2.5 h-2.5 text-white fill-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center leading-none">
                Clip<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-amber-300">Scout</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-bold uppercase tracking-wider">
                Studio
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              Turn long podcasts & videos into viral YouTube Shorts
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Clipper Status Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>1080p MP4 Clipper Active</span>
          </div>

          {/* New Video Reset Button (when clips exist) */}
          {clipsCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-studio-750 text-zinc-300 hover:text-white text-xs font-semibold transition"
              title="Start with a new video"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">New Video</span>
            </button>
          )}

          {/* Settings Modal Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 text-zinc-400 hover:text-white border border-studio-750 transition"
            title="API Keys & Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
}
