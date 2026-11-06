import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Drawer({
  isOpen = false,
  onClose,
  title,
  children,
  className = ''
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className={`relative z-10 w-full max-w-md h-full bg-surface border-l border-border shadow-2xl flex flex-col p-6 overflow-y-auto animate-fade-in ${className}`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
          <h2 id="drawer-title" className="text-lg font-semibold text-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 rounded-control text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-6">
          {children}
        </div>
      </div>
    </div>
  );
}

