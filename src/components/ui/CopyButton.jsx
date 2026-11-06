import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyButton({
  text = '',
  label = 'Copy',
  copiedLabel = 'Copied',
  variant = 'secondary',
  size = 'default',
  className = '',
  onCopied
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e?.stopPropagation();
    if (!text) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 1500); // 1.5s as requested in Instruction 9
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const sizeClasses = {
    sm: 'h-8 px-2.5 text-xs gap-1.5',
    default: 'h-9 px-3 text-xs gap-1.5'
  }[size] || 'h-9 px-3 text-xs gap-1.5';

  const variantClasses = {
    secondary: 'bg-surface-2 hover:bg-surface-2/80 text-text border border-border',
    ghost: 'bg-transparent hover:bg-surface-2 text-muted hover:text-text',
    accent: 'bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 font-medium'
  }[variant] || 'bg-surface-2 text-text border border-border';

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center justify-center font-medium rounded-control transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95 ${sizeClasses} ${variantClasses} ${
        copied ? '!bg-success/20 !border-success/40 !text-success' : ''
      } ${className}`}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          {copiedLabel && <span>{copiedLabel}</span>}
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          {label && <span>{label}</span>}
        </>
      )}
    </button>
  );
}

