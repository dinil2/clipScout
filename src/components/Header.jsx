import React from 'react';
import { Scissors, Youtube, Briefcase, FileText, Film, BarChart3, Settings } from 'lucide-react';

export default function Header({ 
  activeTab, 
  onSelectTab, 
  clipsCount = 0,
  onOpenSettings 
}) {
  const tabs = [
    { id: 'campaign', label: '1. Campaign', icon: Briefcase },
    { id: 'source', label: '2. Source', icon: FileText },
    { id: 'clips', label: `3. Clips ${clipsCount > 0 ? `(${clipsCount})` : ''}`, icon: Film },
    { id: 'tracker', label: 'Tracker', icon: BarChart3 }
  ];

  return (
    <header className="w-full pt-6 pb-4 select-none">
      <div className="w-full max-w-4xl mx-auto px-4">
        
        {/* Top Branding Row */}
        <div className="flex items-center justify-between gap-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/20 text-studio-950">
              <Scissors className="w-5 h-5 stroke-[2.2]" />
              <div className="absolute -bottom-1 -right-1 bg-red-600 rounded-full p-0.5 border border-studio-950">
                <Youtube className="w-2.5 h-2.5 text-white fill-white" />
              </div>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-1.5 leading-none">
                Clip<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">Scout</span>
              </h1>
              <p className="text-[11px] text-zinc-400 mt-1">
                Content Rewards Clipping Assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 rounded-xl bg-studio-900 hover:bg-studio-850 text-zinc-400 hover:text-white border border-studio-800 transition shadow-sm"
              title="Passcode & Offline Backups"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3-Step Navigation Bar */}
        <nav className="flex items-center gap-1.5 p-1 bg-studio-900 border border-studio-800 rounded-2xl overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`flex-1 min-w-[90px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 ${
                  isActive
                    ? 'bg-amber-500 text-studio-950 shadow-md shadow-amber-500/20 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-studio-850'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </nav>

      </div>
    </header>
  );
}
