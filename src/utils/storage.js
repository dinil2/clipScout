/**
 * LocalStorage Persistence and Backup Management
 * No accounts, no database — single-user privacy with JSON export/import.
 */

import { DEFAULT_CAMPAIGN, STORAGE_KEYS, CLIP_STATUSES } from './constants.js';
import { calculateEarnings } from './scoring.js';

/**
 * Loads campaigns list from localStorage
 * @returns {Array<Object>}
 */
export function loadCampaigns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CAMPAIGNS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load campaigns:', e);
  }
  return [{ ...DEFAULT_CAMPAIGN }];
}

/**
 * Saves campaigns list to localStorage
 * @param {Array<Object>} campaigns
 */
export function saveCampaigns(campaigns) {
  try {
    localStorage.setItem(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(campaigns));
  } catch (e) {
    console.warn('Failed to save campaigns:', e);
  }
}

/**
 * Loads the active campaign ID
 * @param {Array<Object>} campaigns
 * @returns {string}
 */
export function loadActiveCampaignId(campaigns = []) {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_CAMPAIGN_ID);
    if (saved && campaigns.some(c => c.id === saved)) {
      return saved;
    }
  } catch (e) {
    console.warn('Failed to load active campaign id:', e);
  }
  return campaigns[0]?.id || DEFAULT_CAMPAIGN.id;
}

/**
 * Saves the active campaign ID
 * @param {string} id
 */
export function saveActiveCampaignId(id) {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CAMPAIGN_ID, id);
  } catch (e) {
    console.warn('Failed to save active campaign id:', e);
  }
}

/**
 * Loads tracked clips list
 * @returns {Array<Object>}
 */
export function loadTrackerClips() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLIPS_TRACKER);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Failed to load tracker clips:', e);
  }
  return [];
}

/**
 * Saves tracked clips list
 * @param {Array<Object>} clips
 */
export function saveTrackerClips(clips) {
  try {
    localStorage.setItem(STORAGE_KEYS.CLIPS_TRACKER, JSON.stringify(clips));
  } catch (e) {
    console.warn('Failed to save tracker clips:', e);
  }
}

/**
 * Updates a single clip in tracker storage
 * @param {Object} clip
 * @param {Object} campaign
 */
export function upsertTrackerClip(clip, campaign) {
  const current = loadTrackerClips();
  const cpm = Number(campaign?.cpmRate) || 0;
  const maxCap = Number(campaign?.perClipMax) || 0;
  const views = Number(clip.views) || 0;
  const estimatedEarnings = calculateEarnings(views, cpm, maxCap);

  const updatedClip = {
    ...clip,
    views,
    estimatedEarnings,
    status: clip.status || CLIP_STATUSES.FOUND,
    updatedAt: Date.now()
  };

  const existingIndex = current.findIndex(c => c.id === clip.id);
  let next;
  if (existingIndex >= 0) {
    next = [...current];
    next[existingIndex] = { ...next[existingIndex], ...updatedClip };
  } else {
    next = [updatedClip, ...current];
  }

  saveTrackerClips(next);
  return next;
}

/**
 * Loads user passcode for APP_PASSCODE protection
 * @returns {string}
 */
export function loadUserPasscode() {
  try {
    return localStorage.getItem(STORAGE_KEYS.APP_PASSCODE) || '';
  } catch {
    return '';
  }
}

/**
 * Saves user passcode
 * @param {string} passcode
 */
export function saveUserPasscode(passcode) {
  try {
    localStorage.setItem(STORAGE_KEYS.APP_PASSCODE, passcode.trim());
  } catch (e) {
    console.warn(e);
  }
}

/**
 * Exports complete backup of all campaigns and tracker clips as JSON
 * @returns {string} JSON string
 */
export function exportAllDataBackup() {
  const backup = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    campaigns: loadCampaigns(),
    activeCampaignId: loadActiveCampaignId(loadCampaigns()),
    trackerClips: loadTrackerClips(),
    appPasscode: loadUserPasscode()
  };
  return JSON.stringify(backup, null, 2);
}

/**
 * Imports and restores all campaigns and tracker clips from JSON
 * @param {string} jsonString
 * @returns {{ success: boolean, message: string }}
 */
export function importDataBackup(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') {
      return { success: false, message: 'Invalid backup file: not a JSON object.' };
    }

    if (Array.isArray(data.campaigns) && data.campaigns.length > 0) {
      saveCampaigns(data.campaigns);
      if (data.activeCampaignId) {
        saveActiveCampaignId(data.activeCampaignId);
      }
    }

    if (Array.isArray(data.trackerClips)) {
      saveTrackerClips(data.trackerClips);
    }

    if (typeof data.appPasscode === 'string') {
      saveUserPasscode(data.appPasscode);
    }

    return { success: true, message: 'Backup restored successfully!' };
  } catch (err) {
    return { success: false, message: `Failed to import backup: ${err.message}` };
  }
}
