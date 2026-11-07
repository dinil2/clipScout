import React, { useState } from 'react';
import { 
  Download, FileText, ExternalLink, Play, Sparkles, 
  Hash, Clock, Check, TrendingUp, Tag, RefreshCw, AlertCircle, Sliders
} from 'lucide-react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import CopyButton from '../ui/CopyButton.jsx';
import CharCounter from '../ui/CharCounter.jsx';
import Chip from '../ui/Chip.jsx';
import { defaultEngineClient } from '../../api/engineClient.js';

export default function ClipCard({
  clip,
  jobId,
  currentClipProgress = null,
  onShowToast,
  onRerenderClip,
  className = ''
}) {
  const [onScreenTitle, setOnScreenTitle] = useState(clip.onScreenTitle || clip.title || '');
  const [title, setTitle] = useState(clip.title || '');
  const [description, setDescription] = useState(clip.description || '');
  const [hashtags, setHashtags] = useState(clip.hashtags || ['#Shorts']);
  const [framing, setFraming] = useState(clip.framing || 'fill');
  const [focusX, setFocusX] = useState(typeof clip.focusX === 'number' ? clip.focusX : 0.5);
  const [showFramingControls, setShowFramingControls] = useState(false);
  const [isCheckingTags, setIsCheckingTags] = useState(false);
  const [isRerenderingLocal, setIsRerenderingLocal] = useState(false);

  const startSec = Math.floor(clip.startSeconds || 0);
  const endSec = Math.ceil(clip.endSeconds || 0);
  const duration = Math.round(clip.durationSeconds || (endSec - startSec));

  const mp4Url = clip.mp4Url || defaultEngineClient.getClipMp4Url(jobId, clip.id);
  const mp4DownloadUrl = defaultEngineClient.getClipMp4Url(jobId, clip.id, true);
  const srtUrl = clip.srtUrl || defaultEngineClient.getClipSrtUrl(jobId, clip.id);

  const hasEdits = onScreenTitle !== (clip.onScreenTitle || clip.title || '') ||
    framing !== (clip.framing || 'fill') ||
    focusX !== (clip.focusX ?? 0.5);

  const isBusy = clip.isRerendering || isRerenderingLocal;

  // 1-Click YouTube Studio Package (Title + Description + Hashtags)
  const fullYouTubeStudioText = `${title}\n\n${description}\n\n${hashtags.join(' ')}`;

  const handleCopyYouTubePackage = () => {
    navigator.clipboard?.writeText(fullYouTubeStudioText);
    onShowToast?.('Copied full package for YouTube Studio!');
  };

  const handleCheckTrendingTags = async () => {
    setIsCheckingTags(true);
    try {
      const res = await defaultEngineClient.fetchTrendingTags(jobId, title);
      if (res?.available && Array.isArray(res.hashtags) && res.hashtags.length > 0) {
        const newTags = [...hashtags];
        for (const item of res.hashtags) {
          if (!newTags.includes(item.tag) && newTags.length < 15) {
            newTags.push(item.tag);
          }
        }
        setHashtags(newTags);
        onShowToast?.(`Added ${res.hashtags.length} trending topic hashtags!`);
      } else {
        onShowToast?.(res?.message || 'No additional trending tags found.');
      }
    } catch {
      onShowToast?.('Trending tags check unavailable.');
    } finally {
      setIsCheckingTags(false);
    }
  };

  const handleTriggerRerender = async () => {
    setIsRerenderingLocal(true);
    try {
      if (onRerenderClip) {
        await onRerenderClip(clip.id, { onScreenTitle, framing, focusX });
      } else {
        await defaultEngineClient.rerenderClip(jobId, clip.id, { onScreenTitle, framing, focusX });
      }
      onShowToast?.('Clip re-rendered successfully!');
    } catch (err) {
      onShowToast?.(`Re-render failed: ${err.message}`);
    } finally {
      setIsRerenderingLocal(false);
    }
  };

  return (
    <Card className={`flex flex-col sm:grid sm:grid-cols-[180px_1fr] md:grid-cols-[200px_1fr] gap-4 md:gap-5 !p-4 md:!p-5 bg-surface border-border hover:border-border/80 transition-all ${className}`}>
      
      {/* LEFT COLUMN: 9:16 Vertical Video Preview */}
      <div className="flex flex-col items-center shrink-0 w-full sm:w-[180px] md:w-[200px]">
        <div className="relative w-full aspect-[9/16] rounded-control overflow-hidden bg-black border border-border shadow-md flex items-center justify-center">
          {clip.rendered && !isBusy ? (
            <video
              src={mp4Url}
              controls
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-muted gap-2 bg-[#0B0C10]">
              {currentClipProgress?.clipId === clip.id ? (
                <div className="flex flex-col items-center gap-2.5 w-full px-2">
                  <div className="relative flex items-center justify-center">
                    <span className="w-9 h-9 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
                    <span className="absolute font-mono text-[10px] font-bold text-emerald-400">
                      {currentClipProgress.percent}%
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-300">
                    {currentClipProgress.phase === 'downloading' ? 'Fetching clip...' : 'Cutting & subtitles...'}
                  </span>
                  <div className="w-full max-w-[130px] h-1.5 rounded-full bg-surface-2 overflow-hidden border border-emerald-500/30">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                      style={{ width: `${Math.min(100, Math.max(0, currentClipProgress.percent))}%` }}
                    />
                  </div>
                  {currentClipProgress.etaSec > 0 && currentClipProgress.percent < 100 && (
                    <span className="text-[10px] font-mono text-muted">
                      ~{currentClipProgress.etaSec}s left
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <Play className={`w-8 h-8 text-accent ${isBusy ? 'animate-spin' : 'opacity-40 animate-pulse'}`} />
                  <span className="text-xs font-medium text-text">
                    {isBusy ? 'Re-rendering clip...' : (clip.renderError ? 'Render failed' : 'In render queue...')}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Framing Badge */}
          <div className="absolute top-2 left-2 pointer-events-none">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/75 text-text border border-white/10 backdrop-blur-sm">
              {framing === 'fill' ? 'Fill 1:1' : 'Fit'}
            </span>
          </div>
        </div>

        {/* Video Framing Toggle Link */}
        <button
          type="button"
          onClick={() => setShowFramingControls(!showFramingControls)}
          className="mt-2 text-[11px] text-muted hover:text-accent flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Sliders className="w-3 h-3" />
          <span>{showFramingControls ? 'Hide framing' : 'Adjust framing & crop'}</span>
        </button>

        {showFramingControls && (
          <div className="w-full mt-2 p-2 bg-surface-2 rounded-control border border-border flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted text-[11px]">Framing:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFraming('fill')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    framing === 'fill' ? 'bg-accent text-accent-ink font-bold' : 'text-muted hover:text-text'
                  }`}
                >
                  Fill 1:1
                </button>
                <button
                  type="button"
                  onClick={() => setFraming('fit')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    framing === 'fit' ? 'bg-accent text-accent-ink font-bold' : 'text-muted hover:text-text'
                  }`}
                >
                  Fit
                </button>
              </div>
            </div>

            {framing === 'fill' && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] text-muted">
                  <span>Focus (Left - Center - Right)</span>
                  <span className="font-mono">{Math.round(focusX * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={focusX}
                  onChange={(e) => setFocusX(parseFloat(e.target.value))}
                  className="w-full accent-accent h-1.5 bg-border rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Clip Studio Metadata & YouTube Package */}
      <div className="flex flex-col justify-between gap-3 min-w-0">
        
        {/* Top Bar: Rank, Time Range, Virality Score */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/25">
              #{clip.rank}
            </span>

            {clip.isPinned && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Sparkles className="w-3 h-3" />
                Priority Moment
              </span>
            )}

            <span className="font-mono text-xs text-text flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-muted shrink-0" />
              <span>{clip.startTime} – {clip.endTime}</span>
              <span className="text-muted text-[11px]">({duration}s)</span>
            </span>
          </div>

          <Chip variant="accent" size="sm" className="font-mono text-xs">
            <Sparkles className="w-3 h-3 mr-0.5" />
            <span>Score {clip.viralityScore || 85}/100</span>
          </Chip>
        </div>

        {/* Render Error Alert */}
        {clip.renderError && (
          <div className="p-2.5 rounded-control bg-danger/10 border border-danger/30 text-danger text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{clip.renderError}</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTriggerRerender}
              disabled={isBusy}
              className="!h-6 !px-2 text-[11px] shrink-0"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Hook Overlay Title (The text burned onto the top of the video) */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text uppercase tracking-wider text-[11px] flex items-center gap-1">
              <span>On-Screen Hook Title</span>
              <span className="text-accent text-[10px] font-normal">(Burned on video)</span>
            </span>
            <div className="flex items-center gap-2">
              <CharCounter count={onScreenTitle.length} target={45} max={60} />
              {(hasEdits || clip.renderError) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTriggerRerender}
                  disabled={isBusy}
                  className="!h-6 !px-2 text-[11px] !border-accent/40 !text-accent hover:!bg-accent/10"
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${isBusy ? 'animate-spin' : ''}`} />
                  <span>Re-render</span>
                </Button>
              )}
            </div>
          </div>
          <input
            type="text"
            value={onScreenTitle}
            onChange={(e) => setOnScreenTitle(e.target.value)}
            className="w-full h-8 px-2.5 bg-surface-2 text-text text-xs rounded-control border border-border focus-visible:outline-none focus-visible:border-accent font-medium transition-all"
            placeholder="Bold text displayed on video..."
          />
        </div>

        {/* YouTube Studio Title */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text uppercase tracking-wider text-[11px]">YouTube Title</span>
            <div className="flex items-center gap-2">
              <CharCounter count={title.length} target={70} max={100} />
              <CopyButton text={title} label="Copy" size="sm" variant="ghost" className="!h-6 !px-2 !text-[11px]" />
            </div>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-8 px-2.5 bg-surface-2 text-text text-xs rounded-control border border-border focus-visible:outline-none focus-visible:border-accent font-medium transition-all"
            placeholder="YouTube Shorts title..."
          />
        </div>

        {/* YouTube Description */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text uppercase tracking-wider text-[11px]">Description</span>
            <div className="flex items-center gap-2">
              <CharCounter count={description.length} target={300} max={5000} />
              <CopyButton text={description} label="Copy" size="sm" variant="ghost" className="!h-6 !px-2 !text-[11px]" />
            </div>
          </div>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 bg-surface-2 text-text text-xs rounded-control border border-border focus-visible:outline-none focus-visible:border-accent resize-none leading-relaxed transition-all"
            placeholder="Shorts description..."
          />
        </div>

        {/* Hashtags Chips */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text uppercase tracking-wider text-[11px] flex items-center gap-1">
              <Hash className="w-3.5 h-3.5 text-accent" />
              <span>Tags ({hashtags.length}/15)</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCheckTrendingTags}
                disabled={isCheckingTags}
                className="text-[11px] text-accent hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50 font-medium"
                title="Check top video hashtags on YouTube for this topic"
              >
                <TrendingUp className="w-3 h-3" />
                <span>{isCheckingTags ? 'Checking...' : '+ Trending'}</span>
              </button>
              <CopyButton text={hashtags.join(' ')} label="Copy" size="sm" variant="ghost" className="!h-6 !px-2 !text-[11px]" />
            </div>
          </div>

          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
            {hashtags.map((tag, idx) => (
              <Chip key={idx} variant={tag.toLowerCase() === '#shorts' ? 'accent' : 'default'} size="sm" className="!text-[11px] !py-0.5 !px-2">
                {tag}
              </Chip>
            ))}
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="mt-auto pt-2.5 border-t border-border/60 flex flex-col gap-2">
          
          {/* Primary Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
            <a
              href={mp4DownloadUrl}
              download
              className="inline-flex items-center justify-center h-9 px-3 text-xs font-bold rounded-control bg-accent hover:bg-accent-hover text-accent-ink shadow-accent transition-all cursor-pointer text-center"
            >
              <Download className="w-4 h-4 mr-1.5 shrink-0" />
              <span>Download MP4</span>
            </a>

            <Button
              variant="secondary"
              size="default"
              onClick={handleCopyYouTubePackage}
              className="!h-9 text-xs !font-semibold w-full justify-center"
            >
              <FileText className="w-4 h-4 mr-1.5 text-accent shrink-0" />
              <span>Copy for Studio</span>
            </Button>
          </div>

          {/* Secondary Utilities */}
          <div className="flex items-center justify-between text-xs text-muted pt-0.5 px-0.5">
            <a
              href={srtUrl}
              download
              className="inline-flex items-center gap-1 text-muted hover:text-text hover:underline transition-colors cursor-pointer text-[11px]"
              title="Download synchronized subtitles (.srt)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Captions (.srt)</span>
            </a>

            <a
              href="https://studio.youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline font-medium text-[11px]"
            >
              <span>Open Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

        </div>

      </div>

    </Card>
  );
}
