import React, { useState, useMemo } from 'react';
import { 
  DollarSign, Eye, Layers, ExternalLink, Download, Upload, 
  Trash2, Filter, CheckCircle2, TrendingUp, Sparkles, AlertCircle 
} from 'lucide-react';
import { CLIP_STATUSES } from '../utils/constants.js';
import { calculateCampaignSummary, calculateEarnings } from '../utils/scoring.js';
import { exportAllDataBackup, importDataBackup } from '../utils/storage.js';

export default function TrackerTab({
  campaigns,
  activeCampaign,
  onSelectCampaign,
  trackerClips = [],
  onUpdateClip,
  onDeleteClip,
  onNotify
}) {
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [importNotice, setImportNotice] = useState(null);

  // Filter clips for active campaign
  const campaignClips = useMemo(() => {
    return trackerClips.filter(c => !c.campaignId || c.campaignId === activeCampaign.id);
  }, [trackerClips, activeCampaign.id]);

  // Compute metrics summary
  const summary = useMemo(() => {
    return calculateCampaignSummary(campaignClips, activeCampaign);
  }, [campaignClips, activeCampaign]);

  const filteredClips = useMemo(() => {
    if (selectedStatusFilter === 'all') return campaignClips;
    return campaignClips.filter(c => (c.status || 'found') === selectedStatusFilter);
  }, [campaignClips, selectedStatusFilter]);

  const handleExportBackup = () => {
    const json = exportAllDataBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `clipscout-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(href);
    if (onNotify) onNotify('Exported complete data backup to JSON file!');
  };

  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result;
      if (typeof content === 'string') {
        const res = importDataBackup(content);
        if (res.success) {
          if (onNotify) onNotify(res.message);
          window.location.reload();
        } else {
          setImportNotice(res.message);
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <section className="w-full max-w-4xl mx-auto px-4 mt-6 animate-fade-in space-y-6">
      
      {/* Header & Campaign Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-studio-900 border border-studio-800">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
            Campaign Earnings & Workflow Tracker
          </span>
          <div className="flex items-center gap-2 mt-1">
            <select
              value={activeCampaign.id}
              onChange={(e) => onSelectCampaign(e.target.value)}
              className="bg-studio-950 border border-studio-700 text-zinc-100 font-semibold text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
            >
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} (${Number(c.cpmRate || 0).toFixed(2)} CPM)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Backup Export/Import Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleExportBackup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-800 hover:bg-studio-750 text-zinc-200 border border-studio-700 text-xs font-semibold transition"
            title="Download full JSON backup of campaigns and tracker data"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span>Export Backup</span>
          </button>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-800 hover:bg-studio-750 text-zinc-200 border border-studio-700 text-xs font-semibold transition cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-zinc-400" />
            <span>Import Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {importNotice && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          ⚠️ {importNotice}
        </div>
      )}

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-studio-900 border border-studio-800 space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 block">Total Earnings</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
            ${summary.totalEarnings.toFixed(2)}
          </div>
          <span className="text-[10px] text-zinc-500 block">
            Cap potential: ${summary.maxPotentialEarnings.toFixed(2)}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-studio-900 border border-studio-800 space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 block">Total Views</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {summary.totalViews.toLocaleString()}
          </div>
          <span className="text-[10px] text-zinc-500 block">
            Rate: ${Number(activeCampaign.cpmRate || 0).toFixed(2)} / 1k views
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-studio-900 border border-studio-800 space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 block">Total Clips</span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400">
            {summary.totalClips}
          </div>
          <span className="text-[10px] text-zinc-500 block">
            In active campaign
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-studio-900 border border-studio-800 space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 block">Workflow Status</span>
          <div className="text-xs space-y-0.5 text-zinc-300 font-mono pt-0.5">
            <div>Posted: <span className="text-emerald-400 font-bold">{summary.byStatus.posted || 0}</span></div>
            <div>Submitted: <span className="text-blue-400 font-bold">{summary.byStatus.submitted || 0}</span></div>
            <div>Editing: <span className="text-amber-400 font-bold">{summary.byStatus.editing || 0}</span></div>
          </div>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-studio-800 pb-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-zinc-500 font-medium">Filter by Status:</span>
          {[
            { id: 'all', label: 'All' },
            { id: CLIP_STATUSES.FOUND, label: 'Found' },
            { id: CLIP_STATUSES.EDITING, label: 'Editing' },
            { id: CLIP_STATUSES.POSTED, label: 'Posted' },
            { id: CLIP_STATUSES.SUBMITTED, label: 'Submitted' }
          ].map(st => (
            <button
              key={st.id}
              type="button"
              onClick={() => setSelectedStatusFilter(st.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                selectedStatusFilter === st.id
                  ? 'bg-amber-500 text-studio-950 font-bold'
                  : 'bg-studio-900 text-zinc-400 hover:text-white border border-studio-800'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-zinc-500 font-mono">
          {filteredClips.length} clips showing
        </span>
      </div>

      {/* Tracked Clips Table / Cards */}
      <div className="space-y-3">
        {filteredClips.length > 0 ? (
          filteredClips.map((clip, idx) => {
            const views = Number(clip.views) || 0;
            const earnings = calculateEarnings(views, activeCampaign.cpmRate, activeCampaign.perClipMax);

            return (
              <div
                key={clip.id || idx}
                className="p-4 rounded-2xl bg-studio-900 border border-studio-800 space-y-3"
              >
                {/* Top Info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-studio-800 font-mono text-xs font-bold text-amber-400">
                      {clip.startTime} - {clip.endTime}
                    </span>
                    <span className="text-xs font-bold text-white truncate max-w-sm">
                      {clip.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {/* Status Pill */}
                    <select
                      value={clip.status || 'found'}
                      onChange={(e) => onUpdateClip({ ...clip, status: e.target.value })}
                      className="bg-studio-950 border border-studio-700 text-xs font-semibold rounded-lg px-2 py-1 text-zinc-200"
                    >
                      <option value="found">Found</option>
                      <option value="editing">Editing</option>
                      <option value="posted">Posted</option>
                      <option value="submitted">Submitted</option>
                      <option value="rejected">Rejected</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => onDeleteClip(clip.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 transition"
                      title="Remove from tracker"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tracking inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-studio-850 text-xs">
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-zinc-500 block mb-1">Posted Link</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="url"
                        value={clip.postedUrl || ''}
                        onChange={(e) => onUpdateClip({ ...clip, postedUrl: e.target.value.trim() })}
                        placeholder="https://youtube.com/shorts/... or tiktok.com/..."
                        className="flex-1 bg-studio-950 border border-studio-750 rounded-lg px-2.5 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-amber-500"
                      />
                      {clip.postedUrl && (
                        <a
                          href={clip.postedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-studio-800 text-zinc-300 hover:text-white"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-500 block mb-1">Views & Payout</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={clip.views || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          onUpdateClip({ ...clip, views: isNaN(val) ? 0 : Math.max(0, val) });
                        }}
                        placeholder="0 views"
                        className="w-24 bg-studio-950 border border-studio-750 rounded-lg px-2 py-1 text-xs font-mono text-white"
                      />
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        = ${earnings.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center rounded-2xl bg-studio-900 border border-studio-800 text-zinc-400 space-y-2">
            <p className="font-semibold text-zinc-300">No clips tracked for this campaign yet.</p>
            <p className="text-xs text-zinc-500">
              When you scout clips in the "Clips" tab, update their status or views to track earnings here.
            </p>
          </div>
        )}
      </div>

    </section>
  );
}
