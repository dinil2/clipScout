import React from 'react';

export default function Card({
  children,
  className = '',
  onClick,
  ...props
}) {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      className={`bg-surface border border-border rounded-card p-4 sm:p-6 transition-all duration-150 ${
        isClickable ? 'cursor-pointer hover:border-border/80 hover:bg-surface-2/40' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

