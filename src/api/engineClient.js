/**
 * ClipScout Engine API Client
 * Manages REST requests, streamed uploads with progress, and SSE connections.
 */

import { getEngineUrl, getEngineToken } from '../lib/storage.js';

export class EngineClient {
  constructor(baseUrl, token) {
    this.baseUrl = (baseUrl || getEngineUrl()).replace(/\/+$/, '');
    this.token = token !== undefined ? token : getEngineToken();
  }

  getHeaders(custom = {}) {
    const headers = { ...custom };
    if (this.token) {
      headers['x-engine-token'] = this.token;
    }
    return headers;
  }

  async checkHealth() {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(10000)
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok && data.ok, data, status: res.status };
    } catch (err) {
      return { ok: false, error: err.message, status: 0 };
    }
  }

  uploadVideoFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.baseUrl}/uploads`, true);

      if (this.token) {
        xhr.setRequestHeader('x-engine-token', this.token);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent, event.loaded, event.total);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch (e) {
            reject(new Error('Invalid response from upload server.'));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData.error || `Upload failed with status ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error occurred during file upload.'));
      xhr.ontimeout = () => reject(new Error('Upload timed out.'));

      const formData = new FormData();
      formData.append('file', file, file.name);
      xhr.send(formData);
    });
  }

  async createJob(payload) {
    const res = await fetch(`${this.baseUrl}/jobs`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create job.');
    }
    return data;
  }

  async getJob(jobId) {
    const res = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
      headers: this.getHeaders()
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch job.');
    }
    return data;
  }

  async cancelJob(jobId) {
    const res = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return res.ok;
  }

  getEventsUrl(jobId) {
    const url = new URL(`${this.baseUrl}/jobs/${jobId}/events`);
    if (this.token) {
      url.searchParams.set('token', this.token);
    }
    return url.toString();
  }

  getClipMp4Url(jobId, clipId, download = false) {
    const url = new URL(`${this.baseUrl}/clips/${jobId}/${clipId}.mp4`);
    if (download) url.searchParams.set('download', 'true');
    if (this.token) url.searchParams.set('token', this.token);
    return url.toString();
  }

  getClipSrtUrl(jobId, clipId) {
    const url = new URL(`${this.baseUrl}/clips/${jobId}/${clipId}.srt`);
    if (this.token) url.searchParams.set('token', this.token);
    return url.toString();
  }

  getZipDownloadUrl(jobId) {
    const url = new URL(`${this.baseUrl}/jobs/${jobId}/download.zip`);
    if (this.token) url.searchParams.set('token', this.token);
    return url.toString();
  }

  async fetchTrendingTags(jobId, topic) {
    const url = new URL(`${this.baseUrl}/jobs/${jobId}/trending-tags`);
    if (topic) url.searchParams.set('topic', topic);
    const res = await fetch(url.toString(), { headers: this.getHeaders() });
    return res.json();
  }

  async rerenderClip(jobId, clipId, options) {
    const res = await fetch(`${this.baseUrl}/jobs/${jobId}/clips/${clipId}/rerender`, {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(options)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to re-render clip.');
    }
    return data;
  }

  async listRecentJobs() {
    try {
      const res = await fetch(`${this.baseUrl}/jobs`, {
        headers: this.getHeaders()
      });
      const data = await res.json();
      return data?.jobs || [];
    } catch {
      return [];
    }
  }
}

export const defaultEngineClient = new EngineClient();

