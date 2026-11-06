import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({
  message,
  type = 'success',
  onClose,
  duration = 3000
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const iconMap = {
    success: <CheckCircle2 className="w-4 h-4 text-success shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-danger shrink-0" />,
    info: <Info className="w-4 h-4 text-accent shrink-0" />
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-surface-2 border border-border/80 shadow-2xl rounded-control text-sm text-text animate-slide-up backdrop-blur-md">
      {iconMap[type] || iconMap.success}
      <span className="font-medium pr-1">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="text-muted hover:text-text p-1 rounded transition-colors ml-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

