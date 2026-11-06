import React, { useState } from 'react';
import { 
  Download, FileText, ExternalLink, Play, Sparkles, 
  Hash, Clock, Check, TrendingUp, Tag
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
  onShowToast,
  className = ''
}) {
  const [title, setTitle] = useState(clip.title || '');
  const [description, setDescription] = useState(clip.description || '');
  const [hashtags, setHashtags] = useState(clip.hashtags || ['#Shorts']);
  const [isCheckingTags, setIsCheckingTags] = useState(false);

  const startSec = Math.floor(clip.startSeconds || 0);
  const endSec = Math.ceil(clip.endSeconds || 0);
  const duration = Math.round(clip.durationSeconds || (endSec - startSec));

  const mp4Url = clip.mp4Url || defaultEngineClient.getClipMp4Url(jobId, clip.id);
  const mp4DownloadUrl = defaultEngineClient.getClipMp4Url(jobId, clip.id, true);
  const srtUrl = clip.srtUrl || defaultEngineClient.getClipSrtUrl(jobId, clip.id);

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

  return (
    <Card className={`flex flex-col md:grid md:grid-cols-[200px_1fr] gap-4 md:gap-5 !p-4 md:!p-5 bg-surface border-border hover:border-border/80 transition-all ${className}`}>
      
      {/* LEFT COLUMN: 9:16 Vertical Video Preview */}
      <div className="flex flex-col items-center shrink-0">
        <div className="relative w-full max-w-[200px] aspect-[9/16] rounded-control overflow-hidden bg-black border border-border shadow-md">
          {clip.rendered ? (
            <video
              src={mp4Url}
              controls
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-muted gap-2 bg-surface-2">
              <Play className="w-8 h-8 opacity-40 animate-pulse text-accent" />
              <span className="text-xs">Rendering video...</span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Clip Studio Metadata & YouTube Package */}
      <div className="flex flex-col justify-between gap-3 min-w-0">
        
        {/* Top Bar: Rank, Time Range, Virality Score */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/25">
              #{clip.rank}
            </span>

            <span className="font-mono text-xs text-text flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-muted shrink-0" />
              <span>{clip.startTime} – {clip.endTime}</span>
              <span className="text-muted">({duration}s)</span>
            </span>
          </div>

          <Chip variant="accent" size="sm" className="font-mono">
            <Sparkles className="w-3 h-3" />
            <span>Score {clip.viralityScore || 85}/100</span>
          </Chip>
        </div>

        {/* Reasoning / Evidence Quote */}
        {clip.reasoning && (
          <p className="text-xs text-muted/90 italic leading-relaxed line-clamp-2">
            "{clip.reasoning}"
          </p>
        )}

        {/* Editable Title */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text uppercase tracking-wider text-[11px]">Title</span>
            <div className="flex items-center gap-2">
              <CharCounter count={title.length} target={70} max={100} />
              <CopyButton text={title} label="Copy" size="sm" variant="ghost" className="!h-6 !px-2 !text-[11px]" />
            </div>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-9 px-3 bg-surface-2 text-text text-sm rounded-control border border-border focus-visible:outline-none focus-visible:border-accent font-medium transition-all"
            placeholder="Shorts title..."
          />
        </div>

        {/* Editable Description */}
        <div className="flex flex-col gap-1.5">
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
            className="w-full p-2.5 bg-surface-2 text-text text-xs rounded-control border border-border focus-visible:outline-none focus-visible:border-accent resize-none leading-relaxed transition-all"
            placeholder="Shorts description..."
          />
        </div>

        {/* Hashtags Chips */}
        <div className="flex flex-col gap-1.5">
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

          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
            {hashtags.map((tag, idx) => (
              <Chip key={idx} variant={tag.toLowerCase() === '#shorts' ? 'accent' : 'default'} size="sm">
                {tag}
              </Chip>
            ))}
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="mt-auto pt-3 border-t border-border/60 flex flex-col gap-2">
          
          {/* Primary Action Buttons (Side by Side) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
            <a
              href={mp4DownloadUrl}
              download
              className="inline-flex items-center justify-center h-10 px-3 text-xs sm:text-sm font-bold rounded-control bg-accent hover:bg-accent-hover text-accent-ink shadow-accent transition-all cursor-pointer text-center"
            >
              <Download className="w-4 h-4 mr-1.5 shrink-0" />
              <span>Download MP4</span>
            </a>

            <Button
              variant="secondary"
              size="default"
              onClick={handleCopyYouTubePackage}
              className="!h-10 text-xs sm:text-sm !font-semibold w-full justify-center"
            >
              <FileText className="w-4 h-4 mr-1.5 text-accent shrink-0" />
              <span>Copy for Studio</span>
            </Button>
          </div>

          {/* Secondary Utilities */}
          <div className="flex items-center justify-between text-xs text-muted pt-1 px-0.5">
            <a
              href={srtUrl}
              download
              className="inline-flex items-center gap-1 text-muted hover:text-text hover:underline transition-colors cursor-pointer"
              title="Download synchronized subtitles (.srt)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Captions (.srt)</span>
            </a>

            <a
              href="https://studio.youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline font-medium"
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

