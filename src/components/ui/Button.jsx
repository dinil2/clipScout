import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Button({
  children,
  variant = 'secondary',
  size = 'default',
  isLoading = false,
  disabled = false,
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-control transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

  const sizeClasses = {
    sm: 'h-9 px-3 text-xs gap-1.5',
    default: 'h-11 px-4 text-sm gap-2',
    lg: 'h-12 px-6 text-sm sm:text-base gap-2.5 font-semibold'
  }[size] || 'h-11 px-4 text-sm gap-2';

  const variantClasses = {
    primary: 'bg-accent hover:bg-accent-hover active:bg-accent-active text-accent-ink font-semibold shadow-accent hover:shadow-lg',
    secondary: 'bg-surface-2 hover:bg-surface-2/80 text-text border border-border hover:border-border/80',
    ghost: 'bg-transparent hover:bg-surface-2 text-muted hover:text-text',
    danger: 'bg-surface hover:bg-danger/10 text-danger border border-danger/30 hover:border-danger/60',
    accentGhost: 'bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 hover:border-accent/40'
  }[variant] || 'bg-surface-2 text-text border border-border';

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
      {children}
    </button>
  );
}

