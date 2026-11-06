import React from 'react';
import { ExternalLink, Video, Clock, User } from 'lucide-react';
import Card from '../ui/Card.jsx';

export default function SourceCard({ video, className = '' }) {
  if (!video) return null;

  return (
    <Card className={`flex flex-col sm:flex-row items-center gap-4 !p-4 bg-surface-2/40 border-border/80 ${className}`}>
      {/* Thumbnail */}
      <div className="relative w-full sm:w-44 aspect-video rounded-control overflow-hidden bg-surface-2 border border-border shrink-0 flex items-center justify-center">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Video className="w-8 h-8 text-muted" />
        )}
        {video.durationFormatted && (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[11px] font-semibold text-white">
            {video.durationFormatted}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0 w-full flex flex-col justify-center gap-1.5">
        <h3 className="font-semibold text-text text-sm sm:text-base leading-snug line-clamp-2">
          {video.title}
        </h3>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {video.channel && (
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              <span className="truncate max-w-[180px]">{video.channel}</span>
            </span>
          )}

          {video.durationFormatted && (
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>{video.durationFormatted}</span>
            </span>
          )}

          {video.webpageUrl && (
            <a
              href={video.webpageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline font-medium"
            >
              <span>Source link</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}

