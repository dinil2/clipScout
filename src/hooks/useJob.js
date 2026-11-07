import { useState, useEffect, useRef, useCallback } from 'react';
import { defaultEngineClient } from '../api/engineClient.js';
import { saveLastJobId, loadLastJobId } from '../lib/storage.js';

export function useJob() {
  const [jobId, setJobId] = useState(() => loadLastJobId());
  const [status, setStatus] = useState('idle'); // 'idle' | 'uploading' | 'running' | 'completed' | 'failed' | 'cancelled'
  const [stage, setStage] = useState('reading_video');
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const [uploadPercent, setUploadPercent] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(null);
  const [video, setVideo] = useState(null);
  const [clips, setClips] = useState([]);
  const [currentClipProgress, setCurrentClipProgress] = useState(null);

  const eventSourceRef = useRef(null);

  // Subscribe to SSE events for a job
  const subscribeToJobEvents = useCallback((id) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventsUrl = defaultEngineClient.getEventsUrl(id);
    const es = new EventSource(eventsUrl);
    eventSourceRef.current = es;

    es.addEventListener('state', (e) => {
      try {
        const state = JSON.parse(e.data);
        if (state.video) setVideo(state.video);
        if (state.stage) setStage(state.stage);
        if (state.progress) setProgress(state.progress);
        if (state.currentClipProgress) setCurrentClipProgress(state.currentClipProgress);
        if (Array.isArray(state.clips)) setClips(state.clips);
        if (state.status === 'completed') setStatus('completed');
        else if (state.status === 'failed') {
          setStatus('failed');
          setError(state.error);
        } else if (state.status === 'running') {
          setStatus('running');
        }
      } catch {}
    });

    es.addEventListener('video_loaded', (e) => {
      try {
        const videoData = JSON.parse(e.data);
        setVideo(videoData);
      } catch {}
    });

    es.addEventListener('progress', (e) => {
      try {
        const p = JSON.parse(e.data);
        if (p.stage) setStage(p.stage);
        setProgress({ percent: p.percent || 0, message: p.message || '' });
        setStatus('running');
      } catch {}
    });

    es.addEventListener('notice', (e) => {
      try {
        const d = JSON.parse(e.data);
        setNotice(d.message || '');
      } catch {}
    });

    es.addEventListener('moments_found', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (Array.isArray(d.clips)) {
          setClips(d.clips);
        }
      } catch {}
    });

    es.addEventListener('clip_ready', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.clip) {
          setCurrentClipProgress(prev => (prev?.clipId === d.clip.id ? null : prev));
          setClips(prev => {
            const index = prev.findIndex(c => c.id === d.clip.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = { ...d.clip, isRerendering: false, renderError: null };
              return updated;
            }
            return [...prev, d.clip];
          });
        }
      } catch {}
    });

    es.addEventListener('clip_progress', (e) => {
      try {
        const d = JSON.parse(e.data);
        setCurrentClipProgress(d);
      } catch {}
    });

    es.addEventListener('clip_rendering', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.clipId) {
          setClips(prev => prev.map(c => c.id === d.clipId ? { ...c, isRerendering: true, renderError: null } : c));
        }
      } catch {}
    });

    es.addEventListener('clip_failed', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.clipId) {
          setClips(prev => prev.map(c => c.id === d.clipId ? { ...c, rendered: false, isRerendering: false, renderError: d.error } : c));
        }
      } catch {}
    });

    es.addEventListener('done', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (Array.isArray(d.clips)) setClips(d.clips);
        setStatus('completed');
        setProgress({ percent: 100, message: 'All clips ready!' });
        setCurrentClipProgress(null);
        setNotice('');
        es.close();
      } catch {}
    });

    // Server-dispatched job error
    es.addEventListener('job_error', (e) => {
      try {
        const d = JSON.parse(e.data);
        setError(d.error || 'Job processing failed.');
      } catch {
        setError('Job processing failed.');
      }
      setStatus('failed');
      setCurrentClipProgress(null);
      es.close();
    });

    es.addEventListener('cancelled', () => {
      setStatus('cancelled');
      setProgress({ percent: 0, message: 'Job was cancelled' });
      setCurrentClipProgress(null);
      es.close();
    });

    es.onerror = () => {
      // EventSource automatically reconnects on temporary transport interruptions.
      // Do NOT flag the job as failed or close here.
    };
  }, []);

  // Restore last job on mount if present
  useEffect(() => {
    if (jobId) {
      defaultEngineClient.getJob(jobId).then(data => {
        if (data) {
          setVideo(data.video);
          setClips(data.clips || []);
          setStatus(data.status);
          setStage(data.stage);
          setProgress(data.progress || { percent: 0, message: '' });
          if (data.status === 'running' || data.status === 'pending') {
            subscribeToJobEvents(jobId);
          }
        }
      }).catch(() => {
        saveLastJobId(null);
        setJobId(null);
      });
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [jobId, subscribeToJobEvents]);

  // Start URL job
  const startJob = async (url, options) => {
    setError(null);
    setNotice('');
    setVideo(null);
    setClips([]);
    setStatus('running');
    setStage('reading_video');
    setProgress({ percent: 5, message: 'Submitting job to engine...' });

    const isDrive = url.includes('drive.google.com');

    try {
      const { jobId: newJobId } = await defaultEngineClient.createJob({
        source: {
          type: isDrive ? 'drive' : 'youtube',
          url
        },
        options
      });

      setJobId(newJobId);
      saveLastJobId(newJobId);
      subscribeToJobEvents(newJobId);
    } catch (err) {
      setError(err.message || 'Failed to start job.');
      setStatus('failed');
    }
  };

  // Upload video file & start upload job
  const uploadAndStartJob = async (file, options) => {
    setError(null);
    setNotice('');
    setVideo(null);
    setClips([]);
    setStatus('uploading');
    setUploadPercent(0);
    setProgress({ percent: 0, message: `Uploading ${file.name}...` });

    try {
      const uploadResult = await defaultEngineClient.uploadVideoFile(file, (pct) => {
        setUploadPercent(pct);
        setProgress({ percent: Math.round(pct * 0.15), message: `Uploading video to engine (${pct}%)...` });
      });

      setStatus('running');
      setStage('reading_video');
      setProgress({ percent: 15, message: 'Initializing video analysis...' });

      const { jobId: newJobId } = await defaultEngineClient.createJob({
        source: {
          type: 'upload',
          uploadId: uploadResult.uploadId,
          filename: uploadResult.filename
        },
        options
      });

      setJobId(newJobId);
      saveLastJobId(newJobId);
      subscribeToJobEvents(newJobId);
    } catch (err) {
      setError(err.message || 'Upload failed.');
      setStatus('failed');
    }
  };

  // Re-render an individual clip with modified title, framing, or focus
  const rerenderClip = async (clipId, customOptions = {}) => {
    if (!jobId) return;
    setClips(prev => prev.map(c => c.id === clipId ? { ...c, isRerendering: true, renderError: null } : c));
    try {
      const res = await defaultEngineClient.rerenderClip(jobId, clipId, customOptions);
      if (res?.clip) {
        setClips(prev => prev.map(c => c.id === clipId ? { ...res.clip, isRerendering: false } : c));
      }
      return res?.clip;
    } catch (err) {
      setClips(prev => prev.map(c => c.id === clipId ? { ...c, isRerendering: false, renderError: err.message } : c));
      throw err;
    }
  };

  // Select a past job from history
  const selectJob = async (targetJobId) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setJobId(targetJobId);
    saveLastJobId(targetJobId);
    setError(null);
    setNotice('');
    try {
      const data = await defaultEngineClient.getJob(targetJobId);
      if (data) {
        setVideo(data.video);
        setClips(data.clips || []);
        setStatus(data.status);
        setStage(data.stage);
        setProgress(data.progress || { percent: 0, message: '' });
        if (data.status === 'running' || data.status === 'pending') {
          subscribeToJobEvents(targetJobId);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load selected job.');
    }
  };

  // Cancel running job
  const cancel = async () => {
    if (!jobId) return;
    try {
      await defaultEngineClient.cancelJob(jobId);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      setStatus('cancelled');
      setProgress({ percent: 0, message: 'Job cancelled by user' });
    } catch {}
  };

  // Reset to empty home screen
  const reset = () => {
    if (status === 'running') {
      cancel();
    }
    setJobId(null);
    saveLastJobId(null);
    setStatus('idle');
    setStage('reading_video');
    setProgress({ percent: 0, message: '' });
    setError(null);
    setNotice('');
    setVideo(null);
    setClips([]);
    setCurrentClipProgress(null);
  };

  return {
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
  };
}
