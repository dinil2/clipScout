import React from 'react';
import Card from '../ui/Card.jsx';
import StageList from '../ui/StageList.jsx';
import ProgressBar from '../ui/ProgressBar.jsx';
import Button from '../ui/Button.jsx';
import Banner from '../ui/Banner.jsx';
import { XCircle } from 'lucide-react';

export default function StageProgress({
  stage = 'reading_video',
  progress = { percent: 0, message: '' },
  notice = '',
  currentClipProgress = null,
  onCancel,
  className = ''
}) {
  return (
    <Card className={`flex flex-col gap-5 border-accent/25 shadow-accent/5 ${className}`}>
      {/* 4-Stage visual status */}
      <StageList currentStage={stage} />

      {/* Progress Bar with time hint */}
      <ProgressBar
        percent={progress.percent}
        message={progress.message}
        timeHint="~20–60 seconds per clip render"
      />

      {/* Free tier rate-limit notice banner if active */}
      {notice && (
        <Banner type="warning">
          <span>{notice}</span>
        </Banner>
      )}

      {/* Accurate Active Clip Live Progress (Resets from 0% to 100% per video) */}
      {stage === 'cutting_clips' && currentClipProgress && (
        <div className="p-3.5 rounded-control bg-surface-2/80 border border-emerald-500/25 flex flex-col gap-2 transition-all">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>
                Clip #{currentClipProgress.clipNumber} of {currentClipProgress.totalClips}:
              </span>
              <span className="text-muted font-normal text-[11px] sm:text-xs">
                {currentClipProgress.phase === 'downloading'
                  ? 'Fetching audio & video from YouTube...'
                  : (currentClipProgress.phase === 'ready' ? 'Clip rendered!' : 'Burning hook title & subtitles...')}
              </span>
            </span>
            <span className="font-mono text-emerald-400 font-bold text-sm shrink-0">
              {currentClipProgress.percent}%
              {currentClipProgress.etaSec > 0 && currentClipProgress.percent < 100 && (
                <span className="text-muted font-normal text-xs ml-1.5 hidden sm:inline">
                  (~{currentClipProgress.etaSec}s left)
                </span>
              )}
            </span>
          </div>

          {/* Green progress bar as requested */}
          <div className="w-full h-2 rounded-full bg-black/60 border border-border/40 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              style={{ width: `${Math.min(100, Math.max(0, currentClipProgress.percent))}%` }}
            />
          </div>
        </div>
      )}

      {/* Cancel button */}
      <div className="flex justify-end pt-2 border-t border-border/60">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-muted hover:text-danger hover:bg-danger/10"
        >
          <XCircle className="w-4 h-4 mr-1" />
          <span>Cancel processing</span>
        </Button>
      </div>
    </Card>
  );
}

