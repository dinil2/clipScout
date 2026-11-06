import React from 'react';

export default function Segmented({
  options = [],
  value,
  onChange,
  size = 'default',
  className = '',
  disabled = false
}) {
  const sizeClasses = {
    sm: 'p-0.5 text-xs',
    default: 'p-1 text-xs sm:text-sm'
  }[size] || 'p-1 text-sm';

  const itemSizeClasses = {
    sm: 'h-7 px-2.5',
    default: 'h-8 px-3'
  }[size] || 'h-8 px-3';

  return (
    <div
      role="radiogroup"
      className={`inline-flex items-center bg-surface border border-border rounded-control select-none ${sizeClasses} ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled || opt.disabled}
            onClick={() => onChange?.(opt.value)}
            className={`relative flex items-center justify-center font-medium rounded-[8px] transition-all duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${itemSizeClasses} ${
              isSelected
                ? 'bg-surface-2 text-text shadow-sm border border-border/80 font-semibold'
                : 'text-muted hover:text-text hover:bg-surface-2/40'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

