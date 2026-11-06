import React, { useState } from 'react';
import { Sparkles, Clipboard, ArrowRight, Video, UploadCloud, Link as LinkIcon } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Segmented from '../ui/Segmented.jsx';
import Dropzone from '../ui/Dropzone.jsx';
import { CLIP_COUNT_OPTIONS, DURATION_PRESETS, FORMAT_OPTIONS } from '../../lib/constants.js';

export default function Hero({
  onSubmitUrl,
  onUploadFile,
  isProcessing = false,
  uploadPercent = 0,
  options,
  setOptions,
  showGuideStrip = true
}) {
  const [url, setUrl] = useState('');
  const [showUploadMode, setShowUploadMode] = useState(false);
  const [inputError, setInputError] = useState('');

  const handlePaste = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrl(text.trim());
          setInputError('');
        }
      }
    } catch {}
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (isProcessing) return;

    const trimmed = url.trim();
    if (!trimmed) {
      setInputError('Please enter a YouTube or Google Drive link.');
      return;
    }

    const isYoutube = trimmed.includes('youtube.com') || trimmed.includes('youtu.be') || /^[a-zA-Z0-9_-]{11}$/.test(trimmed);
    const isDrive = trimmed.includes('drive.google.com');

    if (!isYoutube && !isDrive) {
      setInputError('Please enter a valid YouTube or public Google Drive URL.');
      return;
    }

    setInputError('');
    onSubmitUrl(trimmed);
  };

  return (
    <div className="w-full max-w-[720px] mx-auto text-center flex flex-col items-center pt-6 sm:pt-12 pb-8">
      {/* Badge / Pill */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-semibold mb-6">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Snazo-Style 9:16 Vertical Video Studio</span>
      </div>

      {/* Main Headline */}
      <h1 className="text-3xl sm:text-5xl font-extrabold text-text tracking-tight leading-[1.15] mb-4">
        Turn your podcast into Shorts
      </h1>

      {/* Subtext */}
      <p className="text-sm sm:text-base text-muted max-w-lg mb-8 leading-relaxed">
        Paste a YouTube or Google Drive link of your podcast to generate 9:16 vertical clips with burned-in captions.
      </p>

      {/* Input Section */}
      <div className="w-full mb-6">
        {!showUploadMode ? (
          <form onSubmit={handleSubmit} className="w-full">
            <div className="relative flex flex-col sm:flex-row items-center gap-2 p-1.5 bg-surface border border-border rounded-2xl shadow-card focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all">
              <div className="relative flex items-center w-full pl-3 pr-2">
                <LinkIcon className="w-5 h-5 text-muted shrink-0 mr-2" />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (inputError) setInputError('');
                  }}
                  placeholder="Paste YouTube or Google Drive link..."
                  disabled={isProcessing}
                  className="w-full h-11 bg-transparent text-text text-sm sm:text-base placeholder:text-muted/60 focus:outline-none disabled:opacity-50"
                />
                {!url && (
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-muted hover:text-text bg-surface-2 rounded-control border border-border hover:border-border/80 transition-colors shrink-0"
                  >
                    <Clipboard className="w-3 h-3" />
                    Paste
                  </button>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isProcessing}
                disabled={isProcessing || !url.trim()}
                className="w-full sm:w-auto shrink-0 !rounded-xl"
              >
                <span>Get clips</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {inputError && (
              <p className="text-xs text-danger mt-2 text-left px-2">{inputError}</p>
            )}

            {/* Toggle to upload laptop video */}
            <div className="mt-3 text-xs text-muted">
              <span>Have a video file on your computer? </span>
              <button
                type="button"
                onClick={() => setShowUploadMode(true)}
                className="text-accent hover:underline font-medium cursor-pointer"
              >
                or upload a video
              </button>
            </div>
          </form>
        ) : (
          <div className="w-full flex flex-col items-center gap-3">
            <Dropzone
              onFileSelected={onUploadFile}
              isUploading={isProcessing}
              uploadPercent={uploadPercent}
            />
            <button
              type="button"
              onClick={() => setShowUploadMode(false)}
              className="text-xs text-muted hover:text-text cursor-pointer underline underline-offset-2"
            >
              Back to link input
            </button>
          </div>
        )}
      </div>

      {/* ONE Compact Row of Options */}
      <div className="w-full p-3 bg-surface border border-border rounded-card flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted font-medium">Clips:</span>
          <Segmented
            options={CLIP_COUNT_OPTIONS}
            value={options.clipCount}
            onChange={(val) => setOptions(prev => ({ ...prev, clipCount: val }))}
            size="sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted font-medium">Length:</span>
          <Segmented
            options={DURATION_PRESETS}
            value={options.durationPreset}
            onChange={(val) => setOptions(prev => ({ ...prev, durationPreset: val }))}
            size="sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted font-medium">Format:</span>
          <Segmented
            options={FORMAT_OPTIONS}
            value={options.format}
            onChange={(val) => setOptions(prev => ({ ...prev, format: val }))}
            size="sm"
          />
        </div>
      </div>

      {/* Quiet 3-Step Strip (shown only before first run) */}
      {showGuideStrip && (
        <div className="mt-10 pt-8 border-t border-border/40 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full text-left">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-mono font-bold text-accent shrink-0">
              1
            </div>
            <div>
              <div className="text-sm font-semibold text-text">Paste link</div>
              <div className="text-xs text-muted mt-0.5">YouTube, Google Drive, or laptop file.</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-mono font-bold text-accent shrink-0">
              2
            </div>
            <div>
              <div className="text-sm font-semibold text-text">Get clips</div>
              <div className="text-xs text-muted mt-0.5">AI extracts high-hook viral moments.</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-mono font-bold text-accent shrink-0">
              3
            </div>
            <div>
              <div className="text-sm font-semibold text-text">Download & post</div>
              <div className="text-xs text-muted mt-0.5">Captioned MP4s + 1-click YouTube Studio copy.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

