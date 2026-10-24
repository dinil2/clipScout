import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert } from 'lucide-react';

export default function RulesCheck({ rulesCheck }) {
  const [expanded, setExpanded] = useState(false);

  if (!rulesCheck) return null;

  const { passed, checks } = rulesCheck;
  const { duration, hashtags, mentions, bannedWords } = checks || {};

  return (
    <div className={`rounded-xl border p-2.5 transition text-xs ${
      passed
        ? 'bg-emerald-500/5 border-emerald-500/20'
        : 'bg-red-500/5 border-red-500/25'
    }`}>
      
      {/* Top Summary Bar */}
      <div 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          {passed ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span className={`font-semibold ${passed ? 'text-emerald-300' : 'text-amber-300'}`}>
            Campaign Rules: {passed ? '100% Compliant' : 'Issues Detected'}
          </span>
          <span className="text-zinc-500 hidden sm:inline">•</span>
          <span className="text-[11px] text-zinc-400 hidden sm:inline">
            {duration?.message}
          </span>
        </div>

        <div className="flex items-center gap-1 text-zinc-400">
          <span className="text-[11px]">{expanded ? 'Hide Details' : 'View Checklist'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </div>

      {/* Expanded Checklist */}
      {expanded && (
        <div className="mt-3 pt-2.5 border-t border-studio-800 space-y-2 text-zinc-300 animate-fade-in">
          {/* Duration */}
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Duration Range ({duration?.minSec}s - {duration?.maxSec}s):</span>
            <span className={`flex items-center gap-1 font-mono font-medium ${duration?.pass ? 'text-emerald-400' : 'text-red-400'}`}>
              {duration?.pass ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              <span>{duration?.currentSec}s ({duration?.pass ? 'Pass' : 'Violates limit'})</span>
            </span>
          </div>

          {/* Required Hashtags */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-zinc-400">Required Hashtags:</span>
            <div className="text-right">
              {hashtags?.pass ? (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>All present</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-red-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Missing: {hashtags?.missing?.join(', ')}</span>
                </span>
              )}
            </div>
          </div>

          {/* Required Mentions */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-zinc-400">Required Mentions:</span>
            <div className="text-right">
              {mentions?.pass ? (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>All present</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-red-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Missing: {mentions?.missing?.join(', ')}</span>
                </span>
              )}
            </div>
          </div>

          {/* Banned Words */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-zinc-400">Banned Words Check:</span>
            <div className="text-right">
              {bannedWords?.pass ? (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>None found</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-red-400 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Violations: {bannedWords?.violations?.join(', ')}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
