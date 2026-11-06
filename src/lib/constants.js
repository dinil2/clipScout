/**
 * Studio UI Constants & Defaults
 */

export const DEFAULT_OPTIONS = {
  clipCount: 10,
  durationPreset: 'standard', // 'short' (20-40s) | 'standard' (30-60s) | 'long' (60-120s)
  format: 'vertical',         // 'vertical' (9:16) | 'original'
  burnedCaptions: true
};

export const CLIP_COUNT_OPTIONS = [
  { label: '5 clips', value: 5 },
  { label: '10 clips', value: 10 },
  { label: '15 clips', value: 15 },
  { label: '20 clips', value: 20 }
];

export const DURATION_PRESETS = [
  { label: 'Short (20–40s)', value: 'short' },
  { label: 'Standard (30–60s)', value: 'standard' },
  { label: 'Long (60–120s)', value: 'long' }
];

export const FORMAT_OPTIONS = [
  { label: 'Vertical 9:16', value: 'vertical' },
  { label: 'Original', value: 'original' }
];

export const STORAGE_KEYS = {
  SETTINGS: 'clipscout_settings_v3',
  ENGINE_URL: 'clipscout_engine_url_v3',
  ENGINE_TOKEN: 'clipscout_engine_token_v3',
  LAST_JOB_ID: 'clipscout_last_job_id_v3'
};

