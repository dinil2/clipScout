/**
 * Core constants for ClipScout Content Rewards clipping assistant
 */

export const CLIP_STATUSES = {
  FOUND: 'found',
  EDITING: 'editing',
  POSTED: 'posted',
  SUBMITTED: 'submitted',
  REJECTED: 'rejected'
};

export const CLIP_STATUS_LABELS = {
  [CLIP_STATUSES.FOUND]: 'Found',
  [CLIP_STATUSES.EDITING]: 'Editing',
  [CLIP_STATUSES.POSTED]: 'Posted',
  [CLIP_STATUSES.SUBMITTED]: 'Submitted',
  [CLIP_STATUSES.REJECTED]: 'Rejected'
};

export const DEFAULT_CAMPAIGN = {
  id: 'campaign-default',
  name: 'Content Rewards Standard',
  sourceUrls: '',
  allowedPlatforms: ['YouTube Shorts', 'TikTok', 'Instagram Reels'],
  minClipSec: 15,
  maxClipSec: 58,
  requiredHashtags: ['#ContentRewards', '#Shorts'],
  requiredMentions: ['@ContentRewards'],
  bannedWords: ['crypto', 'guaranteed profit', 'get rich quick', 'scam'],
  language: 'English',
  cpmRate: 1.50,
  perClipMax: 50.00,
  rules: 'Select hook-driven, self-contained story beats that deliver clear takeaways or entertainment value. Ground all facts in the source transcript.'
};

export const WINDOW_CONFIG = {
  WINDOW_DURATION_SEC: 90,
  STRIDE_SEC: 30,
  TOP_CANDIDATES_PRE_RANK: 25,
  DEFAULT_OUTPUT_CLIPS: 10,
  MIN_OUTPUT_CLIPS: 5,
  MAX_OUTPUT_CLIPS: 15
};

export const STORAGE_KEYS = {
  CAMPAIGNS: 'clipscout_campaigns_v2',
  ACTIVE_CAMPAIGN_ID: 'clipscout_active_campaign_id_v2',
  CLIPS_TRACKER: 'clipscout_tracker_v2',
  APP_PASSCODE: 'clipscout_user_passcode_v2',
  LAST_SOURCE: 'clipscout_last_source_v2'
};
