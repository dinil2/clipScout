import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header.jsx';
import CampaignBrief from './components/CampaignBrief.jsx';
import SourceStep from './components/SourceStep.jsx';
import VideoBanner from './components/VideoBanner.jsx';
import TimelineBar from './components/TimelineBar.jsx';
import ClipCard from './components/ClipCard.jsx';
import TrackerTab from './components/TrackerTab.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { LoadingState, ErrorState, EmptyClipsState } from './components/StatusStates.jsx';
import Toast from './components/Toast.jsx';
import { 
  SlidersHorizontal, Download, Scissors, AlertCircle, 
  RotateCcw, Sparkles, Filter 
} from 'lucide-react';

import { DEFAULT_CAMPAIGN, CLIP_STATUSES } from './utils/constants.js';
import { 
  loadCampaigns, 
  saveCampaigns, 
  loadActiveCampaignId, 
  saveActiveCampaignId, 
  loadTrackerClips, 
  saveTrackerClips, 
  upsertTrackerClip,
  loadUserPasscode 
} from './utils/storage.js';

export default function App() {
  // Navigation & Tabs: 'campaign' | 'source' | 'clips' | 'tracker'
  const [activeTab, setActiveTab] = useState('campaign');

  // Campaigns State
  const [campaigns, setCampaigns] = useState(() => loadCampaigns());
  const [activeCampaignId, setActiveCampaignId] = useState(() => loadActiveCampaignId(campaigns));

  // Current Active Campaign
  const activeCampaign = useMemo(() => {
    return campaigns.find(c => c.id === activeCampaignId) || campaigns[0] || DEFAULT_CAMPAIGN;
  }, [campaigns, activeCampaignId]);

  // Analysis State
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [progress, setProgress] = useState({ message: '', percent: 0 });
  const [error, setError] = useState(null);
  const [captionError, setCaptionError] = useState(null);
  const [lastSourcePayload, setLastSourcePayload] = useState(null);

  // Results & Video Metadata
  const [videoData, setVideoData] = useState(null);
  const [clips, setClips] = useState([]);
  const [clipCount, setClipCount] = useState(10);
  const [sortOption, setSortOption] = useState('virality'); // 'virality' | 'chronological' | 'shortest' | 'longest'

  // Tracker State
  const [trackerClips, setTrackerClips] = useState(() => loadTrackerClips());

  // UI Modals & Alerts
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Sync campaigns changes
  const handleSaveCampaign = (updatedCampaign) => {
    const updated = campaigns.map(c => c.id === updatedCampaign.id ? updatedCampaign : c);
    setCampaigns(updated);
    saveCampaigns(updated);
    showToast(`Saved campaign "${updatedCampaign.name}"`);
  };

  const handleCreateCampaign = () => {
    const newId = `campaign-${Date.now()}`;
    const newCamp = {
      ...DEFAULT_CAMPAIGN,
      id: newId,
      name: `Campaign #${campaigns.length + 1}`
    };
    const next = [...campaigns, newCamp];
    setCampaigns(next);
    saveCampaigns(next);
    setActiveCampaignId(newId);
    saveActiveCampaignId(newId);
    showToast('Created new campaign');
  };

  const handleDeleteCampaign = (idToDelete) => {
    if (campaigns.length <= 1) return;
    const next = campaigns.filter(c => c.id !== idToDelete);
    setCampaigns(next);
    saveCampaigns(next);
    const nextActive = next[0].id;
    setActiveCampaignId(nextActive);
    saveActiveCampaignId(nextActive);
    showToast('Campaign deleted');
  };

  const handleSelectCampaign = (id) => {
    setActiveCampaignId(id);
    saveActiveCampaignId(id);
  };

  const showToast = (msg) => {
    setToastMessage(msg);
  };

  // -------------------------------------------------------------
  // Multi-Stage Orchestrated Analysis Pipeline
  // -------------------------------------------------------------
  const executePipeline = async (sourcePayload) => {
    setStatus('loading');
    setError(null);
    setCaptionError(null);
    setLastSourcePayload(sourcePayload);
    setActiveTab('clips');

    const userPasscode = loadUserPasscode();
    const commonHeaders = {
      'Content-Type': 'application/json',
      ...(userPasscode ? { 'x-app-passcode': userPasscode } : {})
    };

    try {
      // ---------------------------------------------------------
      // STAGE 1: Fetch source metadata & sliding candidate windows
      // ---------------------------------------------------------
      setProgress({
        message: 'Step 1/3: Parsing transcript & pre-ranking candidate moments in code...',
        percent: 25
      });

      const stage1Body = {
        action: 'fetch_source',
        campaign: activeCampaign,
        ...(sourcePayload.type === 'youtube'
          ? { videoId: sourcePayload.videoId }
          : {
              transcriptText: sourcePayload.transcriptText,
              title: sourcePayload.title,
              author: sourcePayload.author,
              fileType: sourcePayload.fileType
            })
      };

      const res1 = await fetch('/api/analyze', {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify(stage1Body)
      });

      const data1 = await res1.json();

      if (!res1.ok || data1.error) {
        if (data1.code === 'NO_CAPTIONS') {
          setCaptionError(data1.error);
          setActiveTab('source');
          setStatus('idle');
          return;
        }
        throw new Error(data1.error || 'Failed to fetch source transcript.');
      }

      setVideoData(data1.video);
      const { transcriptSegments, candidateWindows } = data1;

      if (!candidateWindows || candidateWindows.length === 0) {
        throw new Error('No candidate speech moments could be extracted from this transcript.');
      }

      // ---------------------------------------------------------
      // STAGE 2: Batch score candidate windows with AI
      // ---------------------------------------------------------
      setProgress({
        message: 'Step 2/3: AI evaluating candidate moments across 4 virality sub-scores...',
        percent: 55
      });

      // Select top candidate windows to evaluate (up to clipCount * 1.5, capped at 15)
      const targetEvalCount = Math.min(candidateWindows.length, Math.max(8, clipCount + 4));
      const windowsToScore = candidateWindows.slice(0, targetEvalCount);

      // Score in small batches of 5 to stay strictly under token & timeout limits
      const scoredWindows = [];
      const batchSize = 5;

      for (let i = 0; i < windowsToScore.length; i += batchSize) {
        const batch = windowsToScore.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(windowsToScore.length / batchSize);

        setProgress({
          message: `Step 2/3: AI evaluating candidate batch ${batchNum} of ${totalBatches}...`,
          percent: 55 + Math.round((i / windowsToScore.length) * 25)
        });

        const resBatch = await fetch('/api/analyze', {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify({
            action: 'score_batch',
            batch,
            campaign: activeCampaign
          })
        });

        const dataBatch = await resBatch.json();
        if (resBatch.ok && Array.isArray(dataBatch.scoredWindows)) {
          scoredWindows.push(...dataBatch.scoredWindows);
        }
      }

      if (scoredWindows.length === 0) {
        throw new Error('AI evaluation returned no valid scored candidate clips.');
      }

      // Sort scored windows descending by composite score
      scoredWindows.sort((a, b) => b.viralityScore - a.viralityScore);
      const topSelected = scoredWindows.slice(0, clipCount);

      // ---------------------------------------------------------
      // STAGE 3: Sentence boundary snapping & campaign package
      // ---------------------------------------------------------
      setProgress({
        message: 'Step 3/3: Snapping sentence boundaries and verifying campaign compliance...',
        percent: 90
      });

      const resPackage = await fetch('/api/analyze', {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify({
          action: 'package_clips',
          topCandidates: topSelected,
          transcriptSegments,
          campaign: activeCampaign,
          video: data1.video
        })
      });

      const dataPackage = await resPackage.json();
      if (!resPackage.ok || !Array.isArray(dataPackage.clips) || dataPackage.clips.length === 0) {
        throw new Error(dataPackage.error || 'Failed generating campaign clip package.');
      }

      const generatedClips = dataPackage.clips;
      setClips(generatedClips);
      setStatus('success');
      showToast(`Scouted ${generatedClips.length} authentic clips grounded in transcript!`);

      // Automatically register found clips into the tracker
      setTrackerClips(prev => {
        let updated = [...prev];
        for (const cl of generatedClips) {
          const exists = updated.some(t => t.id === cl.id && t.campaignId === activeCampaign.id);
          if (!exists) {
            updated = [cl, ...updated];
          }
        }
        saveTrackerClips(updated);
        return updated;
      });

    } catch (err) {
      console.error('Pipeline error:', err);
      setError(err.message || 'Something went wrong during analysis.');
      setStatus('error');
    }
  };

  // Update a clip from ClipCard or Tracker
  const handleUpdateClip = (updatedClip) => {
    // Update local state
    setClips(prev => prev.map(c => c.id === updatedClip.id ? updatedClip : c));
    // Persist to tracker storage
    const updatedTracker = upsertTrackerClip(updatedClip, activeCampaign);
    setTrackerClips(updatedTracker);
    showToast(`Updated "${updatedClip.title.slice(0, 30)}..."`);
  };

  // Delete clip from tracker
  const handleDeleteTrackerClip = (clipId) => {
    const updated = trackerClips.filter(c => c.id !== clipId);
    setTrackerClips(updated);
    saveTrackerClips(updated);
    showToast('Removed clip from tracker');
  };

  const handleReset = () => {
    setStatus('idle');
    setVideoData(null);
    setClips([]);
    setError(null);
    setCaptionError(null);
    setActiveTab('source');
  };

  const handleScrollToClip = (clipId) => {
    const el = document.getElementById(clipId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-amber-500');
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-500'), 2000);
    }
  };

  // Sort candidate clips
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

  // Export Cut List / Timestamps to Clipboard
  const handleCopyCutList = () => {
    if (!clips.length) return;
    const lines = clips.map((c, i) =>
      `${i + 1}. [${c.startTime} - ${c.endTime}] (${c.durationSeconds}s) | Score: ${c.viralityScore}/100\n   Title: ${c.title}\n   Hook: "${c.hookText || c.title}"`
    );
    const text = `CLIP CUT LIST (${videoData?.title || 'Video'})\nCampaign: ${activeCampaign.name}\n\n${lines.join('\n\n')}`;
    navigator.clipboard.writeText(text);
    showToast('Copied editor cut list to clipboard!');
  };

  return (
    <div className="min-h-screen bg-studio-950 text-zinc-100 flex flex-col font-sans">
      
      {/* Toast Alert */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />

      {/* Settings & Backups Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onNotify={showToast}
      />

      {/* Main Header & 3-Step Navigation */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        clipsCount={clips.length}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="flex-1 pb-16">
        
        {/* STEP 1: CAMPAIGN BRIEF */}
        {activeTab === 'campaign' && (
          <CampaignBrief
            campaigns={campaigns}
            activeCampaign={activeCampaign}
            onSelectCampaign={handleSelectCampaign}
            onSaveCampaign={handleSaveCampaign}
            onCreateCampaign={handleCreateCampaign}
            onDeleteCampaign={handleDeleteCampaign}
            onProceedToSource={() => setActiveTab('source')}
          />
        )}

        {/* STEP 2: SOURCE INPUT */}
        {activeTab === 'source' && (
          <SourceStep
            onSubmitSource={executePipeline}
            isLoading={status === 'loading'}
            campaign={activeCampaign}
            captionError={captionError}
            onClearCaptionError={() => setCaptionError(null)}
            clipCount={clipCount}
            onChangeClipCount={setClipCount}
          />
        )}

        {/* STEP 3: CLIPS RESULTS */}
        {activeTab === 'clips' && (
          <div>
            {status === 'loading' && (
              <LoadingState
                progressMessage={progress.message}
                progressPercent={progress.percent}
              />
            )}

            {status === 'error' && (
              <ErrorState
                error={error}
                onRetry={lastSourcePayload ? () => executePipeline(lastSourcePayload) : null}
                onSwitchToPaste={() => {
                  setActiveTab('source');
                  setStatus('idle');
                }}
              />
            )}

            {status === 'idle' && clips.length === 0 && (
              <EmptyClipsState
                campaignName={activeCampaign.name}
                onGoToSource={() => setActiveTab('source')}
              />
            )}

            {(status === 'success' || (status === 'idle' && clips.length > 0)) && videoData && (
              <div className="space-y-6">
                
                {/* Source Banner */}
                <VideoBanner
                  video={videoData}
                  clipsCount={clips.length}
                  onReset={handleReset}
                />

                {/* Timeline Visual Distribution */}
                <TimelineBar
                  clips={clips}
                  durationSeconds={videoData.durationSeconds || 7200}
                  onSelectClip={handleScrollToClip}
                />

                {/* Controls Bar: Sort, Cut List, Switch Campaign */}
                <section className="w-full max-w-4xl mx-auto px-4">
                  <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-studio-900 border border-studio-800 flex-wrap text-xs">
                    
                    {/* Active Campaign Tag */}
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 font-medium">Campaign:</span>
                      <span className="font-bold text-amber-400">{activeCampaign.name}</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-400">{sortedClips.length} clips scouted</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Sort Dropdown */}
                      <div className="flex items-center gap-1.5 bg-studio-950 border border-studio-750 px-2.5 py-1 rounded-xl text-zinc-300">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
                        <select
                          value={sortOption}
                          onChange={(e) => setSortOption(e.target.value)}
                          className="bg-transparent text-zinc-200 font-medium focus:outline-none cursor-pointer"
                        >
                          <option value="virality" className="bg-studio-900">Highest AI Score</option>
                          <option value="chronological" className="bg-studio-900">Chronological</option>
                          <option value="shortest" className="bg-studio-900">Shortest (15-30s)</option>
                          <option value="longest" className="bg-studio-900">Longest (35-58s)</option>
                        </select>
                      </div>

                      {/* Copy Cut List */}
                      <button
                        type="button"
                        onClick={handleCopyCutList}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-studio-950 hover:bg-studio-800 border border-studio-750 text-zinc-200 font-medium transition"
                        title="Copy editor cut list with timestamps"
                      >
                        <Scissors className="w-3.5 h-3.5 text-amber-400" />
                        <span>Cut List</span>
                      </button>
                    </div>

                  </div>

                  {/* Vertical List of Ranked Clip Cards */}
                  <div className="mt-4 space-y-4">
                    {sortedClips.map((clip, index) => (
                      <ClipCard
                        key={clip.id || index}
                        clip={clip}
                        rank={index + 1}
                        videoId={videoData.videoId}
                        campaign={activeCampaign}
                        onNotify={showToast}
                        onUpdateClip={handleUpdateClip}
                      />
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CAMPAIGN WORKFLOW & EARNINGS TRACKER */}
        {activeTab === 'tracker' && (
          <TrackerTab
            campaigns={campaigns}
            activeCampaign={activeCampaign}
            onSelectCampaign={handleSelectCampaign}
            trackerClips={trackerClips}
            onUpdateClip={handleUpdateClip}
            onDeleteClip={handleDeleteTrackerClip}
            onNotify={showToast}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-studio-850 py-6 text-center text-xs text-zinc-500">
        <p className="flex items-center justify-center gap-2">
          <span>ClipScout</span>
          <span>•</span>
          <span>Content Rewards Clipping Assistant</span>
          <span>•</span>
          <span>Zero Hallucinations</span>
        </p>
      </footer>

    </div>
  );
}
