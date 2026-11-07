import React, { useState, useEffect } from 'react';
import Drawer from '../ui/Drawer.jsx';
import Button from '../ui/Button.jsx';
import { defaultEngineClient } from '../../api/engineClient.js';
import { Clock, Play, CheckCircle2, AlertCircle, History } from 'lucide-react';

export default function RecentJobsDrawer({
  isOpen = false,
  onClose,
  currentJobId,
  onSelectJob
}) {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadJobs();
    }
  }, [isOpen]);

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      const list = await defaultEngineClient.listRecentJobs();
      setJobs(list);
    } catch {
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Recent Podcast Jobs">
      <div className="flex flex-col gap-3 py-2">
        <div className="flex items-center justify-between text-xs text-muted pb-2 border-b border-border">
          <span>Your recent podcast clipping sessions</span>
          <button
            type="button"
            onClick={loadJobs}
            disabled={isLoading}
            className="text-accent hover:underline cursor-pointer font-medium"
          >
            {isLoading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="py-12 text-center text-muted flex flex-col items-center gap-2">
            <History className="w-8 h-8 opacity-30" />
            <p className="text-sm">No recent jobs found on engine.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[70vh] pr-1">
            {jobs.map((j) => {
              const isCurrent = j.id === currentJobId;
              const dateStr = j.createdAt ? new Date(j.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }) : '';

              return (
                <div
                  key={j.id}
                  className={`p-3 rounded-control border transition-all flex flex-col gap-2 ${
                    isCurrent
                      ? 'bg-accent/10 border-accent/40 shadow-sm'
                      : 'bg-surface-2 border-border hover:border-border/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-semibold text-text text-sm truncate">
                        {j.title}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-muted font-mono mt-0.5">
                        {j.durationFormatted && <span>{j.durationFormatted}</span>}
                        <span>•</span>
                        <span>{dateStr}</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {j.status === 'completed' ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-success/15 text-success border border-success/30 font-medium">
                          {j.renderedCount || j.clipCount} Clips
                        </span>
                      ) : j.status === 'running' ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/30 font-medium animate-pulse">
                          Running
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/15 text-muted border border-border font-medium">
                          {j.status}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/40">
                    <span className="text-[11px] font-mono text-muted/80">{j.id}</span>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectJob?.(j.id);
                        onClose?.();
                      }}
                      className={`text-xs px-2.5 py-1 rounded font-semibold cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-accent text-accent-ink'
                          : 'bg-surface text-text hover:text-accent border border-border'
                      }`}
                    >
                      {isCurrent ? 'Active Job' : 'Open Job'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Drawer>
  );
}

