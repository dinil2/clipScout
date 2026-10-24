import React from 'react';
import { ExternalLink, DollarSign, Eye, CheckCircle2 } from 'lucide-react';
import { CLIP_STATUSES } from '../../utils/constants.js';
import { calculateEarnings } from '../../utils/scoring.js';

export default function TrackerFields({
  clip,
  campaign,
  onUpdateClip
}) {
  const cpm = Number(campaign?.cpmRate) || 0;
  const perClipMax = Number(campaign?.perClipMax) || 0;
  const views = Number(clip.views) || 0;
  const earnings = calculateEarnings(views, cpm, perClipMax);
  const isCapped = perClipMax > 0 && ((views / 1000) * cpm) >= perClipMax;

  const handleStatusChange = (newStatus) => {
    onUpdateClip({ ...clip, status: newStatus });
  };

  const handleViewsChange = (e) => {
    const val = parseInt(e.target.value, 10);
    onUpdateClip({ ...clip, views: isNaN(val) ? 0 : Math.max(0, val) });
  };

  const handleUrlChange = (e) => {
    onUpdateClip({ ...clip, postedUrl: e.target.value.trim() });
  };

  const statusOptions = [
    { id: CLIP_STATUSES.FOUND, label: 'Found' },
    { id: CLIP_STATUSES.EDITING, label: 'Editing' },
    { id: CLIP_STATUSES.POSTED, label: 'Posted' },
    { id: CLIP_STATUSES.SUBMITTED, label: 'Submitted' }
  ];

  return (
    <div className="bg-studio-950/70 border border-studio-800 rounded-xl p-3 space-y-3 text-xs">
      
      {/* Top: Status Selector & Live Earnings Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        
        {/* Status Buttons */}
        <div className="flex items-center gap-1 bg-studio-900 p-1 rounded-xl border border-studio-800 self-start sm:self-auto">
          {statusOptions.map(st => (
            <button
              key={st.id}
              type="button"
              onClick={() => handleStatusChange(st.id)}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                (clip.status || 'found') === st.id
                  ? 'bg-amber-500 text-studio-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Live Estimated Earnings Calculation Badge */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-xs">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>${earnings.toFixed(2)}</span>
            <span className="text-[10px] text-zinc-500 font-normal">
              {isCapped ? '(Max Cap)' : `(@ $${cpm.toFixed(2)} CPM)`}
            </span>
          </div>
        </div>

      </div>

      {/* Bottom Inputs: Posted URL & Views */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-studio-850">
        <div>
          <label className="block text-[10px] text-zinc-500 font-medium mb-1">
            Posted Video Link (Shorts / TikTok URL)
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="url"
              value={clip.postedUrl || ''}
              onChange={handleUrlChange}
              placeholder="https://youtube.com/shorts/... or tiktok.com/..."
              className="flex-1 bg-studio-900 border border-studio-750 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
            />
            {clip.postedUrl && (
              <a
                href={clip.postedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-studio-850 hover:bg-studio-800 text-zinc-300 hover:text-white border border-studio-700"
                title="Open posted video link in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-zinc-500 font-medium mb-1 flex items-center justify-between">
            <span>Views Count (Manual Entry)</span>
            <span className="text-zinc-500 font-mono">{views.toLocaleString()} views</span>
          </label>
          <div className="relative">
            <Eye className="w-3.5 h-3.5 absolute left-2.5 top-2 text-zinc-500" />
            <input
              type="number"
              min="0"
              step="500"
              value={clip.views || ''}
              onChange={handleViewsChange}
              placeholder="0"
              className="w-full bg-studio-900 border border-studio-750 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

    </div>
  );
}
