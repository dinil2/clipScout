import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import UrlInput from './components/UrlInput';
import VideoBanner from './components/VideoBanner';
import ClipCard from './components/ClipCard';
import { IdleState, LoadingState, ErrorState } from './components/StatusStates';
import Toast from './components/Toast';
import { SlidersHorizontal, Download, Share2, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'clipscout_history_v1';

export default function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [videoData, setVideoData] = useState(null);
  const [clips, setClips] = useState([]);
  const [analysisMeta, setAnalysisMeta] = useState({ isLivestreamArc: false, notice: null });
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [sortOption, setSortOption] = useState('virality'); // 'virality' | 'chronological' | 'shortest' | 'longest'
  const [history, setHistory] = useState([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to read localStorage:', e);
    }
  }, []);

  // Save successful run to history
  const saveToHistory = (video, clipsList) => {
    try {
      const entry = {
        video,
        clips: clipsList,
        timestamp: Date.now()
      };
      setHistory(prev => {
        const filtered = prev.filter(item => item.video?.videoId !== video.videoId);
        const updated = [entry, ...filtered].slice(0, 8);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  };

  const clearHistory = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setHistory([]);
      showToast('History cleared');
    } catch (e) {
      console.warn(e);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
  };

  // Perform Analysis API Call
  const handleAnalyze = async (videoId, fullUrl) => {
    setStatus('loading');
    setError(null);
    setVideoData(null);
    setClips([]);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to analyze video.');
      }

      if (!data.clips || data.clips.length === 0) {
        throw new Error('No Shorts clips could be generated for this video.');
      }

      setVideoData(data.video);
      setClips(data.clips);
      setAnalysisMeta({
        isLivestreamArc: !!data.isLivestreamArc,
        notice: data.notice || null
      });
      setStatus('success');
      saveToHistory(data.video, data.clips);
      showToast(`Found ${data.clips.length} viral Shorts moments!`);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Something went wrong while analyzing.');
      setStatus('error');
    }
  };

  const handleSelectFromHistory = (item) => {
    setVideoData(item.video);
    setClips(item.clips);
    setAnalysisMeta({ isLivestreamArc: false, notice: null });
    setUrl(`https://www.youtube.com/watch?v=${item.video.videoId}`);
    setStatus('success');
    showToast('Loaded from saved history');
  };

  const handleReset = () => {
    setStatus('idle');
    setVideoData(null);
    setClips([]);
    setAnalysisMeta({ isLivestreamArc: false, notice: null });
    setError(null);
  };

  // Sort clips based on selected option
  const sortedClips = useMemo(() => {
    if (!clips) return [];
    const list = [...clips];
    switch (sortOption) {
      case 'chronological':
        return list.sort((a, b) => a.startSeconds - b.startSeconds);
      case 'shortest':
        return list.sort((a, b) => a.durationSeconds - b.durationSeconds);
      case 'longest':
        return list.sort((a, b) => b.durationSeconds - a.durationSeconds);
      case 'virality':
      default:
        return list.sort((a, b) => b.viralityScore - a.viralityScore);
    }
  }, [clips, sortOption]);

  const handleExportJson = () => {
    if (!videoData || !clips.length) return;
    const payload = {
      video: videoData,
      clips,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `clipscout-${videoData.videoId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
    showToast('Exported clips as JSON');
  };

  return (
    <div className="min-h-screen bg-studio-950 text-zinc-100 flex flex-col font-sans">
      
      {/* Toast Alert */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {/* Header */}
        <Header />

        {/* Input Bar */}
        <UrlInput
          onSubmit={handleAnalyze}
          isLoading={status === 'loading'}
          currentUrl={url}
          onUrlChange={setUrl}
        />

        {/* Dynamic States */}
        {status === 'idle' && (
          <IdleState
            history={history}
            onSelectHistory={handleSelectFromHistory}
            onClearHistory={clearHistory}
          />
        )}

        {status === 'loading' && <LoadingState />}

        {status === 'error' && (
          <ErrorState error={error} onReset={handleReset} />
        )}

        {status === 'success' && videoData && (
          <div className="animate-fade-in">
            {/* Video Banner Summary */}
            <VideoBanner
              video={videoData}
              clipsCount={clips.length}
              onReset={handleReset}
              isLivestreamArc={analysisMeta.isLivestreamArc}
              notice={analysisMeta.notice}
            />

            {/* Results Filter & Sort Controls */}
            <section className="w-full max-w-4xl mx-auto px-4 mt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-studio-800">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white tracking-tight">
                    Shorts Clip Candidates
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-studio-800 text-zinc-400 font-mono">
                    {sortedClips.length} results
                  </span>
                </div>

                {/* Filter and Export Buttons */}
                <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
                  <div className="flex items-center gap-1.5 bg-studio-900 border border-studio-800 px-2.5 py-1.5 rounded-xl text-xs text-zinc-300">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-zinc-500 font-medium">Sort:</span>
                    <select
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value)}
                      className="bg-transparent text-zinc-200 font-medium focus:outline-none cursor-pointer"
                    >
                      <option value="virality" className="bg-studio-900">Highest Virality</option>
                      <option value="chronological" className="bg-studio-900">Chronological</option>
                      <option value="shortest" className="bg-studio-900">Shortest (15-30s)</option>
                      <option value="longest" className="bg-studio-900">Longest (35-58s)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-studio-800 text-xs font-medium text-zinc-300 hover:text-white transition"
                    title="Download candidate clips as JSON"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Export JSON</span>
                  </button>
                </div>
              </div>

              {/* Ranked Clip Cards Vertical List */}
              <div className="mt-5 space-y-4">
                {sortedClips.map((clip, index) => (
                  <ClipCard
                    key={clip.id || index}
                    clip={clip}
                    rank={index + 1}
                    videoId={videoData.videoId}
                    onNotify={showToast}
                  />
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-studio-850 py-6 text-center text-xs text-zinc-500">
        <p className="flex items-center justify-center gap-2">
          <span>ClipScout</span>
          <span>•</span>
          <span>Lightweight creator tool</span>
          <span>•</span>
          <span>No accounts, no database, 100% ephemeral</span>
        </p>
      </footer>

    </div>
  );
}
