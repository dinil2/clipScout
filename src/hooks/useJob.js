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
          setClips(prev => {
            const index = prev.findIndex(c => c.id === d.clip.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = d.clip;
              return updated;
            }
            return [...prev, d.clip];
          });
        }
      } catch {}
    });

    es.addEventListener('done', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (Array.isArray(d.clips)) setClips(d.clips);
        setStatus('completed');
        setProgress({ percent: 100, message: 'All clips ready!' });
        setNotice('');
        es.close();
      } catch {}
    });

    es.addEventListener('error', (e) => {
      try {
        const d = JSON.parse(e.data);
        setError(d.error || 'Job failed');
      } catch {
        setError('Connection to engine event stream interrupted');
      }
      setStatus('failed');
      es.close();
    });

    es.addEventListener('cancelled', () => {
      setStatus('cancelled');
      setProgress({ percent: 0, message: 'Job was cancelled' });
      es.close();
    });

    es.onerror = () => {
      // EventSource may reconnect automatically unless closed
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
    startJob,
    uploadAndStartJob,
    cancel,
    reset
  };
}

