import React, { useState } from 'react';
import { Copy, Check, Terminal, X, ShieldAlert, Download, Loader2 } from 'lucide-react';

export default function DownloadModal({
  clip,
  videoId,
  isOpen,
  onClose,
  onNotify
}) {
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const isLocalDownloadEnabled = import.meta.env.VITE_ENABLE_LOCAL_DOWNLOAD === 'true';

  if (!isOpen) return null;

  const safeTitle = (clip.title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
  const cliCommand = `yt-dlp --download-sections "*${clip.startTime}-${clip.endTime}" -f "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]/best" "https://www.youtube.com/watch?v=${videoId}" -o "${safeTitle}.mp4"`;

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(cliCommand);
    setCopied(true);
    if (onNotify) onNotify('Copied yt-dlp command to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLocalDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    if (onNotify) onNotify(`Clipping 1080p MP4 slice (${clip.durationSeconds}s)...`);

    try {
      const query = `videoId=${encodeURIComponent(videoId)}&start=${clip.startSeconds}&end=${clip.endSeconds}&title=${encodeURIComponent(clip.title)}`;
      const res = await fetch(`/api/download?${query}`);

      if (!res.ok || !res.headers.get('content-type')?.includes('video/')) {
        throw new Error('Local download engine failed. Ensure server/clipper.py prerequisites are met.');
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${safeTitle}_${clip.startSeconds}-${clip.endSeconds}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      if (onNotify) onNotify(`Downloaded 1080p MP4!`);
      onClose();
    } catch (err) {
      if (onNotify) onNotify(`Download error: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-studio-900 border border-studio-700 rounded-2xl p-6 shadow-2xl relative space-y-4">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-studio-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">
              {isLocalDownloadEnabled ? 'Download 1080p Clip' : 'Export Clip with yt-dlp'}
            </h3>
            <p className="text-xs text-zinc-400">
              {clip.startTime} → {clip.endTime} ({clip.durationSeconds}s)
            </p>
          </div>
        </div>

        {/* Compliance Warning */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-studio-950 border border-studio-800 text-xs text-zinc-400">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            <span className="font-semibold text-zinc-300">Creator Terms:</span> Only download source media that the campaign rules and original creator authorize for clipping.
          </p>
        </div>

        {/* CLI Command Box */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
            Terminal Command (Zero-waste selective download)
          </span>
          <div className="bg-black/90 p-3 rounded-xl border border-studio-800 font-mono text-xs text-amber-300 break-all select-all leading-relaxed">
            {cliCommand}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-studio-800">
          <button
            type="button"
            onClick={handleCopyCommand}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-white font-semibold text-xs border border-studio-700 transition"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">Command Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-amber-400" />
                <span>Copy yt-dlp Command</span>
              </>
            )}
          </button>

          {isLocalDownloadEnabled && (
            <button
              type="button"
              onClick={handleLocalDownload}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-studio-950 font-bold text-xs transition disabled:opacity-50"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-studio-950" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Local 1080p</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
