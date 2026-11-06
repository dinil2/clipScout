import React from 'react';

export default function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
  description,
  id,
  className = ''
}) {
  const switchId = id || `switch-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      {(label || description) && (
        <label htmlFor={switchId} className="cursor-pointer select-none">
          {label && <div className="text-sm font-medium text-text">{label}</div>}
          {description && <div className="text-xs text-muted mt-0.5">{description}</div>}
        </label>
      )}

      <button
        type="button"
        id={switchId}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? 'bg-accent' : 'bg-surface-2 border-border'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-150 ease-in-out ${
            checked ? 'translate-x-5 !bg-accent-ink' : 'translate-x-0 !bg-muted'
          }`}
        />
      </button>
    </div>
  );
}

