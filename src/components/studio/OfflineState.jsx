import React, { useState } from 'react';
import { WifiOff, Terminal, RotateCcw, Copy, Check } from 'lucide-react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';

export default function OfflineState({ onRetry, isChecking = false }) {
  const [copied, setCopied] = useState(false);
  const command = 'npm run app';

  const handleCopy = () => {
    navigator.clipboard?.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="w-full max-w-lg mx-auto py-12 px-4 text-center">
      <Card className="flex flex-col items-center p-6 sm:p-8 border-border bg-surface shadow-xl">
        <div className="w-14 h-14 rounded-full bg-danger/10 border border-danger/25 text-danger flex items-center justify-center mb-4">
          <WifiOff className="w-6 h-6" />
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-text mb-2">
          Engine is Offline
        </h2>

        <p className="text-sm text-muted mb-6 leading-relaxed">
          ClipScout runs at <span className="text-accent font-semibold">$0 cost</span> on your computer using local FFmpeg and Groq. The background engine is not running on <span className="font-mono text-text">http://127.0.0.1:8787</span>.
        </p>

        {/* Command terminal box */}
        <div className="w-full bg-bg border border-border rounded-control p-3.5 flex items-center justify-between text-left font-mono text-xs sm:text-sm mb-6">
          <div className="flex items-center gap-2 text-text">
            <Terminal className="w-4 h-4 text-accent shrink-0" />
            <span>{command}</span>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-muted hover:text-text bg-surface-2 rounded border border-border hover:border-border/80 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-success" />
                <span className="text-success">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={onRetry}
          isLoading={isChecking}
          className="w-full"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          <span>Check Connection</span>
        </Button>
      </Card>
    </div>
  );
}

