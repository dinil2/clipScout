import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header.jsx';
import HeroInput from './components/HeroInput.jsx';
import ProcessingState from './components/ProcessingState.jsx';
import VideoBanner from './components/VideoBanner.jsx';
import ClipCard from './components/ClipCard.jsx';
import DownloadModal from './components/DownloadModal.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import Toast from './components/Toast.jsx';
import { 
  Sparkles, Flame, Clock, Scissors, SlidersHorizontal, 
  RotateCcw, AlertCircle, Share2, Download, Copy, Check 
} from 'lucide-react';

import { loadUserPasscode } from './utils/storage.js';

export default function App() {
  // Main State
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [progress, setProgress] = useState({ message: '', percent: 0 });
  const [error, setError] = useState(null);

  // Video & Clips Data
  const [videoData, setVideoData] = useState(null);
  const [clips, setClips] = useState([]);
  const [sortOption, setSortOption] = useState('virality'); // 'virality' | 'chronological' | 'duration'

  // User Preferences
  const [options, setOptions] = useState({
    duration: '30-60', // '15-30' | '30-60' | '60-90'
    clipCount: 10,     // 5 | 10 | 15 | 20
    focus: 'viral_hooks' // 'viral_hooks' | 'mindset' | 'funny' | 'debate'
  });

  // Modals & Feedback
  const [toastMessage, setToastMessage] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [downloadModal, setDownloadModal] = useState({ isOpen: false, clip: null, videoId: null });
  const [copiedAllBatch, setCopiedAllBatch] = useState(false);

  // Restore cached clips from localStorage on load
  useEffect(() => {
    try {
      const cached = localStorage.getItem('clipscout_current_session_v3');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.videoData && parsed.clips?.length > 0) {
          setVideoData(parsed.videoData);
          setClips(parsed.clips);
          setStatus('success');
        }
      }
    } catch {}
  }, []);

  // Save session when clips update
  useEffect(() => {
    if (status === 'success' && videoData && clips.length > 0) {
      try {
        localStorage.setItem('clipscout_current_session_v3', JSON.stringify({
          videoData,
          clips
        }));
      } catch {}
    }
  }, [status, videoData, clips]);

  const showToast = (msg) => {
    setToastMessage(msg);
  };

  // -------------------------------------------------------------
  // Pipeline: Fetch Source -> Score Candidate Windows -> Package Shorts
  // -------------------------------------------------------------
  const handleAnalyze = async (sourcePayload) => {
    setStatus('loading');
    setError(null);
    setProgress({ message: 'Connecting to video source...', percent: 10 });

    const userPasscode = loadUserPasscode();
    const commonHeaders = {
      'Content-Type': 'application/json',
      ...(userPasscode ? { 'x-app-passcode': userPasscode } : {})
    };

    try {
      let activePayload = { ...sourcePayload };

      // Case: Google Drive Link -> Transcribe with Groq Whisper first
      if (sourcePayload.isGoogleDrive && sourcePayload.googleDriveUrl) {
        setProgress({ message: 'Connecting to Google Drive & transcribing speech with Whisper...', percent: 20 });
        const transcribeRes = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: sourcePayload.googleDriveUrl, title: sourcePayload.title })
        });
        const transcribeData = await transcribeRes.json();
        if (!transcribeRes.ok || !transcribeData.success) {
          throw new Error(transcribeData.error || 'Failed to transcribe Google Drive audio. Ensure link is public.');
        }

        activePayload = {
          videoId: transcribeData.video.videoId,
          video: transcribeData.video,
          transcriptSegments: transcribeData.transcriptSegments
        };
      }

      // -------------------------------------------------------------
      // STAGE 1: Fetch Video Metadata & Real Speech Segments
      // -------------------------------------------------------------
      setProgress({ message: 'Fetching video metadata and speech transcript...', percent: 25 });

      let minClipSec = 30;
      let maxClipSec = 58;
      if (options.duration === '15-30') {
        minClipSec = 15;
        maxClipSec = 30;
      } else if (options.duration === '60-90') {
        minClipSec = 58;
        maxClipSec = 90;
      }

      const stage1Res = await fetch('/api/analyze', {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify({
          action: 'fetch_source',
          ...activePayload,
          campaign: {
            minClipSec,
            maxClipSec,
            focus: options.focus
          }
        })
      });

      const stage1Data = await stage1Res.json();
      if (!stage1Res.ok || !stage1Data.success) {
        throw new Error(stage1Data.error || 'Failed to fetch source video. Please check the URL.');
      }

      const { video, transcriptSegments, candidateWindows } = stage1Data;
      setVideoData(video);

      if (!candidateWindows || candidateWindows.length === 0) {
        throw new Error('No spoken dialogue or candidate clips found in source transcript.');
      }

      // -------------------------------------------------------------
      // STAGE 2: Score Candidate Windows with LLM
      // -------------------------------------------------------------
      // Support requested clip count (5, 10, 15, 20) by scaling candidate batch size
      const requestedClips = options.clipCount || 10;
      const candidateBatchSize = Math.min(candidateWindows.length, Math.max(12, Math.round(requestedClips * 1.5)));
      const topBatch = candidateWindows.slice(0, candidateBatchSize);

      // Split into batches of 8 candidate windows
      const chunks = [];
      for (let i = 0; i < topBatch.length; i += 8) {
        chunks.push(topBatch.slice(i, i + 8));
      }

      let scoredWindows = [];
      for (let idx = 0; idx < chunks.length; idx++) {
        const chunk = chunks[idx];
        setProgress({ 
          message: `AI analyzing conversation for viral hooks (${idx * 8 + 1}–${Math.min((idx + 1) * 8, topBatch.length)} of ${topBatch.length})...`, 
          percent: 35 + Math.round(((idx + 1) / chunks.length) * 30) 
        });

        const stage2Res = await fetch('/api/analyze', {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify({
            action: 'score_batch',
            batch: chunk,
            campaign: {
              minClipSec,
              maxClipSec,
              focus: options.focus
            }
          })
        });

        const stage2Data = await stage2Res.json();
        if (stage2Data.scoredWindows) {
          scoredWindows.push(...stage2Data.scoredWindows);
        }
      }

      if (scoredWindows.length === 0) {
        throw new Error('No candidate moments passed anti-hallucination verification.');
      }

      // Sort candidate windows descending by virality score
      scoredWindows.sort((a, b) => (b.viralityScore || 0) - (a.viralityScore || 0));

      // Limit to user's desired clipCount (5, 10, 15, 20)
      const topSelected = scoredWindows.slice(0, Math.min(requestedClips, scoredWindows.length));

      // -------------------------------------------------------------
      // STAGE 3: Sentence Snapping & YouTube Shorts Packaging
      // -------------------------------------------------------------
      setProgress({ message: `Locking sentence boundaries and packaging ${topSelected.length} YouTube Shorts...`, percent: 75 });

      const stage3Res = await fetch('/api/analyze', {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify({
          action: 'package_clips',
          video,
          topCandidates: topSelected,
          transcriptSegments,
          campaign: {
            minClipSec,
            maxClipSec,
            focus: options.focus
          }
        })
      });

      const stage3Data = await stage3Res.json();
      if (!stage3Res.ok || !stage3Data.success) {
        throw new Error(stage3Data.error || 'Failed to package YouTube Shorts clips.');
      }

      const generatedClips = stage3Data.clips || [];
      if (generatedClips.length === 0) {
        throw new Error('No clips could be successfully formed.');
      }

      setProgress({ message: 'Clips ready!', percent: 100 });
      setClips(generatedClips);
      setStatus('success');
      showToast(`✨ Generated ${generatedClips.length} ready-to-upload YouTube Shorts!`);

    } catch (err) {
      console.error('Pipeline error:', err);
      setError(err.message || 'An unexpected error occurred.');
      setStatus('error');
    }
  };

  // Handle uploading video file from laptop
  const handleUploadFile = async (file) => {
    setStatus('loading');
    setError(null);
    setProgress({ message: `Uploading ${file.name} and extracting audio...`, percent: 15 });

    try {
      const localBlobUrl = URL.createObjectURL(file);

      // Transcribe via /api/transcribe
      setProgress({ message: `AI transcribing speech with Groq Whisper...`, percent: 35 });

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'x-filename': encodeURIComponent(file.name)
        },
        body: file
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to transcribe local video file.');
      }

      const uploadedVideoMeta = {
        ...data.video,
        localBlobUrl
      };

      // Feed into main analysis pipeline
      await handleAnalyze({
        videoId: uploadedVideoMeta.videoId,
        video: uploadedVideoMeta,
        transcriptSegments: data.transcriptSegments
      });

    } catch (err) {
      console.error('Laptop upload error:', err);
      setError(err.message || 'Failed to process laptop video file.');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setVideoData(null);
    setClips([]);
    setError(null);
    try {
      localStorage.removeItem('clipscout_current_session_v3');
    } catch {}
  };

  const handleDownloadErrorFallback = (data, clip) => {
    setDownloadModal({
      isOpen: true,
      clip,
      videoId: videoData?.videoId
    });
  };

  // Copy entire batch of all clips
  const handleCopyAllBatch = () => {
    if (clips.length === 0) return;
    const batchText = clips.map((c, i) => {
      const tags = (c.trendingHashtags || c.hashtags || []).join(' ');
      return `=== CLIP #${i + 1}: ${c.title} (${c.startTime} - ${c.endTime}) ===\n\nTitle: ${c.title}\n\nDescription:\n${c.description}\n\nHashtags:\n${tags}\n\n`;
    }).join('\n----------------------------------------\n\n');

    navigator.clipboard.writeText(batchText);
    setCopiedAllBatch(true);
    showToast('Copied all clips data to clipboard!');
    setTimeout(() => setCopiedAllBatch(false), 2500);
  };

  // Sorted clips
  const sortedClips = useMemo(() => {
    const list = [...clips];
    if (sortOption === 'virality') {
      return list.sort((a, b) => (b.viralityScore || 0) - (a.viralityScore || 0));
    }
    if (sortOption === 'chronological') {
      return list.sort((a, b) => (a.startSeconds || 0) - (b.startSeconds || 0));
    }
    if (sortOption === 'duration') {
      return list.sort((a, b) => (a.durationSeconds || 0) - (b.durationSeconds || 0));
    }
    return list;
  }, [clips, sortOption]);

  return (
    <div className="min-h-screen bg-[#07080a] text-zinc-100 flex flex-col font-sans selection:bg-violet-500/30 selection:text-white">
      
      {/* Top Header */}
      <Header
        clipsCount={clips.length}
        onReset={handleReset}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full pb-16">
        
        {/* ============================================================== */}
        {/* IDLE STATE: Hero Input Section                                 */}
        {/* ============================================================== */}
        {status === 'idle' && (
          <HeroInput
            onAnalyze={handleAnalyze}
            onUploadFile={handleUploadFile}
            isLoading={false}
            options={options}
            setOptions={setOptions}
          />
        )}

        {/* ============================================================== */}
        {/* LOADING STATE: Real-time Multi-stage Progress Visualizer       */}
        {/* ============================================================== */}
        {status === 'loading' && (
          <ProcessingState
            progress={progress}
            videoData={videoData}
            onCancel={handleReset}
          />
        )}

        {/* ============================================================== */}
        {/* ERROR STATE: Clean error card with retry/paste options         */}
        {/* ============================================================== */}
        {status === 'error' && (
          <div className="w-full max-w-xl mx-auto py-16 px-4 animate-fade-in text-center">
            <div className="rounded-2xl bg-studio-900 border border-studio-700/80 p-8 shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Analysis Could Not Complete</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {error || 'An unexpected issue occurred while extracting clips from the source.'}
              </p>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={handleReset}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition"
                >
                  Try Another Video
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* SUCCESS STATE: Results Feed & YouTube Studio Ready Package     */}
        {/* ============================================================== */}
        {status === 'success' && (
          <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
            
            {/* Video Overview Banner */}
            <VideoBanner
              video={videoData}
              clipsCount={clips.length}
              onReset={handleReset}
            />

            {/* Results Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-studio-800">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
                  <span>Viral YouTube Shorts</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold">
                    {clips.length} Ready
                  </span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Download the MP4 or copy the package directly into YouTube Studio.
                </p>
              </div>

              {/* Sort Controls & Batch Copy */}
              <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto justify-end">
                <div className="flex items-center gap-1 bg-studio-900 border border-studio-800 rounded-xl p-1 text-xs">
                  <span className="text-zinc-500 px-2 font-medium">Sort:</span>
                  {[
                    { id: 'virality', label: '🔥 Virality' },
                    { id: 'chronological', label: '⏱️ Timeline' },
                    { id: 'duration', label: '⏳ Length' }
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSortOption(s.id)}
                      className={`px-2.5 py-1 rounded-lg transition font-medium ${
                        sortOption === s.id
                          ? 'bg-studio-800 text-white font-semibold shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleCopyAllBatch}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-studio-850 hover:bg-studio-800 border border-studio-700/80 text-zinc-200 hover:text-white text-xs font-semibold transition"
                  title="Copy titles, descriptions & tags for all clips"
                >
                  {copiedAllBatch ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Copied All</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Copy All Data</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Clips Grid */}
            <div className="space-y-6">
              {sortedClips.map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  videoData={videoData}
                  onShowToast={showToast}
                  onDownloadError={handleDownloadErrorFallback}
                />
              ))}
            </div>

          </div>
        )}

      </main>

      {/* Fallback Download Modal (when running in cloud serverless) */}
      <DownloadModal
        isOpen={downloadModal.isOpen}
        clip={downloadModal.clip || {}}
        videoId={downloadModal.videoId}
        onClose={() => setDownloadModal({ isOpen: false, clip: null, videoId: null })}
        onNotify={showToast}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onNotify={showToast}
      />

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        onClose={() => setToastMessage(null)}
      />

    </div>
  );
}
