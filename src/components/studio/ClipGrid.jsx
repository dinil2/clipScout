import React from 'react';
import { DownloadCloud, Sparkles } from 'lucide-react';
import ClipCard from './ClipCard.jsx';
import { ClipSkeletonCard } from '../ui/Skeleton.jsx';
import { defaultEngineClient } from '../../api/engineClient.js';

export default function ClipGrid({
  clips = [],
  jobId,
  isRendering = false,
  targetClipCount = 10,
  onShowToast,
  className = ''
}) {
  const renderedClips = clips.filter(c => c.rendered);
  const pendingCount = isRendering ? Math.max(0, targetClipCount - renderedClips.length) : 0;
  const zipUrl = defaultEngineClient.getZipDownloadUrl(jobId);

  return (
    <div className={`w-full flex flex-col gap-6 ${className}`}>
      
      {/* Results Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div className="flex items-center gap-3">
          <div className="h-9 px-3 rounded-control bg-accent/15 text-accent border border-accent/25 flex items-center justify-center font-bold font-mono text-sm">
            {renderedClips.length} {renderedClips.length === 1 ? 'Clip' : 'Clips'}
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-text">
              {renderedClips.length} {renderedClips.length === 1 ? 'Clip' : 'Clips'} Ready
            </h2>
            <p className="text-xs text-muted">
              {isRendering ? `Rendering remaining moments in the background...` : `Vertical 9:16 MP4s with burned-in subtitles`}
            </p>
          </div>
        </div>

        {renderedClips.length > 0 && (
          <a
            href={zipUrl}
            download
            className="inline-flex items-center justify-center h-10 px-4 text-xs sm:text-sm font-semibold rounded-control bg-surface-2 hover:bg-surface-2/80 text-text border border-border hover:border-accent/40 shadow-sm transition-all cursor-pointer"
          >
            <DownloadCloud className="w-4 h-4 mr-2 text-accent" />
            <span>Download all (ZIP)</span>
          </a>
        )}
      </div>

      {/* Responsive Grid: 1 col on mobile/tablet/laptop, 2 cols on wide screens (>= 1280px) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-7 w-full">
        {/* Rendered live clips */}
        {renderedClips.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            jobId={jobId}
            onShowToast={onShowToast}
          />
        ))}

        {/* Skeleton placeholders while cutting */}
        {isRendering && Array.from({ length: pendingCount }).map((_, idx) => (
          <ClipSkeletonCard key={`skel-${idx}`} />
        ))}
      </div>

    </div>
  );
}

