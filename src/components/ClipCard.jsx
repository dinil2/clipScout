import React, { useState } from 'react';
import { Copy, Check, Play, Download, Loader2, Flame, Zap, Compass, Hash, Sparkles } from 'lucide-react';
import { formatDurationBadge } from '../utils/youtube';

export default function ClipCard({ clip, rank, videoId, onNotify }) {
  const [copiedField, setCopiedField] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadDone, setIsDownloadDone] = useState(false);

  const triggerCopy = (text, fieldName, label) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    if (onNotify) onNotify(`Copied ${label} to clipboard!`);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleCopyAll = () => {
    const fullPackage = `${clip.title}

${clip.description}

${clip.hashtags.join(' ')}`;
    triggerCopy(fullPackage, 'all', 'full Shorts package');
  };

  const handleDownloadClip = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    if (onNotify) onNotify(`Starting 1080p clip download (${clip.durationSeconds}s slice)...`);

    try {
      const downloadUrl = `/api/download?videoId=${encodeURIComponent(videoId)}&start=${clip.startSeconds}&end=${clip.endSeconds}&title=${encodeURIComponent(clip.title)}`;
      
      const res = await fetch(downloadUrl);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to download clip.');
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const safeTitle = (clip.title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
      a.download = `${safeTitle}_${clip.startSeconds}-${clip.endSeconds}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      setIsDownloadDone(true);
      if (onNotify) onNotify(`Downloaded "${clip.title}" in 1080p!`);
      setTimeout(() => setIsDownloadDone(false), 3500);
    } catch (err) {
      console.error('Download error:', err);
      if (onNotify) onNotify(`Download error: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // Score Badge visual styling
  const getScoreStyle = (score) => {
    if (score >= 80) {
      return {
        badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        ring: 'border-emerald-500/40 text-emerald-400',
        icon: Flame,
        tier: 'High Virality Potential'
      };
    }
    if (score >= 50) {
      return {
        badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        ring: 'border-amber-500/40 text-amber-400',
        icon: Zap,
        tier: 'Solid Viral Potential'
      };
    }
    return {
      badgeBg: 'bg-zinc-800/80 border-zinc-700 text-zinc-400',
      ring: 'border-zinc-600 text-zinc-400',
      icon: Compass,
      tier: 'Moderate / Niche'
    };
  };

  const scoreMeta = getScoreStyle(clip.viralityScore);
  const ScoreIcon = scoreMeta.icon;

  return (
    <article className="glass-card rounded-2xl p-5 sm:p-6 relative group transition-all duration-200">
      
      {/* Top Header: Rank, Timestamps, and Virality Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-studio-800">
        
        {/* Left: Rank & Monospace Timestamp */}
        <div className="flex items-center flex-wrap gap-3">
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold font-mono ${
            rank === 1 ? 'bg-amber-500 text-studio-950 shadow-md shadow-amber-500/20' : 'bg-studio-800 text-zinc-300'
          }`}>
            #{rank}
          </span>

          <div className="flex items-center gap-2 font-mono text-sm sm:text-base font-semibold text-zinc-200 bg-studio-850 px-3 py-1.5 rounded-xl border border-studio-700/80">
            <span>{clip.startTime}</span>
            <span className="text-zinc-500">→</span>
            <span>{clip.endTime}</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-studio-750 text-amber-400/90 font-mono font-medium ml-1">
              {formatDurationBadge(clip.durationSeconds)}
            </span>
          </div>

          {/* YouTube Preview Link */}
          <a
            href={clip.previewUrl || `https://youtu.be/${videoId}?t=${clip.startSeconds}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 text-xs font-medium transition hover:border-red-500/40"
            title="Open video at this timestamp in new tab"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>▶ Preview on YouTube</span>
          </a>

          {/* Download 1080p Clip Button */}
          <button
            type="button"
            onClick={handleDownloadClip}
            disabled={isDownloading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition active:scale-95 ${
              isDownloading
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 cursor-wait'
                : isDownloadDone
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-studio-800 hover:bg-studio-750 text-amber-300 hover:text-amber-200 border-studio-700 hover:border-amber-500/40'
            }`}
            title={`Download this ${clip.durationSeconds}s slice in 1080p MP4`}
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Clipping 1080p...</span>
              </>
            ) : isDownloadDone ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Downloaded!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Download 1080p</span>
              </>
            )}
          </button>
        </div>

        {/* Right: AI Virality Score Badge & Caption */}
        <div className="flex flex-col sm:items-end">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${scoreMeta.badgeBg} font-semibold text-sm shadow-sm`}>
            <ScoreIcon className="w-4 h-4" />
            <span>{clip.viralityScore}</span>
            <span className="text-xs opacity-75 font-normal">/ 100</span>
            <span className="text-xs font-medium ml-1 border-l border-current/20 pl-2">
              AI Virality Score
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 mt-1 sm:text-right font-normal">
            AI estimate based on hook & story beat, not a guarantee
          </span>
        </div>

      </div>

      {/* Main Body */}
      <div className="mt-4 space-y-3.5">
        
        {/* Title & Copy */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
              {clip.title}
            </h3>
            <button
              type="button"
              onClick={() => triggerCopy(clip.title, 'title', 'title')}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-studio-800 transition shrink-0"
              title="Copy title"
            >
              {copiedField === 'title' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Reasoning */}
          {clip.reasoning && (
            <p className="mt-1.5 text-xs sm:text-sm italic text-amber-200/80 bg-amber-500/5 px-3 py-2 rounded-lg border border-amber-500/10">
              💡 {clip.reasoning}
            </p>
          )}
        </div>

        {/* Description & Copy */}
        <div className="bg-studio-900/80 rounded-xl p-3 border border-studio-800/80">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium mb-1">
            <span>Shorts Description</span>
            <button
              type="button"
              onClick={() => triggerCopy(clip.description, 'description', 'description')}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition"
              title="Copy description"
            >
              {copiedField === 'description' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-normal">
            {clip.description}
          </p>
        </div>

        {/* Hashtags & Copy */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-1.5">
            {clip.hashtags.map((tag, i) => (
              <button
                key={i}
                type="button"
                onClick={() => triggerCopy(tag, `tag-${i}`, tag)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-studio-850 hover:bg-studio-800 border border-studio-750 text-xs font-mono text-zinc-300 transition"
                title={`Copy ${tag}`}
              >
                <Hash className="w-3 h-3 text-zinc-500" />
                <span>{tag.replace(/^#/, '')}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => triggerCopy(clip.hashtags.join(' '), 'hashtags', 'hashtags')}
            className="self-start sm:self-auto inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 transition"
            title="Copy all hashtags"
          >
            {copiedField === 'hashtags' ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-sans">Copied tags</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="font-sans">Copy all tags</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Footer: One-Click "Copy All" Package */}
      <div className="mt-5 pt-3.5 border-t border-studio-800 flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-zinc-500 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Ready to paste directly into YouTube Studio</span>
        </div>

        <button
          type="button"
          onClick={handleCopyAll}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm ${
            copiedField === 'all'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-studio-800 hover:bg-studio-700 text-zinc-100 hover:text-white border border-studio-700'
          }`}
          title="Copies Title, Description, and Hashtags in one formatted block"
        >
          {copiedField === 'all' ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Full Package Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-amber-400" />
              <span>Copy All (Title + Desc + Tags)</span>
            </>
          )}
        </button>
      </div>

    </article>
  );
}
