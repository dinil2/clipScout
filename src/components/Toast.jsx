import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, 2800);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up flex items-center gap-3 px-4 py-3 rounded-xl bg-studio-850/95 border border-studio-700/80 shadow-2xl backdrop-blur-md text-sm text-zinc-100 max-w-md">
      {type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
      ) : (
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
      )}
      <p className="flex-1 font-medium">{message}</p>
      <button
        onClick={onClose}
        className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-studio-700/50 transition"
        title="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
