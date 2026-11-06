import React from 'react';

export default function CharCounter({
  count = 0,
  target = 70,
  max = 100,
  className = ''
}) {
  const isOverTarget = count > target;
  const isOverMax = count > max;

  return (
    <span
      className={`font-mono text-[11px] ${
        isOverMax
          ? 'text-danger font-semibold'
          : isOverTarget
          ? 'text-accent'
          : 'text-muted'
      } ${className}`}
    >
      {count}/{max}
    </span>
  );
}

