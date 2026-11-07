import React from 'react';
import { Scissors, Settings, Wifi, WifiOff, History } from 'lucide-react';

export default function Header({
  isEngineConnected = true,
  onOpenSettings,
  onOpenRecent,
  onReset
}) {
  return (
    <header className="w-full border-b border-border bg-bg/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Wordmark */}
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2.5 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-control p-1"
        >
          <div className="w-8 h-8 rounded-control bg-accent flex items-center justify-center text-accent-ink shadow-accent group-hover:scale-105 transition-transform">
            <Scissors className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-bold text-text text-base tracking-tight leading-none">
              ClipScout
            </span>
            <span className="text-[10px] text-muted tracking-wider uppercase font-semibold mt-0.5">
              Shorts Studio
            </span>
          </div>
        </button>

        {/* Right side: Recent Jobs + Status pill + Settings */}
        <div className="flex items-center gap-2.5">
          {/* History Button */}
          {onOpenRecent && (
            <button
              type="button"
              onClick={onOpenRecent}
              aria-label="Recent Podcast Jobs"
              title="Recent Podcast Jobs"
              className="h-9 px-2.5 rounded-control border border-border bg-surface hover:bg-surface-2 text-muted hover:text-text flex items-center gap-1.5 transition-colors cursor-pointer text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <History className="w-3.5 h-3.5 text-accent" />
              <span className="hidden sm:inline">Recent</span>
            </button>
          )}

          {/* Status Pill */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              isEngineConnected
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-danger/10 border-danger/30 text-danger'
            }`}
            title={isEngineConnected ? 'Engine is active and ready' : 'Engine is offline'}
          >
            {isEngineConnected ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span>Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Settings Trigger */}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Studio Settings"
            title="Studio Settings"
            className="w-9 h-9 rounded-control border border-border bg-surface hover:bg-surface-2 text-muted hover:text-text flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
