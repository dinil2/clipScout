import React, { useState } from 'react';
import { Monitor, Smartphone, Video } from 'lucide-react';

export default function ClipPlayer({ clip, videoId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [playerMode, setPlayerMode] = useState('16x9'); // '16x9' | '9x16'

  if (!videoId || videoId === 'custom-source') return null;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
          isOpen
            ? 'bg-amber-500 text-studio-950 border-amber-400 shadow-md shadow-amber-500/20'
            : 'bg-studio-800 hover:bg-studio-750 text-amber-300 hover:text-amber-200 border-studio-700'
        }`}
      >
        <Video className="w-3.5 h-3.5" />
        <span>{isOpen ? 'Hide Player' : '▶ Watch Clip Inline'}</span>
      </button>

      {isOpen && (
        <div className="p-3 bg-studio-950 border border-studio-800 rounded-2xl animate-fade-in space-y-3">
          {/* Mode Switcher */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium">Framing Preview Mode:</span>
            <div className="flex items-center gap-1 bg-studio-900 p-1 rounded-xl border border-studio-800">
              <button
                type="button"
                onClick={() => setPlayerMode('16x9')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition ${
                  playerMode === '16x9' ? 'bg-amber-500 text-studio-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>16:9 Landscape</span>
              </button>
              <button
                type="button"
                onClick={() => setPlayerMode('9x16')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition ${
                  playerMode === '9x16' ? 'bg-amber-500 text-studio-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>9:16 Shorts Simulator</span>
              </button>
            </div>
          </div>

          {playerMode === '16x9' ? (
            <div className="rounded-xl overflow-hidden bg-black border border-studio-700 shadow-2xl aspect-video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?start=${clip.startSeconds}&end=${clip.endSeconds}&autoplay=1&rel=0`}
                title={`Preview: ${clip.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-2">
              <div className="relative w-[280px] sm:w-[300px] aspect-[9/16] rounded-3xl overflow-hidden border-4 border-zinc-700 shadow-2xl bg-black flex items-center justify-center">
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${videoId}?start=${clip.startSeconds}&end=${clip.endSeconds}&autoplay=1&rel=0`}
                    className="w-[178%] h-full max-w-none pointer-events-auto"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                {clip.hookText && (
                  <div className="absolute top-10 inset-x-4 pointer-events-none z-10 text-center">
                    <span className="inline-block bg-black/80 backdrop-blur-md text-amber-300 font-extrabold text-[11px] px-3 py-1.5 rounded-lg border border-amber-500/40 uppercase shadow-lg">
                      {clip.hookText}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">
                Simulated 9:16 vertical crop preview
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
