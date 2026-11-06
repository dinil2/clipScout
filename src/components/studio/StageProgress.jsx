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

