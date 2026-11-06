import React from 'react';

export default function ProgressBar({
  percent = 0,
  message = '',
  timeHint = '',
  className = ''
}) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div className={`w-full flex flex-col gap-2 ${className}`} aria-live="polite">
      <div className="flex items-center justify-between text-xs sm:text-sm">
        <span className="font-medium text-text truncate pr-2">{message || 'Processing...'}</span>
        <span className="font-mono text-accent font-semibold shrink-0">{safePercent}%</span>
      </div>

      <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden border border-border">
        <div
          className="bg-accent h-2 transition-all duration-300 ease-out"
          style={{ width: `${safePercent}%` }}
        />
      </div>

      {timeHint && (
        <div className="text-xs text-muted flex items-center justify-between">
          <span>{timeHint}</span>
        </div>
      )}
    </div>
  );
}

