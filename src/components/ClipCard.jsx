import React, { useState } from 'react';
import { 
  Copy, Check, Download, Play, Pause, Sparkles, 
  Clock, Hash, FileText, Lightbulb, Quote, ExternalLink,
  Flame, CheckCircle2, AlertCircle, Share2
} from 'lucide-react';

export default function ClipCard({ 
  clip, 
  videoData, 
  onShowToast, 
  onDownloadError 
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [copiedType, setCopiedType] = useState(null); // 'all' | 'title' | 'tags' | 'desc'
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const videoId = videoData?.videoId;
  const startSec = Math.floor(clip.startSeconds || 0);
  const endSec = Math.ceil(clip.endSeconds || startSec + 30);
  const duration = Math.round(clip.durationSeconds || endSec - startSec);

  // Formatted YouTube Package for 1-Click Copy
  const allTagsString = (clip.trendingHashtags || clip.hashtags || ['#shorts', '#podcast']).join(' ');
  const fullYouTubeStudioText = `${clip.title}\n\n${clip.description}\n\nWatch full episode: https://www.youtube.com/watch?v=${videoId}\n\n${allTagsString}`;

  // Copy helper
  const handleCopy = (text, type, toastLabel) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    onShowToast?.(`Copied ${toastLabel} to clipboard!`);
    setTimeout(() => setCopiedType(null), 2500);
  };

  // Direct MP4 Download Handler
  const handleDownloadMp4 = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const safeTitle = (clip.title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 45);
      const identifier = videoData?.localFilePath || videoData?.googleDriveUrl || videoId;
      const url = `/api/download?videoId=${encodeURIComponent(identifier)}&start=${startSec}&end=${endSec}&title=${encodeURIComponent(safeTitle)}`;

      const res = await fetch(url);
      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('video/mp4')) {
        // Direct MP4 file stream from local clipper!
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${safeTitle}_${startSec}-${endSec}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);

        onShowToast?.(`✅ Downloaded "${clip.title}"!`);
      } else {
        // Fallback for cloud/Netlify environment where local Python runtime isn't active
        const data = await res.json();
        onDownloadError?.(data, clip);
      }
    } catch (err) {
      console.error('Download error:', err);
      onDownloadError?.({ error: err.message }, clip);
    } finally {
      setIsDownloading(false);
    }
  };

  // Subtitles (.SRT) download
  const handleDownloadSrt = () => {
    if (!clip.srtContent) return;
    const blob = new Blob([clip.srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles_${startSec}-${endSec}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast?.('Downloaded .SRT subtitles file!');
  };

  // Score tier color
  const score = clip.viralityScore || 85;
  const isTopScore = score >= 88;

  return (
    <div className="rounded-2xl bg-studio-900/90 border border-studio-700/80 shadow-xl overflow-hidden backdrop-blur-md transition-all duration-300 hover:border-violet-500/40 hover:shadow-2xl hover:shadow-violet-950/20">
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        
        {/* ============================================================== */}
        {/* LEFT COLUMN: Video Clip Preview & Timestamps (5 cols)           */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 p-5 bg-studio-950/70 border-b lg:border-b-0 lg:border-r border-studio-800 flex flex-col justify-between">
          <div>
            {/* Top Tag & Score Badge */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Clip #{clip.rank || 1}
              </span>

              {/* Score Pill */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                isTopScore 
                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300' 
                  : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              }`}>
                <Flame className={`w-3.5 h-3.5 ${isTopScore ? 'text-amber-400' : 'text-emerald-400'}`} />
                <span>{score}/100</span>
                <span className="text-[10px] opacity-75 hidden sm:inline">
                  {score >= 90 ? 'Viral Peak' : 'High Retention'}
                </span>
              </div>
            </div>

            {/* Embedded Player: Laptop Video, Google Drive, or YouTube */}
            <div className="relative aspect-[9/16] max-h-[360px] w-full rounded-xl overflow-hidden bg-black border border-studio-700/80 shadow-inner mx-auto mb-4">
              {videoData?.localBlobUrl ? (
                <video
                  src={`${videoData.localBlobUrl}#t=${startSec},${endSec}`}
                  controls
                  playsInline
                  className="w-full h-full object-contain bg-black"
                />
              ) : videoData?.isGoogleDrive ? (
                <iframe
                  src={videoData.googleDriveUrl?.includes('/preview') ? videoData.googleDriveUrl : `https://drive.google.com/file/d/${videoId}/preview`}
                  title={clip.title}
                  className="w-full h-full object-cover"
                  allow="autoplay"
                />
              ) : videoId && videoId.length === 11 ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${videoId}?start=${startSec}&end=${endSec}&autoplay=0&rel=0&modestbranding=1`}
                  title={clip.title}
                  className="w-full h-full object-cover"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs p-4 text-center">
                  Video Preview ({clip.startTime} – {clip.endTime})
                </div>
              )}
            </div>

            {/* Timestamp & Duration Pill */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-studio-900 border border-studio-800 text-xs">
              <div className="flex items-center gap-2 text-zinc-300 font-mono">
                <Clock className="w-3.5 h-3.5 text-violet-400" />
                <span>{clip.startTime || `${startSec}s`} – {clip.endTime || `${endSec}s`}</span>
                <span className="text-zinc-500">({duration}s)</span>
              </div>

              {videoId && (
                <a
                  href={`https://youtu.be/${videoId}?t=${startSec}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-400 hover:text-violet-300 inline-flex items-center gap-1 transition"
                  title="Open on YouTube"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>YouTube</span>
                </a>
              )}
            </div>
          </div>

          {/* Subtitles Button */}
          {clip.srtContent && (
            <button
              onClick={handleDownloadSrt}
              className="mt-3 w-full py-2 px-3 rounded-lg bg-studio-850 hover:bg-studio-800 border border-studio-700/60 text-zinc-300 hover:text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 transition"
            >
              <FileText className="w-3.5 h-3.5 text-zinc-400" />
              <span>Download Subtitles (.SRT)</span>
            </button>
          )}
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: YouTube Studio Package & Fast Upload Actions (7) */}
        {/* ============================================================== */}
        <div className="lg:col-span-7 p-5 sm:p-6 flex flex-col justify-between space-y-5">
          
          <div className="space-y-4">
            {/* Title with Quick Copy */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  YouTube Shorts Title
                </span>
                <button
                  onClick={() => handleCopy(clip.title, 'title', 'Title')}
                  className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-studio-800 transition"
                >
                  {copiedType === 'title' ? (
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
              <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                {clip.title}
              </h3>
            </div>

            {/* THE TWO MAIN ACTION BUTTONS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              
              {/* PRIMARY ACTION 1: Copy All for YouTube Studio */}
              <button
                type="button"
                onClick={() => handleCopy(fullYouTubeStudioText, 'all', 'YouTube Studio Package (Title + Description + Tags)')}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-semibold text-sm shadow-lg shadow-emerald-600/20 transition"
              >
                {copiedType === 'all' ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Copied for Studio!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-emerald-200" />
                    <span>Copy for YouTube Studio</span>
                  </>
                )}
              </button>

              {/* PRIMARY ACTION 2: Direct MP4 Download Button */}
              <button
                type="button"
                onClick={handleDownloadMp4}
                disabled={isDownloading}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98] text-white font-semibold text-sm shadow-lg shadow-violet-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Trimming MP4...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-amber-300" />
                    <span>Download Clip (MP4)</span>
                  </>
                )}
              </button>

            </div>

            {/* Trending Hashtags Section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3 h-3 text-violet-400" />
                  Trending Hashtags
                </span>
                <button
                  onClick={() => handleCopy(allTagsString, 'tags', 'Hashtags')}
                  className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-studio-800 transition"
                >
                  {copiedType === 'tags' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Tags</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(clip.trendingHashtags || clip.hashtags || ['#shorts', '#podcast']).map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md bg-studio-950 border border-studio-800 text-xs font-medium text-zinc-300 hover:border-violet-500/40 transition cursor-default"
                  >
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            </div>

            {/* Hook Quote Box (verbatim words from speaker) */}
            {clip.evidenceQuote && (
              <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-500/20 text-xs">
                <div className="flex items-center gap-1.5 text-violet-300 font-semibold mb-1">
                  <Quote className="w-3.5 h-3.5" />
                  <span>Opening Hook Quote:</span>
                </div>
                <p className="text-zinc-300 italic">
                  "{clip.evidenceQuote}"
                </p>
              </div>
            )}

            {/* YouTube Description Preview with Quick Copy */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-zinc-400" />
                  Shorts Description
                </span>
                <button
                  onClick={() => handleCopy(clip.description, 'desc', 'Description')}
                  className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-studio-800 transition"
                >
                  {copiedType === 'desc' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Description</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-400 line-clamp-2 bg-studio-950/60 p-2.5 rounded-lg border border-studio-800 font-mono">
                {clip.description}
              </p>
            </div>

            {/* Editing Tip for Premiere / CapCut */}
            {clip.editingTip && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-studio-950/40 border border-studio-800/80 text-xs text-zinc-400">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-zinc-300">Editor Cue:</strong> {clip.editingTip}
                </p>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
