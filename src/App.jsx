import React, { useState, Component } from 'react';
import Header from './components/studio/Header.jsx';
import Hero from './components/studio/Hero.jsx';
import SourceCard from './components/studio/SourceCard.jsx';
import StageProgress from './components/studio/StageProgress.jsx';
import ClipGrid from './components/studio/ClipGrid.jsx';
import SettingsDrawer from './components/studio/SettingsDrawer.jsx';
import RecentJobsDrawer from './components/studio/RecentJobsDrawer.jsx';
import OfflineState from './components/studio/OfflineState.jsx';
import Banner from './components/ui/Banner.jsx';
import Button from './components/ui/Button.jsx';
import Toast from './components/ui/Toast.jsx';

import { useEngine } from './hooks/useEngine.js';
import { useJob } from './hooks/useJob.js';
import { loadSettings } from './lib/storage.js';
import { RotateCcw, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

/**
 * Top-level Error Boundary to prevent blank white screens
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Studio uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0C10] text-[#F4F5F7] flex flex-col items-center justify-center p-6 text-center antialiased">
          <div className="max-w-md w-full p-6 rounded-xl bg-[#12141B] border border-[#262A36] shadow-xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold">Studio Interface Error</h1>
            <p className="text-xs text-[#A1A7B5] leading-relaxed">
              {this.state.error?.message || 'An unexpected rendering error occurred in the browser.'}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#FFB020] text-[#1A1203] font-bold rounded-lg hover:bg-[#E59D17] transition-all cursor-pointer text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Studio</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function StudioApp() {
  const { isConnected, isChecking, checkConnection } = useEngine();
  const [options, setOptions] = useState(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recentJobsOpen, setRecentJobsOpen] = useState(false);
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
    currentClipProgress,
    startJob,
    uploadAndStartJob,
    rerenderClip,
    selectJob,
    cancel,
    reset
  } = useJob();

  const isProcessing = status === 'uploading' || status === 'running';
  const hasClips = clips.length > 0;
  const isFinished = status === 'completed';

  const handleStartUrl = (url, customRanges = []) => {
    startJob(url, { ...options, customRanges });
  };

  const handleUploadFile = (file, customRanges = []) => {
    uploadAndStartJob(file, { ...options, customRanges });
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
        onOpenRecent={() => setRecentJobsOpen(true)}
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
                    currentClipProgress={currentClipProgress}
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

                {/* Clips Grid (appears as soon as moments are found and start cutting) */}
                {(hasClips || (isProcessing && stage === 'cutting_clips')) && (
                  <ClipGrid
                    clips={clips}
                    jobId={jobId}
                    isRendering={isProcessing}
                    currentClipProgress={currentClipProgress}
                    targetClipCount={Number(options.clipCount) || 10}
                    onShowToast={showToast}
                    onRerenderClip={rerenderClip}
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

      {/* Recent Jobs Drawer */}
      <RecentJobsDrawer
        isOpen={recentJobsOpen}
        onClose={() => setRecentJobsOpen(false)}
        currentJobId={jobId}
        onSelectJob={(id) => selectJob(id)}
      />

      {/* Toast Feedback */}
      <Toast
        message={toastMessage}
        onClose={() => setToastMessage(null)}
      />

    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StudioApp />
    </ErrorBoundary>
  );
}
