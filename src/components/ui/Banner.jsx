import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

export default function Banner({
  children,
  type = 'info', // 'info' | 'warning' | 'error' | 'success'
  onClose,
  action,
  className = ''
}) {
  const typeConfig = {
    info: {
      bg: 'bg-surface-2 border-border text-text',
      icon: <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
    },
    warning: {
      bg: 'bg-accent/10 border-accent/30 text-text',
      icon: <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
    },
    error: {
      bg: 'bg-danger/10 border-danger/30 text-text',
      icon: <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
    },
    success: {
      bg: 'bg-success/10 border-success/30 text-text',
      icon: <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
    }
  }[type] || typeConfig.info;

  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-control border text-sm ${typeConfig.bg} ${className}`}>
      {typeConfig.icon}
      <div className="flex-1 min-w-0">
        {children}
      </div>
      {action && (
        <div className="shrink-0 ml-2">
          {action}
        </div>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-text p-0.5 rounded focus:outline-none"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

