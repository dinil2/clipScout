import React, { useState } from 'react';
import { Copy, Check, Zap, MessageSquare, Sparkles, Hash, FileText } from 'lucide-react';

export default function ClipPackage({ clip, onNotify }) {
  const [copiedField, setCopiedField] = useState(null);

  const triggerCopy = (text, fieldName, label) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    if (onNotify) onNotify(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyAll = () => {
    const lines = [
      `🎬 TITLE:\n${clip.title}`,
      `⚡ ON-SCREEN HOOK:\n"${clip.hookText || clip.title}"`,
      `📝 DESCRIPTION:\n${clip.description}`,
      `🏷️ HASHTAGS:\n${(clip.hashtags || []).join(' ')}`,
      `💬 PINNED COMMENT:\n"${clip.pinnedComment || ''}"`,
      `✂️ EDITING CUE:\n"${clip.editingTip || ''}"`,
      `⏱️ TIMESTAMPS:\n${clip.startTime} - ${clip.endTime} (${clip.durationSeconds}s)`
    ];

    triggerCopy(lines.join('\n\n'), 'all', 'full campaign package');
  };

  return (
    <div className="space-y-3 pt-1">
      
      {/* Title & Copy */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
            {clip.title}
          </h3>
          <button
            type="button"
            onClick={() => triggerCopy(clip.title, 'title', 'title')}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-studio-800 transition shrink-0"
            title="Copy title"
          >
            {copiedField === 'title' ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Reasoning */}
        {clip.reasoning && (
          <p className="mt-1 text-xs text-amber-200/80 bg-amber-500/5 px-3 py-1.5 rounded-lg border border-amber-500/10">
            💡 {clip.reasoning}
          </p>
        )}
      </div>

      {/* ⚡ 3-Second On-Screen Hook Overlay Box */}
      {clip.hookText && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0">
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                3-Second Hook Overlay (CapCut / Premiere text)
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white">
                "{clip.hookText}"
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => triggerCopy(clip.hookText, 'hook', 'hook overlay')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold transition shrink-0 self-start sm:self-auto"
          >
            {copiedField === 'hook' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Hook</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Description Box */}
      <div className="bg-studio-900/80 rounded-xl p-3 border border-studio-800">
        <div className="flex items-center justify-between text-xs text-zinc-400 font-medium mb-1">
          <span>Shorts / Reel Caption</span>
          <button
            type="button"
            onClick={() => triggerCopy(clip.description, 'description', 'description')}
            className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition"
          >
            {copiedField === 'description' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
          {clip.description}
        </p>
      </div>

      {/* Hashtags */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(clip.hashtags || []).map((tag, i) => (
            <button
              key={i}
              type="button"
              onClick={() => triggerCopy(tag, `tag-${i}`, tag)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-studio-850 hover:bg-studio-800 border border-studio-750 text-xs font-mono text-zinc-300 transition"
              title={`Copy ${tag}`}
            >
              <Hash className="w-3 h-3 text-zinc-500" />
              <span>{tag.replace(/^#/, '')}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => triggerCopy((clip.hashtags || []).join(' '), 'hashtags', 'all hashtags')}
          className="self-start sm:self-auto inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition"
        >
          {copiedField === 'hashtags' ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied all</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy all tags</span>
            </>
          )}
        </button>
      </div>

      {/* Pinned Comment & Editing Cue */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {/* Pinned comment */}
        {clip.pinnedComment && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 block flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Pinned Comment
              </span>
              <p className="text-xs text-zinc-200 mt-0.5 line-clamp-2">
                "{clip.pinnedComment}"
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerCopy(clip.pinnedComment, 'pinned', 'pinned comment')}
              className="p-1 text-blue-400 hover:text-blue-200 shrink-0"
              title="Copy comment"
            >
              {copiedField === 'pinned' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {/* Editing Tip */}
        {clip.editingTip && (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-2.5 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Retention Cue
              </span>
              <p className="text-xs text-purple-200 mt-0.5 line-clamp-2">
                {clip.editingTip}
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerCopy(clip.editingTip, 'editingTip', 'editing cue')}
              className="p-1 text-purple-400 hover:text-purple-200 shrink-0"
              title="Copy editing cue"
            >
              {copiedField === 'editingTip' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Copy Full Package CTA */}
      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={handleCopyAll}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm ${
            copiedField === 'all'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-studio-800 hover:bg-studio-750 text-zinc-100 hover:text-white border border-studio-700'
          }`}
        >
          {copiedField === 'all' ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Full Package Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-amber-400" />
              <span>Copy Full Package</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
}
