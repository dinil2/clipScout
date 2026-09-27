import React, { useState } from 'react';
import { 
  Copy, Check, Play, Download, Loader2, Flame, Zap, 
  Compass, Hash, Sparkles, MessageSquare, Video, 
  CheckCircle2, Clock, AlertCircle, Smile, Trophy, FileText, Smartphone, Monitor, Crown,
  X, ExternalLink, Terminal
} from 'lucide-react';
import { formatDurationBadge } from '../utils/youtube';

function formatSrtTime(totalSec) {
  const s = Math.max(0, totalSec);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export default function ClipCard({ 
  clip, 
  rank, 
  videoId, 
  onNotify, 
  status = 'todo', 
  onStatusChange 
}) {
  const [copiedField, setCopiedField] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadDone, setIsDownloadDone] = useState(false);
  const [showInlinePlayer, setShowInlinePlayer] = useState(false);
  const [playerMode, setPlayerMode] = useState('16x9'); // '16x9' | '9x16'
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadModalData, setDownloadModalData] = useState(null);
  const [copiedCli, setCopiedCli] = useState(false);

  const triggerCopy = (text, fieldName, label) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    if (onNotify) onNotify(`Copied ${label} to clipboard!`);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleCopyAll = () => {
    const fullPackage = `🎬 TITLE:
${clip.title}

⚡ ON-SCREEN HOOK OVERLAY:
"${clip.hookText || clip.title}"

📝 SHORTS DESCRIPTION:
${clip.description}

🏷️ HASHTAGS:
${clip.hashtags.join(' ')}

💬 PINNED COMMENT:
"${clip.pinnedComment || 'What do you think about this? Comment below! 👇'}"

✂️ EDITING CUE:
"${clip.editingTip || 'Punch-in zoom at 0:02, whoosh sound effect on hook'}"

⏱️ TIMESTAMPS:
${clip.startTime} - ${clip.endTime} (${clip.durationSeconds}s)`;

    triggerCopy(fullPackage, 'all', 'full Shorts package');
  };

  const handleDownloadClip = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    if (onNotify) onNotify(`Preparing 1080p clip download (${clip.durationSeconds}s slice)...`);

    const safeTitle = (clip.title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 45);
    const fallbackCli = `yt-dlp --download-sections "*${clip.startTime}-${clip.endTime}" -f "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]/best" "https://www.youtube.com/watch?v=${videoId}" -o "${safeTitle}.mp4"`;

    try {
      const downloadUrl = `/api/download?videoId=${encodeURIComponent(videoId)}&start=${clip.startSeconds}&end=${clip.endSeconds}&title=${encodeURIComponent(clip.title)}`;
      const res = await fetch(downloadUrl);
      const contentType = res.headers.get('content-type') || '';

      // 1. If backend streams direct MP4 binary (Local development server)
      if (res.ok && contentType.includes('video/')) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${safeTitle}_${clip.startSeconds}-${clip.endSeconds}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);

        setIsDownloadDone(true);
        if (onNotify) onNotify(`Downloaded "${clip.title}" in 1080p!`);
        setTimeout(() => setIsDownloadDone(false), 3500);
        return;
      }

      // 2. If backend returns JSON export options (Netlify production serverless)
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setDownloadModalData(data);
        setShowDownloadModal(true);
        if (onNotify) onNotify(`1080p Export Suite ready!`);
        return;
      }

      throw new Error('Serverless export mode');
    } catch (err) {
      // Fallback: Show the 1080p Export Suite modal with pre-configured lossless CLI and Web Trimmers
      setDownloadModalData({
        videoId,
        start: clip.startSeconds,
        end: clip.endSeconds,
        duration: clip.durationSeconds,
        title: clip.title,
        cliCommand: fallbackCli,
        youtubeUrl: `https://youtu.be/${videoId}?t=${clip.startSeconds}`,
        downloadServices: [
          {
            name: 'YT Cutter (Web Timestamp Trimmer)',
            url: 'https://ytcutter.com/',
            tip: 'Trim directly in browser with start & end timestamps'
          },
          {
            name: 'Cobalt Media (Lossless 1080p)',
            url: 'https://cobalt.tools/',
            tip: 'Fast ad-free 1080p media downloader'
          },
          {
            name: 'SaveFrom / ssYouTube',
            url: `https://www.ssyoutube.com/watch?v=${videoId}`,
            tip: 'Direct browser MP4 video grabber'
          }
        ]
      });
      setShowDownloadModal(true);
      if (onNotify) onNotify(`1080p Export Suite ready!`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadSrt = () => {
    const subs = Array.isArray(clip.subtitles) && clip.subtitles.length > 0
      ? clip.subtitles
      : [
          { start: 0, end: Math.min(3, clip.durationSeconds), text: clip.hookText || clip.title },
          { start: Math.min(3, clip.durationSeconds), end: clip.durationSeconds, text: clip.title }
        ];

    const srtLines = subs.map((s, idx) => {
      return `${idx + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}\n${s.text}\n`;
    });

    const srtContent = srtLines.join('\n');
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const safeTitle = (clip.title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
    a.download = `${safeTitle}_captions.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    if (onNotify) onNotify('Downloaded .SRT subtitles for CapCut / Premiere!');
  };

  // Score Badge visual styling
  const getScoreStyle = (score) => {
    if (score >= 80) {
      return {
        badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        ring: 'border-emerald-500/40 text-emerald-400',
        icon: Flame,
        tier: 'Viral Tier 1 (High Algorithm Push)'
      };
    }
    if (score >= 50) {
      return {
        badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        ring: 'border-amber-500/40 text-amber-400',
        icon: Zap,
        tier: 'Viral Tier 2 (Solid Potential)'
      };
    }
    return {
      badgeBg: 'bg-zinc-800/80 border-zinc-700 text-zinc-400',
      ring: 'border-zinc-600 text-zinc-400',
      icon: Compass,
      tier: 'Niche / Community Beat'
    };
  };

  // Category Badge visual styling
  const getCategoryBadge = (category = '') => {
    const cat = category.toLowerCase();
    if (cat.includes('lux') || cat.includes('life') || cat.includes('flex') || cat.includes('car') || cat.includes('jet') || cat.includes('wealth') || cat.includes('rich') || cat.includes('mansion')) {
      return {
        icon: Crown,
        style: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10 font-bold',
        label: '💎 Luxury & Lifestyle'
      };
    }
    if (cat.includes('controversy') || cat.includes('debate')) {
      return {
        icon: Flame,
        style: 'bg-red-500/10 text-red-400 border-red-500/30',
        label: 'Controversy & Debate'
      };
    }
    if (cat.includes('comedy') || cat.includes('rage')) {
      return {
        icon: Smile,
        style: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
        label: 'Comedy & Rage'
      };
    }
    if (cat.includes('mindset') || cat.includes('advice') || cat.includes('insight')) {
      return {
        icon: Sparkles,
        style: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
        label: 'Mindset & Advice'
      };
    }
    if (cat.includes('twist') || cat.includes('drama')) {
      return {
        icon: AlertCircle,
        style: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        label: 'Plot Twist & Drama'
      };
    }
    return {
      icon: Trophy,
      style: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      label: clip.category || 'Peak Climax'
    };
  };

  const scoreMeta = getScoreStyle(clip.viralityScore);
  const ScoreIcon = scoreMeta.icon;
  const categoryMeta = getCategoryBadge(clip.category);
  const CategoryIcon = categoryMeta.icon;

  return (
    <article 
      id={clip.id || `clip-${rank}`}
      className="glass-card rounded-2xl p-5 sm:p-6 relative group transition-all duration-200 hover:border-studio-600 scroll-mt-24"
    >
      
      {/* Top Header: Rank, Category, Timestamps, and Virality Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-studio-800">
        
        {/* Left: Rank & Monospace Timestamp & Category */}
        <div className="flex items-center flex-wrap gap-2.5">
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold font-mono ${
            rank === 1 ? 'bg-amber-500 text-studio-950 shadow-md shadow-amber-500/20' : 'bg-studio-800 text-zinc-300'
          }`}>
            #{rank}
          </span>

          {/* Category Badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border ${categoryMeta.style}`}>
            <CategoryIcon className="w-3.5 h-3.5" />
            <span>{categoryMeta.label}</span>
          </span>

          <div className="flex items-center gap-2 font-mono text-sm sm:text-base font-semibold text-zinc-200 bg-studio-850 px-3 py-1 rounded-xl border border-studio-700/80">
            <span>{clip.startTime}</span>
            <span className="text-zinc-500">→</span>
            <span>{clip.endTime}</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-studio-750 text-amber-400/90 font-mono font-medium ml-1">
              {formatDurationBadge(clip.durationSeconds)}
            </span>
          </div>

          {/* Workflow Status Tracker */}
          {onStatusChange && (
            <div className="flex items-center gap-1 bg-studio-900 border border-studio-750 rounded-xl p-0.5 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => onStatusChange(clip.id, 'todo')}
                className={`px-2 py-1 rounded-lg transition ${
                  status === 'todo'
                    ? 'bg-amber-500/20 text-amber-300 font-semibold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Mark as To Edit"
              >
                To Edit
              </button>
              <button
                type="button"
                onClick={() => onStatusChange(clip.id, 'ready')}
                className={`px-2 py-1 rounded-lg transition ${
                  status === 'ready'
                    ? 'bg-blue-500/20 text-blue-300 font-semibold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Mark as Ready to Post"
              >
                Ready
              </button>
              <button
                type="button"
                onClick={() => onStatusChange(clip.id, 'posted')}
                className={`px-2 py-1 rounded-lg transition ${
                  status === 'posted'
                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Mark as Posted"
              >
                Posted
              </button>
            </div>
          )}
        </div>

        {/* Right: AI Virality Score Badge & Caption */}
        <div className="flex flex-col sm:items-end">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${scoreMeta.badgeBg} font-semibold text-sm shadow-sm`}>
            <ScoreIcon className="w-4 h-4" />
            <span>{clip.viralityScore}</span>
            <span className="text-xs opacity-75 font-normal">/ 100</span>
            <span className="text-xs font-medium ml-1 border-l border-current/20 pl-2">
              Virality Score
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 mt-1 sm:text-right font-normal">
            {scoreMeta.tier}
          </span>
        </div>

      </div>

      {/* Action Buttons Bar: Inline Player Toggle, Preview on YouTube, 1080p Download, SRT Export */}
      <div className="mt-3.5 flex items-center flex-wrap gap-2.5">
        {/* Inline YouTube Player Toggle */}
        <button
          type="button"
          onClick={() => setShowInlinePlayer(!showInlinePlayer)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
            showInlinePlayer
              ? 'bg-amber-500 text-studio-950 border-amber-400 shadow-md shadow-amber-500/20'
              : 'bg-studio-800 hover:bg-studio-750 text-amber-300 hover:text-amber-200 border-studio-700'
          }`}
          title="Watch exact clip slice inside this page"
        >
          <Video className="w-3.5 h-3.5" />
          <span>{showInlinePlayer ? 'Hide Player' : '▶ Watch Clip Inline'}</span>
        </button>

        {/* YouTube External Preview Link */}
        <a
          href={clip.previewUrl || `https://youtu.be/${videoId}?t=${clip.startSeconds}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 text-xs font-medium transition hover:border-red-500/40"
          title="Open video at this timestamp in new YouTube tab"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Open on YouTube</span>
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
              : 'bg-studio-850 hover:bg-studio-800 text-zinc-200 hover:text-white border-studio-700 hover:border-amber-500/40'
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
              <span>Downloaded 1080p!</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Download 1080p</span>
            </>
          )}
        </button>

        {/* Download Subtitles SRT */}
        <button
          type="button"
          onClick={handleDownloadSrt}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-850 hover:bg-studio-800 text-zinc-300 hover:text-white border border-studio-700 text-xs font-medium transition"
          title="Download timed .SRT captions to import directly into CapCut or Premiere"
        >
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span>Export .SRT</span>
        </button>
      </div>

      {/* Embedded Inline YouTube Player with 9:16 Shorts Simulator */}
      {showInlinePlayer && (
        <div className="mt-4 p-3 bg-studio-900 border border-studio-800 rounded-2xl animate-fade-in">
          {/* Mode Switcher */}
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="text-zinc-400 font-medium">Player Preview Mode:</span>
            <div className="flex items-center gap-1 bg-studio-950 p-1 rounded-xl border border-studio-800">
              <button
                type="button"
                onClick={() => setPlayerMode('16x9')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition ${
                  playerMode === '16x9'
                    ? 'bg-amber-500 text-studio-950 font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>16:9 Standard</span>
              </button>
              <button
                type="button"
                onClick={() => setPlayerMode('9x16')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition ${
                  playerMode === '9x16'
                    ? 'bg-amber-500 text-studio-950 font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>📱 9:16 Shorts Simulator</span>
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
            /* 9:16 Vertical Smartphone Shorts Simulator */
            <div className="flex flex-col items-center justify-center py-2">
              <div className="relative w-[280px] sm:w-[310px] aspect-[9/16] rounded-3xl overflow-hidden border-4 border-zinc-700 shadow-2xl bg-black flex items-center justify-center">
                {/* Scaled/Cropped iframe to center */}
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${videoId}?start=${clip.startSeconds}&end=${clip.endSeconds}&autoplay=1&rel=0`}
                    className="w-[178%] h-full max-w-none pointer-events-auto"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                {/* Simulated On-Screen Hook Overlay in Shorts format */}
                {clip.hookText && (
                  <div className="absolute top-10 inset-x-4 pointer-events-none z-10 text-center">
                    <span className="inline-block bg-black/80 backdrop-blur-md text-amber-300 font-extrabold text-[11px] sm:text-xs px-3 py-1.5 rounded-lg border border-amber-500/40 uppercase shadow-lg tracking-wide">
                      {clip.hookText}
                    </span>
                  </div>
                )}

                {/* Simulated Shorts Actions (Like / Comment / Share) */}
                <div className="absolute bottom-5 right-2.5 flex flex-col items-center gap-2.5 pointer-events-none text-white text-[10px] font-semibold drop-shadow-md">
                  <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">❤️</div>
                  <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">💬</div>
                  <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">↗️</div>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 mt-2 text-center">
                📱 9:16 Shorts Simulator: Verify framing before vertical crop in CapCut
              </p>
            </div>
          )}
        </div>
      )}

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

        {/* ⚡ 3-Second On-Screen Hook Overlay Box */}
        {clip.hookText && (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                  3-Second Hook Overlay (Put in Video Editor)
                </span>
                <span className="text-xs sm:text-sm font-semibold text-white">
                  "{clip.hookText}"
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => triggerCopy(clip.hookText, 'hook', 'hook overlay')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold transition shrink-0 self-start sm:self-auto"
              title="Copy hook overlay text for CapCut / Premiere"
            >
              {copiedField === 'hook' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Hook</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* 💬 High-Engagement Pinned Comment Box */}
        {clip.pinnedComment && (
          <div className="bg-blue-500/10 border border-blue-500/25 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <MessageSquare className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 block">
                  High-Engagement Pinned Comment (Drives Algorithm Push)
                </span>
                <span className="text-xs sm:text-sm text-zinc-200">
                  "{clip.pinnedComment}"
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => triggerCopy(clip.pinnedComment, 'pinned', 'pinned comment')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs font-semibold transition shrink-0 self-start sm:self-auto"
              title="Copy pinned comment"
            >
              {copiedField === 'pinned' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Comment</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* 🎬 Pro Editing Cues (Zooms, SFX, B-Roll) */}
        {clip.editingTip && (
          <div className="bg-purple-500/10 border border-purple-500/25 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block">
                  🎬 Retention & Editing Cues (CapCut / Premiere)
                </span>
                <span className="text-xs sm:text-sm text-purple-200 font-medium">
                  {clip.editingTip}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => triggerCopy(clip.editingTip, 'editingTip', 'editing cue')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-semibold transition shrink-0 self-start sm:self-auto"
              title="Copy editing cue"
            >
              {copiedField === 'editingTip' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Cue</span>
                </>
              )}
            </button>
          </div>
        )}

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
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
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
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-sans">Copied tags</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
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
          <span>Ready to paste directly into YouTube Studio & CapCut</span>
        </div>

        <button
          type="button"
          onClick={handleCopyAll}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm ${
            copiedField === 'all'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-studio-800 hover:bg-studio-750 text-zinc-100 hover:text-white border border-studio-700'
          }`}
          title="Copies Title, Hook, Description, Hashtags, Pinned Comment, and Editing Cues in one formatted block"
        >
          {copiedField === 'all' ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Full Package Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-amber-400" />
              <span>Copy Full Package</span>
            </>
          )}
        </button>
      </div>

      {/* 🎬 1080p Clip Export & Download Suite Modal */}
      {showDownloadModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setShowDownloadModal(false)}
        >
          <div 
            className="bg-studio-900 border border-studio-700/90 rounded-2xl w-full max-w-xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-studio-800 pb-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    1080p Shorts Clipper & Export Suite
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Export high-fidelity 1080p video slice for CapCut, Premiere, or YouTube Studio
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDownloadModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-studio-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Clip Summary Pill */}
            <div className="bg-studio-950/80 rounded-xl p-3 border border-studio-800 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 block">
                  Target Timestamp Slice
                </span>
                <span className="text-sm font-bold text-white truncate block">
                  {clip.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                <span>{clip.startTime}</span>
                <span>→</span>
                <span>{clip.endTime}</span>
                <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-200">
                  {clip.durationSeconds}s
                </span>
              </div>
            </div>

            {/* Method 1: Instant Lossless 1080p / 4K CLI Command (Recommended) */}
            <div className="bg-studio-850/90 border border-studio-700/80 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wide">
                    Method 1: 1-Click Lossless 1080p CLI (Fastest — 3s)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const cmd = downloadModalData?.cliCommand || `yt-dlp --download-sections "*${clip.startTime}-${clip.endTime}" -f "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]/best" "https://www.youtube.com/watch?v=${videoId}" -o "${(clip.title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 45)}.mp4"`;
                    navigator.clipboard.writeText(cmd);
                    setCopiedCli(true);
                    if (onNotify) onNotify('Copied 1-line 1080p yt-dlp command!');
                    setTimeout(() => setCopiedCli(false), 2500);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold border border-emerald-500/40 transition active:scale-95"
                >
                  {copiedCli ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Command</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-black/90 p-2.5 rounded-lg border border-studio-750 font-mono text-[11px] text-zinc-300 break-all select-all">
                {downloadModalData?.cliCommand || `yt-dlp --download-sections "*${clip.startTime}-${clip.endTime}" -f "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]/best" "https://www.youtube.com/watch?v=${videoId}" -o "${(clip.title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 45)}.mp4"`}
              </div>

              <p className="text-[11px] text-zinc-400 leading-relaxed">
                ⚡ Paste directly into your terminal or PowerShell. Downloads <strong>only</strong> this exact slice with zero quality loss and no full-video download wait.
              </p>
            </div>

            {/* Method 2: Online Web Cutters (No Software Needed) */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide block">
                Method 2: Online Browser Trimmers (Zero Install)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* YT Cutter */}
                <a
                  href="https://ytcutter.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${videoId}`);
                    if (onNotify) onNotify('Copied video link to paste into trimmer!');
                  }}
                  className="p-3 bg-studio-850 hover:bg-studio-800 border border-studio-750 rounded-xl transition flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-white group-hover:text-amber-300">
                    <span>✂️ YT Cutter (Trimmer)</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-400" />
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Trims directly by timestamp in browser. Link copied automatically on click!
                  </p>
                </a>

                {/* Cobalt Tools */}
                <a
                  href="https://cobalt.tools/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${videoId}`);
                    if (onNotify) onNotify('Copied video link for Cobalt!');
                  }}
                  className="p-3 bg-studio-850 hover:bg-studio-800 border border-studio-750 rounded-xl transition flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-white group-hover:text-amber-300">
                    <span>⚡ Cobalt Media (1080p)</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-400" />
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Fast ad-free 1080p MP4 download with zero ads or tracking.
                  </p>
                </a>
              </div>
            </div>

            {/* Method 3: Subtitles & Video Jump */}
            <div className="pt-2 border-t border-studio-800 flex items-center justify-between flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={handleDownloadSrt}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-850 hover:bg-studio-800 border border-studio-700 text-zinc-200 transition"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export Timed .SRT Captions</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDownloadModal(false)}
                className="px-4 py-1.5 rounded-xl bg-studio-800 hover:bg-studio-750 text-white font-semibold transition"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </article>
  );
}
