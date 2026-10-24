import React, { useState } from 'react';
import { Play, FileText, Download } from 'lucide-react';
import ClipHeader from './clip/ClipHeader.jsx';
import ClipPackage from './clip/ClipPackage.jsx';
import RulesCheck from './clip/RulesCheck.jsx';
import TrackerFields from './clip/TrackerFields.jsx';
import ClipPlayer from './clip/ClipPlayer.jsx';
import DownloadModal from './clip/DownloadModal.jsx';

export default function ClipCard({
  clip,
  rank,
  videoId,
  campaign,
  onNotify,
  onUpdateClip
}) {
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Export authentic .SRT captions derived strictly from real transcript lines
  const handleExportSrt = () => {
    if (!clip.srtContent) {
      if (onNotify) onNotify('No timed subtitles available for this segment.');
      return;
    }

    const blob = new Blob([clip.srtContent], { type: 'text/plain;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const safeTitle = (clip.title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
    a.download = `${safeTitle}_${clip.startSeconds}-${clip.endSeconds}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    if (onNotify) onNotify('Exported verified .SRT subtitles for video editor!');
  };

  return (
    <article
      id={clip.id || `clip-${rank}`}
      className="glass-card rounded-2xl p-5 sm:p-6 space-y-4 relative group scroll-mt-24 transition border border-studio-800 hover:border-studio-700"
    >
      {/* 1. Header with Rank, Timestamps, Duration, AI Virality Score & Sub-scores */}
      <ClipHeader clip={clip} rank={rank} />

      {/* 2. Campaign Rules Compliance Check */}
      <RulesCheck rulesCheck={clip.rulesCheck} />

      {/* 3. Actions Row: Inline Player, Open on YouTube, Export SRT, Download / CLI Modal */}
      <div className="flex items-center flex-wrap gap-2 pt-1">
        {/* Inline Player */}
        <ClipPlayer clip={clip} videoId={videoId} />

        {/* YouTube Link */}
        {videoId && videoId !== 'custom-source' && (
          <a
            href={clip.previewUrl || `https://youtu.be/${videoId}?t=${clip.startSeconds}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 text-xs font-medium transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Open on YouTube</span>
          </a>
        )}

        {/* Export Real SRT */}
        <button
          type="button"
          onClick={handleExportSrt}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-850 hover:bg-studio-800 text-zinc-300 hover:text-white border border-studio-700 text-xs font-medium transition"
          title="Download verified .SRT subtitle track"
        >
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span>Export .SRT</span>
        </button>

        {/* Download Modal / CLI Command Button */}
        {videoId && videoId !== 'custom-source' && (
          <button
            type="button"
            onClick={() => setShowDownloadModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-850 hover:bg-studio-800 text-amber-300 hover:text-white border border-studio-700 hover:border-amber-500/40 text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Clip & Download</span>
          </button>
        )}
      </div>

      {/* 4. Clip Package: Hook Overlay, Title, Description, Hashtags, Pinned Comment, Retention Cue */}
      <ClipPackage clip={clip} onNotify={onNotify} />

      {/* 5. Content Rewards Workflow Tracker Fields: Status, Posted Link, Views, Live Earnings */}
      <TrackerFields clip={clip} campaign={campaign} onUpdateClip={onUpdateClip} />

      {/* Download / CLI Command Helper Modal */}
      <DownloadModal
        clip={clip}
        videoId={videoId}
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        onNotify={onNotify}
      />
    </article>
  );
}
