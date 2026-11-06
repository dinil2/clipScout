import React from 'react';

export default function Chip({
  children,
  variant = 'default',
  size = 'default',
  onClick,
  onRemove,
  className = '',
  ...props
}) {
  const isClickable = Boolean(onClick);

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-0.5 gap-1',
    default: 'text-xs sm:text-sm px-3 py-1 gap-1.5'
  }[size] || 'text-xs px-2.5 py-1 gap-1.5';

  const variantClasses = {
    default: 'bg-surface-2 text-muted border border-border',
    accent: 'bg-accent/10 text-accent border border-accent/30 font-medium',
    success: 'bg-success/10 text-success border border-success/30 font-medium',
    danger: 'bg-danger/10 text-danger border border-danger/30 font-medium',
    active: 'bg-accent text-accent-ink font-semibold'
  }[variant] || 'bg-surface-2 text-muted border border-border';

  const Component = isClickable ? 'button' : 'span';

  return (
    <Component
      type={isClickable ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center rounded-full transition-all duration-150 select-none ${sizeClasses} ${variantClasses} ${
        isClickable ? 'cursor-pointer hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent' : ''
      } ${className}`}
      {...props}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:text-danger rounded-full focus:outline-none"
        >
          ×
        </button>
      )}
    </Component>
  );
}

