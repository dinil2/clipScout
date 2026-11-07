/**
 * Studio UI Constants & Defaults
 */

export const DEFAULT_OPTIONS = {
  clipCount: 10,
  durationPreset: 'standard', // 'short' (20-40s) | 'standard' (30-60s) | 'long' (60-120s)
  format: 'title_video',      // 'title_video' (1:1 box + title + yellow captions) | 'vertical' (blurred 9:16) | 'original'
  framing: 'fill',            // 'fill' (1:1 crop) | 'fit' (letterbox)
  focusX: 0.5,
  censor: true,               // Profanity censorship (e.g. p***)
  captionSize: 'medium',      // 'small' (58px) | 'medium' (66px) | 'large' (76px)
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
  { label: 'Campaign 9:16', value: 'title_video' },
  { label: 'Blurred 9:16', value: 'vertical' },
  { label: 'Original', value: 'original' }
];

export const FRAMING_OPTIONS = [
  { label: 'Fill 1:1', value: 'fill' },
  { label: 'Fit', value: 'fit' }
];

export const CAPTION_SIZE_OPTIONS = [
  { label: 'Small (58px)', value: 'small' },
  { label: 'Medium (66px)', value: 'medium' },
  { label: 'Large (76px)', value: 'large' }
];

export const STORAGE_KEYS = {
  SETTINGS: 'clipscout_settings_v4',
  ENGINE_URL: 'clipscout_engine_url_v4',
  ENGINE_TOKEN: 'clipscout_engine_token_v4',
  LAST_JOB_ID: 'clipscout_last_job_id_v4'
};
