import React, { useState } from 'react';
import Header from './components/studio/Header.jsx';
import Hero from './components/studio/Hero.jsx';
import SourceCard from './components/studio/SourceCard.jsx';
import StageProgress from './components/studio/StageProgress.jsx';
import ClipGrid from './components/studio/ClipGrid.jsx';
import SettingsDrawer from './components/studio/SettingsDrawer.jsx';
import OfflineState from './components/studio/OfflineState.jsx';
import Banner from './components/ui/Banner.jsx';
import Button from './components/ui/Button.jsx';
import Toast from './components/ui/Toast.jsx';

import { useEngine } from './hooks/useEngine.js';
import { useJob } from './hooks/useJob.js';
import { loadSettings } from './lib/storage.js';
import { RotateCcw, AlertCircle, ArrowLeft } from 'lucide-react';

export default function App() {
  const { isConnected, isChecking, checkConnection } = useEngine();
  const [options, setOptions] = useState(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const {
    jobId,
    status,
    stage,
    progress,
    uploadPercent,
    notice,
    error,
    video,
    clips,
    startJob,
    uploadAndStartJob,
    cancel,
    reset
  } = useJob();

  const isProcessing = status === 'uploading' || status === 'running';
  const hasClips = clips.length > 0;
  const isFinished = status === 'completed';

  const handleStartUrl = (url) => {
    startJob(url, options);
  };

  const handleUploadFile = (file) => {
    uploadAndStartJob(file, options);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col antialiased selection:bg-accent selection:text-accent-ink">
      
      {/* 1. Header */}
      <Header
        isEngineConnected={isConnected}
        onOpenSettings={() => setSettingsOpen(true)}
        onReset={reset}
      />

      {/* Main Flow Container */}
      <main className="flex-1 w-full max-w-container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-8">
        
        {/* If Engine is offline while on idle, show friendly action recovery box */}
        {!isConnected && status === 'idle' ? (
          <OfflineState onRetry={checkConnection} isChecking={isChecking} />
        ) : (
          <>
            {/* If connection hiccup occurs while job is active, show subtle reconnection banner without unmounting */}
            {!isConnected && status !== 'idle' && (
              <div className="w-full max-w-4xl mx-auto -mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between text-xs text-amber-300">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Reconnecting to local engine in background...</span>
                </div>
                <button
                  type="button"
                  onClick={checkConnection}
                  disabled={isChecking}
                  className="px-2.5 py-1 bg-surface border border-border hover:bg-surface-hover rounded text-text font-medium transition-colors"
                >
                  {isChecking ? 'Checking...' : 'Check now'}
                </button>
              </div>
            )}

            {/* STAGE A: Hero Input (Only on Idle or after Reset) */}
            {status === 'idle' && (
              <Hero
                onSubmitUrl={handleStartUrl}
                onUploadFile={handleUploadFile}
                isProcessing={isProcessing}
                uploadPercent={uploadPercent}
                options={options}
                setOptions={setOptions}
                showGuideStrip={!hasClips}
              />
            )}

            {/* STAGE B: Active Processing or Completed Session */}
            {status !== 'idle' && (
              <div className="w-full flex flex-col gap-6 max-w-4xl mx-auto">
                
                {/* Back to Input Navigation when Done or Failed */}
                {(isFinished || status === 'failed' || status === 'cancelled') && (
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={reset}
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-muted hover:text-text cursor-pointer transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Start new video</span>
                    </button>
                  </div>
                )}

                {/* Source Card */}
                {video && <SourceCard video={video} />}

                {/* Active Progress Stage Card (while uploading or processing) */}
                {isProcessing && (
                  <StageProgress
                    stage={stage}
                    progress={progress}
                    notice={notice}
                    onCancel={cancel}
                  />
                )}

                {/* Error Banner with Retry */}
                {status === 'failed' && (
                  <Banner
                    type="error"
                    action={
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={reset}
                        className="text-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        <span>Try another link</span>
                      </Button>
                    }
                  >
                    <div className="font-semibold text-danger">Processing stopped</div>
                    <div className="text-xs text-text mt-0.5">{error || 'An unexpected error occurred.'}</div>
                  </Banner>
                )}

                {/* Cancelled Banner */}
                {status === 'cancelled' && (
                  <Banner
                    type="info"
                    action={
                      <Button variant="secondary" size="sm" onClick={reset}>
                        <span>New Job</span>
                      </Button>
                    }
                  >
                    <span>Job was cancelled.</span>
                  </Banner>
                )}

                {/* Clips Grid (appears as soon as clips start rendering!) */}
                {(hasClips || (isProcessing && stage === 'cutting_clips')) && (
                  <ClipGrid
                    clips={clips}
                    jobId={jobId}
                    isRendering={isProcessing}
                    targetClipCount={Number(options.clipCount) || 10}
                    onShowToast={showToast}
                    className="mt-4"
                  />
                )}

              </div>
            )}
          </>
        )}

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border/40 py-6 text-center text-xs text-muted">
        <div className="max-w-container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>ClipScout — $0 Local Podcast to Shorts Studio</span>
          <span>Single-User Architecture • Local FFmpeg & Groq Whisper</span>
        </div>
      </footer>

      {/* Settings Drawer */}
      <SettingsDrawer
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSettingsSaved={(newSettings) => setOptions(newSettings)}
      />

      {/* Toast Feedback */}
      <Toast
        message={toastMessage}
        onClose={() => setToastMessage(null)}
      />

    </div>
  );
}
