import React from 'react';
import { Scissors, Sparkles, Youtube } from 'lucide-react';

export default function Header() {
  return (
    <header className="w-full pt-8 pb-6 text-center select-none">
      {/* Subtle Pro Tag */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-studio-900 border border-studio-700/60 text-xs font-medium text-zinc-400 mb-4 shadow-sm">
        <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
        <span className="text-zinc-300">Creator Studio AI</span>
        <span className="text-zinc-600">•</span>
        <span className="text-amber-400/90 font-mono">15–58s Hook Finder</span>
      </div>

      {/* Main Brand Title */}
      <div className="flex items-center justify-center gap-3">
        <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/20 text-studio-950">
          <Scissors className="w-6 h-6 stroke-[2.2]" />
          <div className="absolute -bottom-1 -right-1 bg-red-600 rounded-full p-0.5 border border-studio-950">
            <Youtube className="w-3 h-3 text-white fill-white" />
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-2">
          Clip<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">Scout</span>
        </h1>
      </div>

      {/* Tagline */}
      <p className="mt-3 text-sm sm:text-base text-zinc-400 max-w-xl mx-auto px-4 font-normal leading-relaxed">
        Extract the highest-converting moments from long-form YouTube videos and livestreams, ranked by AI virality score with ready-to-publish metadata.
      </p>
    </header>
  );
}
