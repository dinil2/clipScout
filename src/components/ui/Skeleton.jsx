import React from 'react';

export default function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse bg-surface-2/60 rounded-card ${className}`}
      aria-hidden="true"
    />
  );
}

export function ClipSkeletonCard() {
  return (
    <div className="bg-surface border border-border/80 rounded-card p-4 sm:p-5 flex flex-col md:grid md:grid-cols-[200px_1fr] gap-4 md:gap-5 animate-pulse">
      {/* 9:16 Video preview placeholder */}
      <div className="w-full max-w-[200px] aspect-[9/16] bg-surface-2 rounded-control mx-auto md:mx-0 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-border/50" />
      </div>

      {/* Meta & Form placeholders */}
      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="h-6 w-24 bg-surface-2 rounded-full" />
          <div className="h-4 w-16 bg-surface-2 rounded" />
        </div>

        <div className="h-5 w-3/4 bg-surface-2 rounded" />
        <div className="h-16 w-full bg-surface-2 rounded-control" />

        <div className="flex gap-2">
          <div className="h-6 w-16 bg-surface-2 rounded-full" />
          <div className="h-6 w-16 bg-surface-2 rounded-full" />
          <div className="h-6 w-16 bg-surface-2 rounded-full" />
        </div>

        <div className="mt-auto pt-3 border-t border-border/60 flex flex-wrap gap-2">
          <div className="h-10 w-32 bg-surface-2 rounded-control" />
          <div className="h-10 w-36 bg-surface-2 rounded-control" />
        </div>
      </div>
    </div>
  );
}

