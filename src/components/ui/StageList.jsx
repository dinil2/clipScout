import React from 'react';
import { Check, Loader2, Circle } from 'lucide-react';

const STAGES = [
  { id: 'reading_video', label: '1. Reading video' },
  { id: 'transcribing', label: '2. Transcribing' },
  { id: 'finding_moments', label: '3. Finding moments' },
  { id: 'cutting_clips', label: '4. Cutting clips' }
];

export default function StageList({ currentStage = 'reading_video', isDone = false, className = '' }) {
  const getStageIndex = (stageId) => {
    return STAGES.findIndex(s => s.id === stageId);
  };

  const currentIndex = isDone ? STAGES.length : getStageIndex(currentStage);

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 ${className}`}>
      {STAGES.map((stg, idx) => {
        const isCompleted = isDone || idx < currentIndex;
        const isActive = !isDone && idx === currentIndex;

        return (
          <div
            key={stg.id}
            className={`flex items-center gap-2 p-2.5 rounded-control border text-xs sm:text-sm transition-all duration-150 ${
              isActive
                ? 'bg-accent/10 border-accent/40 text-accent font-medium'
                : isCompleted
                ? 'bg-surface-2/70 border-border text-text'
                : 'bg-surface/40 border-border/40 text-muted opacity-60'
            }`}
          >
            {isCompleted ? (
              <div className="w-4 h-4 rounded-full bg-success/20 text-success flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </div>
            ) : isActive ? (
              <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-muted/40 shrink-0" />
            )}
            <span className="truncate">{stg.label}</span>
          </div>
        );
      })}
    </div>
  );
}

