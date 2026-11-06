/**
 * Local Storage Persistence Helpers
 */

import { STORAGE_KEYS, DEFAULT_OPTIONS } from './constants.js';

export function getEngineUrl() {
  try {
    return localStorage.getItem(STORAGE_KEYS.ENGINE_URL) || window.location.origin;
  } catch {
    return 'http://127.0.0.1:8787';
  }
}

export function saveEngineUrl(url) {
  try {
    localStorage.setItem(STORAGE_KEYS.ENGINE_URL, url);
  } catch {}
}

export function getEngineToken() {
  try {
    return localStorage.getItem(STORAGE_KEYS.ENGINE_TOKEN) || '';
  } catch {
    return '';
  }
}

export function saveEngineToken(token) {
  try {
    localStorage.setItem(STORAGE_KEYS.ENGINE_TOKEN, token);
  } catch {}
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) return { ...DEFAULT_OPTIONS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_OPTIONS;
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch {}
}

export function loadLastJobId() {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_JOB_ID) || null;
  } catch {
    return null;
  }
}

export function saveLastJobId(jobId) {
  try {
    if (jobId) localStorage.setItem(STORAGE_KEYS.LAST_JOB_ID, jobId);
    else localStorage.removeItem(STORAGE_KEYS.LAST_JOB_ID);
  } catch {}
}

