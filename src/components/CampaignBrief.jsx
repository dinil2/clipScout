import React, { useState } from 'react';
import { 
  Briefcase, Plus, Trash2, Check, Sparkles, DollarSign, 
  Hash, AtSign, Ban, Sliders, ShieldAlert, Layers
} from 'lucide-react';
import { DEFAULT_CAMPAIGN } from '../utils/constants.js';

export default function CampaignBrief({ 
  campaigns = [], 
  activeCampaign, 
  onSelectCampaign, 
  onSaveCampaign, 
  onCreateCampaign, 
  onDeleteCampaign,
  onProceedToSource 
}) {
  const [formData, setFormData] = useState({ ...activeCampaign });
  const [savedNotice, setSavedNotice] = useState(false);

  // Sync if activeCampaign changes externally
  React.useEffect(() => {
    setFormData({ ...activeCampaign });
  }, [activeCampaign.id]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayChange = (field, stringValue, delimiter = /[,\s]+/) => {
    const arr = stringValue
      .split(delimiter)
      .map(s => s.trim())
      .filter(Boolean);
    handleChange(field, arr);
  };

  const handlePlatformToggle = (platform) => {
    const current = formData.allowedPlatforms || [];
    const exists = current.includes(platform);
    const updated = exists ? current.filter(p => p !== platform) : [...current, platform];
    handleChange('allowedPlatforms', updated);
  };

  const handleSave = (e) => {
    e?.preventDefault();
    onSaveCampaign(formData);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2200);
  };

  const platformsList = ['YouTube Shorts', 'TikTok', 'Instagram Reels', 'X (Twitter)'];

  return (
    <section className="w-full max-w-4xl mx-auto px-4 mt-6 animate-fade-in space-y-6">
      
      {/* Campaign Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-studio-900 border border-studio-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
              Content Rewards Campaign
            </span>
            <div className="flex items-center gap-2 mt-0.5">
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
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={onCreateCampaign}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-800 hover:bg-studio-750 text-zinc-200 border border-studio-700 text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>New Campaign</span>
          </button>
          {campaigns.length > 1 && (
            <button
              type="button"
              onClick={() => onDeleteCampaign(activeCampaign.id)}
              className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition border border-transparent hover:border-red-500/20"
              title="Delete active campaign"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Campaign Form */}
      <form onSubmit={handleSave} className="p-6 rounded-2xl bg-studio-900 border border-studio-800 shadow-xl space-y-6">
        
        {/* Row 1: Name & CPM & Max Cap */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Campaign Name
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Apex Launch Campaign"
              className="w-full bg-studio-950 border border-studio-750 rounded-xl px-3.5 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center justify-between">
              <span>CPM Rate (USD / 1k views)</span>
              <span className="text-[10px] text-emerald-400 font-mono font-semibold">Earnings</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-zinc-500 text-xs">$</span>
              <input
                type="number"
                step="0.05"
                min="0"
                value={formData.cpmRate ?? 1.50}
                onChange={(e) => handleChange('cpmRate', parseFloat(e.target.value) || 0)}
                className="w-full bg-studio-950 border border-studio-750 rounded-xl pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono font-semibold"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center justify-between">
              <span>Per-Clip Payout Cap (USD)</span>
              <span className="text-[10px] text-zinc-500 font-mono">Max / Clip</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-zinc-500 text-xs">$</span>
              <input
                type="number"
                step="1"
                min="0"
                value={formData.perClipMax ?? 50.00}
                onChange={(e) => handleChange('perClipMax', parseFloat(e.target.value) || 0)}
                className="w-full bg-studio-950 border border-studio-750 rounded-xl pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 font-mono font-semibold"
                required
              />
            </div>
          </div>
        </div>

        {/* Row 2: Duration Constraints & Allowed Platforms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-studio-850">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Clip Duration Limits (YouTube Shorts ceiling: 58s)
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <span className="text-[10px] text-zinc-500 block mb-1">Min Seconds</span>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={formData.minClipSec ?? 15}
                  onChange={(e) => handleChange('minClipSec', parseInt(e.target.value) || 15)}
                  className="w-full bg-studio-950 border border-studio-750 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <span className="text-zinc-600 self-end mb-2">→</span>
              <div className="flex-1">
                <span className="text-[10px] text-zinc-500 block mb-1">Max Seconds</span>
                <input
                  type="number"
                  min="15"
                  max="58"
                  value={formData.maxClipSec ?? 58}
                  onChange={(e) => handleChange('maxClipSec', Math.min(58, parseInt(e.target.value) || 58))}
                  className="w-full bg-studio-950 border border-studio-750 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Allowed Platforms
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {platformsList.map(p => {
                const checked = (formData.allowedPlatforms || []).includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePlatformToggle(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition border ${
                      checked
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-studio-950 text-zinc-500 border-studio-800 hover:text-zinc-300'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 3: Required Tags & Mentions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-studio-850">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-amber-400" />
              <span>Required Hashtags (Auto-inserted & checked)</span>
            </label>
            <input
              type="text"
              value={(formData.requiredHashtags || []).join(' ')}
              onChange={(e) => handleArrayChange('requiredHashtags', e.target.value)}
              placeholder="#BrandName #Shorts"
              className="w-full bg-studio-950 border border-studio-750 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-200 font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5 text-amber-400" />
              <span>Required @Mentions (Auto-inserted & checked)</span>
            </label>
            <input
              type="text"
              value={(formData.requiredMentions || []).join(' ')}
              onChange={(e) => handleArrayChange('requiredMentions', e.target.value)}
              placeholder="@BrandAccount"
              className="w-full bg-studio-950 border border-studio-750 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-200 font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Row 4: Banned Words & Language */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-studio-850">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5 text-red-400" />
              <span>Banned Words & Topics (Comma or space separated)</span>
            </label>
            <input
              type="text"
              value={(formData.bannedWords || []).join(', ')}
              onChange={(e) => handleArrayChange('bannedWords', e.target.value, /[,]+|\n+/)}
              placeholder="crypto, guaranteed profit, get rich quick, scam"
              className="w-full bg-studio-950 border border-studio-750 rounded-xl px-3.5 py-2 text-xs text-red-300 placeholder-zinc-600 focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Primary Language
            </label>
            <input
              type="text"
              value={formData.language || 'English'}
              onChange={(e) => handleChange('language', e.target.value)}
              className="w-full bg-studio-950 border border-studio-750 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Row 5: Free-text Campaign Rules & Guidelines */}
        <div className="pt-2 border-t border-studio-850">
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Campaign Brief & Quality Guidelines (Instructs AI Prompt)
          </label>
          <textarea
            rows={3}
            value={formData.rules || ''}
            onChange={(e) => handleChange('rules', e.target.value)}
            placeholder="Describe the desired tone, focus topics, what kind of moments win payouts, and what to avoid..."
            className="w-full bg-studio-950 border border-studio-750 rounded-xl p-3 text-xs sm:text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 leading-relaxed resize-none"
          />
        </div>

        {/* Save & Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-studio-800">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-studio-950 font-bold text-xs sm:text-sm transition shadow-md shadow-amber-500/20 active:scale-95"
            >
              {savedNotice ? (
                <>
                  <Check className="w-4 h-4 text-studio-950 stroke-[3]" />
                  <span>Campaign Saved!</span>
                </>
              ) : (
                <span>Save Campaign</span>
              )}
            </button>
            <span className="text-xs text-zinc-500">
              Saved locally in browser
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              onSaveCampaign(formData);
              onProceedToSource();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-white border border-studio-700 text-xs font-semibold transition"
          >
            <span>Next: Select Source</span>
            <span>→</span>
          </button>
        </div>

      </form>
    </section>
  );
}
