import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import UrlInput from './components/UrlInput';
import VideoBanner from './components/VideoBanner';
import TimelineBar from './components/TimelineBar';
import ClipCard from './components/ClipCard';
import { IdleState, LoadingState, ErrorState } from './components/StatusStates';
import Toast from './components/Toast';
import { SlidersHorizontal, Download, Share2, Sparkles, Filter, Copy, Check, Flame, Smile, Brain, AlertCircle, Trophy, Scissors } from 'lucide-react';

const STORAGE_KEY = 'clipscout_history_v1';
const STATUS_STORAGE_KEY = 'clipscout_clip_statuses_v1';

export default function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [videoData, setVideoData] = useState(null);
  const [clips, setClips] = useState([]);
  const [analysisMeta, setAnalysisMeta] = useState({ isLivestreamArc: false, notice: null });
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [sortOption, setSortOption] = useState('virality'); // 'virality' | 'chronological' | 'shortest' | 'longest'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [clipStatuses, setClipStatuses] = useState({});
  const [history, setHistory] = useState([]);

  // Load history and clip statuses from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(STORAGE_KEY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
      const savedStatuses = localStorage.getItem(STATUS_STORAGE_KEY);
      if (savedStatuses) {
        setClipStatuses(JSON.parse(savedStatuses));
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

  const handleStatusChange = (clipId, newStatus) => {
    const updated = { ...clipStatuses, [clipId]: newStatus };
    setClipStatuses(updated);
    try {
      localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }
    showToast(`Marked clip as "${newStatus === 'todo' ? 'To Edit' : newStatus === 'ready' ? 'Ready' : 'Posted'}"`);
  };

  // Perform Analysis API Call
  const handleAnalyze = async (videoId, fullUrl) => {
    setStatus('loading');
    setError(null);
    setVideoData(null);
    setClips([]);
    setSelectedCategory('all');
    setSelectedStatus('all');

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
      showToast(`Scouted ${data.clips.length} viral candidate Shorts moments!`);
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
    setSelectedCategory('all');
    setSelectedStatus('all');
    setStatus('success');
    showToast('Loaded from saved history');
  };

  const handleReset = () => {
    setStatus('idle');
    setVideoData(null);
    setClips([]);
    setAnalysisMeta({ isLivestreamArc: false, notice: null });
    setError(null);
    setSelectedCategory('all');
    setSelectedStatus('all');
  };

  const handleScrollToClip = (clipId) => {
    const el = document.getElementById(clipId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-500');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-amber-500');
      }, 2000);
    }
  };

  // Filter & sort clips based on selected options
  const filteredAndSortedClips = useMemo(() => {
    if (!clips) return [];
    let list = [...clips];

    // Filter by category
    if (selectedCategory !== 'all') {
      list = list.filter(c => {
        const cat = (c.category || '').toLowerCase();
        return cat.includes(selectedCategory.toLowerCase());
      });
    }

    // Filter by workflow status
    if (selectedStatus !== 'all') {
      list = list.filter(c => {
        const s = clipStatuses[c.id] || 'todo';
        return s === selectedStatus;
      });
    }

    // Sort
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
  }, [clips, sortOption, selectedCategory, selectedStatus, clipStatuses]);

  // Export Cut List / Timestamps for Premiere / CapCut / DaVinci
  const handleCopyTimestampsList = () => {
    if (!clips.length) return;
    const lines = clips.map((c, i) => 
      `${i + 1}. [${c.startTime} - ${c.endTime}] (${c.durationSeconds}s) | Score: ${c.viralityScore} | ${c.title}\n   Hook: "${c.hookText || c.title}"`
    );
    const text = `CLIP TIMESTAMPS CUT LIST (${videoData?.title || 'YouTube Video'})\n\n${lines.join('\n\n')}`;
    navigator.clipboard.writeText(text);
    showToast('Copied editor timestamps cut list to clipboard!');
  };

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

            {/* Timeline Bar Distribution */}
            <TimelineBar
              clips={clips}
              durationSeconds={videoData.durationSeconds || 7200}
              onSelectClip={handleScrollToClip}
            />

            {/* Results Filter & Sort Controls */}
            <section className="w-full max-w-4xl mx-auto px-4 mt-6">
              
              {/* Category Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-3 text-xs">
                <span className="text-zinc-500 font-medium shrink-0 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Category:
                </span>
                {[
                  { id: 'all', label: `All (${clips.length})` },
                  { id: 'controversy', label: '🔥 Controversy' },
                  { id: 'comedy', label: '😂 Comedy' },
                  { id: 'mindset', label: '💡 Mindset & Advice' },
                  { id: 'twist', label: '😱 Plot Twist' },
                  { id: 'climax', label: '🏆 Peak Climax' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition ${
                      selectedCategory === cat.id
                        ? 'bg-amber-500 text-studio-950 font-semibold shadow-sm'
                        : 'bg-studio-900 hover:bg-studio-850 text-zinc-400 hover:text-zinc-200 border border-studio-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Status and Action Controls Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-studio-800">
                
                {/* Workflow Status Filter */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-zinc-500 font-medium">Status:</span>
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'todo', label: '⏳ To Edit' },
                    { id: 'ready', label: '🎬 Ready' },
                    { id: 'posted', label: '✅ Posted' }
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStatus(st.id)}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        selectedStatus === st.id
                          ? 'bg-studio-800 text-white font-semibold border border-studio-700'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-studio-800 text-zinc-400 font-mono ml-2">
                    {filteredAndSortedClips.length} showing
                  </span>
                </div>

                {/* Filter and Export Buttons */}
                <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                  {/* Sort dropdown */}
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

                  {/* Copy Timestamps Cut List */}
                  <button
                    type="button"
                    onClick={handleCopyTimestampsList}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-studio-900 hover:bg-studio-850 border border-studio-800 text-xs font-medium text-zinc-300 hover:text-white transition"
                    title="Copy all clip cut timestamps to paste into video editor"
                  >
                    <Scissors className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cut List</span>
                  </button>

                  {/* Export JSON */}
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
                {filteredAndSortedClips.length > 0 ? (
                  filteredAndSortedClips.map((clip, index) => (
                    <ClipCard
                      key={clip.id || index}
                      clip={clip}
                      rank={index + 1}
                      videoId={videoData.videoId}
                      onNotify={showToast}
                      status={clipStatuses[clip.id] || 'todo'}
                      onStatusChange={handleStatusChange}
                    />
                  ))
                ) : (
                  <div className="text-center py-12 bg-studio-900/50 rounded-2xl border border-studio-800 p-6">
                    <p className="text-zinc-400 font-medium">No clips match the selected category or status filter.</p>
                    <button
                      type="button"
                      onClick={() => { setSelectedCategory('all'); setSelectedStatus('all'); }}
                      className="mt-3 px-3 py-1.5 rounded-xl bg-studio-800 text-xs text-amber-300 hover:bg-studio-750 transition"
                    >
                      Reset Filters
                    </button>
                  </div>
                )}
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
          <span>High-Yield Shorts Clipper</span>
          <span>•</span>
          <span>Up to 15 viral clips per stream</span>
        </p>
      </footer>

    </div>
  );
}
