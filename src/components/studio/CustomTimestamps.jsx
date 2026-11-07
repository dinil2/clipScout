import React, { useState } from 'react';
import { Clock, Plus, Trash2, ChevronDown, ChevronUp, Sparkles, AlertCircle } from 'lucide-react';
import Button from '../ui/Button.jsx';

/**
 * Parses clock string (HH:MM:SS or MM:SS) into seconds
 */
export function parseClockToSec(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.trim().split(':');
  if (parts.length === 3) {
    const h = parseFloat(parts[0]);
    const m = parseFloat(parts[1]);
    const s = parseFloat(parts[2]);
    if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const m = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    if (isNaN(m) || isNaN(s)) return null;
    return m * 60 + s;
  }
  const n = parseFloat(timeStr);
  return isNaN(n) ? null : n;
}

/**
 * Formats duration in seconds to "Xs" or "Xm Ys"
 */
function formatDuration(sec) {
  if (sec == null || isNaN(sec) || sec <= 0) return null;
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

export default function CustomTimestamps({
  ranges = [],
  onChange,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(ranges.length > 0);

  const handleAddRange = () => {
    setIsOpen(true);
    onChange([
      ...ranges,
      { start: '', end: '', id: `range_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` }
    ]);
  };

  const handleUpdate = (index, field, value) => {
    const updated = [...ranges];
    const current = { ...updated[index] };

    // Smart paste handler: if pasting "01:19:00 - 01:19:47" into start field
    if (field === 'start' && value && (value.includes('-') || value.includes('–') || value.toLowerCase().includes(' to '))) {
      const parts = value.split(/\s*(?:[-–—]|\bto\b)\s*/i);
      if (parts.length >= 2) {
        current.start = parts[0].trim();
        current.end = parts[1].trim();
        updated[index] = current;
        onChange(updated);
        return;
      }
    }

    current[field] = value;
    updated[index] = current;
    onChange(updated);
  };

  const handleRemove = (index) => {
    const updated = ranges.filter((_, i) => i !== index);
    onChange(updated);
    if (updated.length === 0) {
      setIsOpen(false);
    }
  };

  const activeValidCount = ranges.filter(r => r.start?.trim() && r.end?.trim()).length;

  return (
    <div className={`w-full mt-3 rounded-card border transition-all ${
      isOpen || ranges.length > 0 
        ? 'bg-surface border-border p-3.5 shadow-sm' 
        : 'bg-surface/50 border-border/60 p-2.5 hover:border-border hover:bg-surface'
    } ${className}`}>
      
      {/* Header bar / Toggle */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (!isOpen && ranges.length === 0) {
              handleAddRange();
            } else {
              setIsOpen(!isOpen);
            }
          }}
          className="flex items-center gap-2 text-left text-xs sm:text-sm font-semibold text-text hover:text-accent transition-colors cursor-pointer group"
        >
          <div className="w-6 h-6 rounded-md bg-accent/15 text-accent flex items-center justify-center shrink-0">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span>Favorite Timestamps</span>
            <span className="text-[11px] font-normal text-muted group-hover:text-muted/80">
              (Optional — renders first with top priority)
            </span>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {activeValidCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {activeValidCount} {activeValidCount === 1 ? 'Moment Pinned' : 'Moments Pinned'}
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              if (!isOpen && ranges.length === 0) {
                handleAddRange();
              } else {
                setIsOpen(!isOpen);
              }
            }}
            className="p-1 rounded text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
            aria-label={isOpen ? 'Collapse favorite timestamps' : 'Expand favorite timestamps'}
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Timestamps Editor */}
      {isOpen && (
        <div className="mt-3.5 pt-3 border-t border-border/60 flex flex-col gap-3">
          <p className="text-xs text-muted leading-relaxed">
            Have specific scenes you want clipped? Enter their start & end times (e.g. <span className="font-mono text-text">01:19:00 – 01:19:47</span>). Pinned moments are given highest priority and rendered as <span className="text-accent font-semibold">Clip #1, #2...</span> first.
          </p>

          {/* List of Time Range Rows */}
          <div className="flex flex-col gap-2.5">
            {ranges.map((range, idx) => {
              const startSec = parseClockToSec(range.start);
              const endSec = parseClockToSec(range.end);
              const isValidDuration = startSec != null && endSec != null && endSec > startSec;
              const durationSec = isValidDuration ? (endSec - startSec) : null;
              const hasInvertedTimes = startSec != null && endSec != null && endSec <= startSec;

              return (
                <div
                  key={range.id || idx}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-control bg-surface-2/70 border border-border"
                >
                  {/* Priority Indicator Pill */}
                  <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-accent/20 text-accent border border-accent/30">
                      <Sparkles className="w-3 h-3" />
                      Priority #{idx + 1}
                    </span>
                    
                    {/* Duration badge on mobile */}
                    {isValidDuration && (
                      <span className="sm:hidden font-mono text-[11px] text-emerald-400 font-semibold">
                        {formatDuration(durationSec)}
                      </span>
                    )}
                  </div>

                  {/* Start & End Inputs */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={range.start}
                      onChange={(e) => handleUpdate(idx, 'start', e.target.value)}
                      placeholder="Start (01:19:00)"
                      className="h-8 px-2.5 bg-black/40 border border-border/80 focus:border-accent rounded text-xs font-mono text-text placeholder:text-muted/50 focus:outline-none"
                    />

                    <span className="text-muted text-xs font-mono">→</span>

                    <input
                      type="text"
                      value={range.end}
                      onChange={(e) => handleUpdate(idx, 'end', e.target.value)}
                      placeholder="End (01:19:47)"
                      className="h-8 px-2.5 bg-black/40 border border-border/80 focus:border-accent rounded text-xs font-mono text-text placeholder:text-muted/50 focus:outline-none"
                    />
                  </div>

                  {/* Duration Badge on Desktop */}
                  <div className="hidden sm:flex items-center justify-center min-w-[50px] shrink-0 font-mono text-xs">
                    {isValidDuration ? (
                      <span className="text-emerald-400 font-semibold">
                        {formatDuration(durationSec)}
                      </span>
                    ) : (
                      <span className="text-muted/50 text-[11px]">--</span>
                    )}
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    title="Remove this timestamp"
                    className="p-1.5 self-end sm:self-center text-muted hover:text-danger hover:bg-danger/10 rounded transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Error if end time is before start */}
                  {hasInvertedTimes && (
                    <div className="sm:col-span-full w-full text-[11px] text-danger flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>End time must be after start time.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Another Timestamp Button */}
          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddRange}
              className="text-xs !py-1.5"
            >
              <Plus className="w-3.5 h-3.5 mr-1 text-accent" />
              <span>Add another timestamp</span>
            </Button>

            {ranges.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onChange([]);
                  setIsOpen(false);
                }}
                className="text-xs text-muted hover:text-text cursor-pointer underline underline-offset-2"
              >
                Clear all timestamps
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

