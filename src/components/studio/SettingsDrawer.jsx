import React, { useState, useEffect } from 'react';
import Drawer from '../ui/Drawer.jsx';
import Switch from '../ui/Switch.jsx';
import Button from '../ui/Button.jsx';
import Segmented from '../ui/Segmented.jsx';
import Input from '../ui/Input.jsx';
import { 
  getEngineUrl, saveEngineUrl, 
  getEngineToken, saveEngineToken, 
  loadSettings, saveSettings 
} from '../../lib/storage.js';
import { 
  CLIP_COUNT_OPTIONS, 
  DURATION_PRESETS, 
  FORMAT_OPTIONS,
  FRAMING_OPTIONS,
  CAPTION_SIZE_OPTIONS
} from '../../lib/constants.js';
import { defaultEngineClient } from '../../api/engineClient.js';
import { Server, CheckCircle2, AlertCircle, Cpu, ShieldCheck } from 'lucide-react';

export default function SettingsDrawer({
  isOpen = false,
  onClose,
  onSettingsSaved
}) {
  const [engineUrl, setEngineUrlState] = useState(getEngineUrl());
  const [engineToken, setEngineTokenState] = useState(getEngineToken());
  const [settings, setSettingsState] = useState(loadSettings());
  const [healthStatus, setHealthStatus] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEngineUrlState(getEngineUrl());
      setEngineTokenState(getEngineToken());
      setSettingsState(loadSettings());
      checkConnection();
    }
  }, [isOpen]);

  const checkConnection = async () => {
    setIsChecking(true);
    const client = defaultEngineClient;
    const res = await client.checkHealth();
    setHealthStatus(res);
    setIsChecking(false);
  };

  const handleSave = () => {
    saveEngineUrl(engineUrl.trim());
    saveEngineToken(engineToken.trim());
    saveSettings(settings);
    onSettingsSaved?.(settings);
    onClose?.();
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Studio Settings">
      
      {/* 1. Format & Framing Defaults */}
      <div className="flex flex-col gap-4 pb-5 border-b border-border">
        <h3 className="text-xs uppercase tracking-wider font-bold text-muted">
          Render Style & Framing
        </h3>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text">Default Layout</label>
          <Segmented
            options={FORMAT_OPTIONS}
            value={settings.format}
            onChange={(val) => setSettingsState(s => ({ ...s, format: val }))}
          />
          <span className="text-[11px] text-muted">
            Campaign 9:16 uses pure black background with 1:1 centered video & top hook title.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text">Video Framing</label>
          <Segmented
            options={FRAMING_OPTIONS}
            value={settings.framing || 'fill'}
            onChange={(val) => setSettingsState(s => ({ ...s, framing: val }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text">Caption Size</label>
          <Segmented
            options={CAPTION_SIZE_OPTIONS}
            value={settings.captionSize || 'medium'}
            onChange={(val) => setSettingsState(s => ({ ...s, captionSize: val }))}
          />
        </div>

        <div className="pt-1">
          <Switch
            id="censor-switch"
            checked={settings.censor !== false}
            onChange={(checked) => setSettingsState(s => ({ ...s, censor: checked }))}
            label="Censor Strong Profanity"
            description="Replaces strong profanities with asterisks (e.g. p***, f***)."
          />
        </div>

        <div className="pt-1">
          <Switch
            id="burn-captions-switch"
            checked={settings.burnedCaptions}
            onChange={(checked) => setSettingsState(s => ({ ...s, burnedCaptions: checked }))}
            label="Burn-in Yellow Subtitles"
            description="Burns bold 1-3 word yellow subtitles directly onto the lower video area."
          />
        </div>
      </div>

      {/* 2. Candidate Discovery Options */}
      <div className="flex flex-col gap-4 pb-5 border-b border-border">
        <h3 className="text-xs uppercase tracking-wider font-bold text-muted">
          Moment Discovery
        </h3>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text">Default Clip Count</label>
          <Segmented
            options={CLIP_COUNT_OPTIONS}
            value={settings.clipCount}
            onChange={(val) => setSettingsState(s => ({ ...s, clipCount: val }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text">Duration Target</label>
          <Segmented
            options={DURATION_PRESETS}
            value={settings.durationPreset}
            onChange={(val) => setSettingsState(s => ({ ...s, durationPreset: val }))}
          />
        </div>
      </div>

      {/* 3. Engine Diagnostics & Server Configuration */}
      <div className="flex flex-col gap-3 pb-5 border-b border-border">
        <h3 className="text-xs uppercase tracking-wider font-bold text-muted flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-accent" />
          <span>System Diagnostics</span>
        </h3>

        <div className="p-3 rounded-control bg-surface-2 border border-border flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted">Engine Status:</span>
            {healthStatus?.ok ? (
              <span className="text-success font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected (Port 8787)
              </span>
            ) : (
              <span className="text-danger font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Disconnected
              </span>
            )}
          </div>

          {healthStatus?.ok && healthStatus.data && (
            <div className="flex flex-col gap-1 pt-2 border-t border-border/60 text-[11px] font-mono text-muted">
              <div className="flex justify-between">
                <span>FFmpeg & libass:</span>
                <span className="text-text">{healthStatus.data.ffmpeg ? '✓ Available' : '✗ Missing'}</span>
              </div>
              <div className="flex justify-between">
                <span>yt-dlp (EJS solver):</span>
                <span className="text-text">{healthStatus.data.ytdlp ? '✓ Ready' : '✗ Missing'}</span>
              </div>
              <div className="flex justify-between">
                <span>AI Speech Engine:</span>
                <span className="text-text">{healthStatus.data.hasGroqKey ? 'Groq Whisper' : 'API Key Missing'}</span>
              </div>
              <div className="flex justify-between">
                <span>AI Moment Router:</span>
                <span className="text-text">{healthStatus.data.hasGeminiKey ? 'Groq + Gemini Fallback' : 'Groq Only'}</span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={checkConnection}
            disabled={isChecking}
            className="mt-1 text-xs text-accent hover:underline text-left cursor-pointer font-medium"
          >
            {isChecking ? 'Checking diagnostics...' : '↻ Re-check System Diagnostics'}
          </button>
        </div>

        <div className="flex flex-col gap-1.5 pt-2">
          <label className="text-xs font-medium text-text">Engine Server URL</label>
          <Input
            value={engineUrl}
            onChange={(e) => setEngineUrlState(e.target.value)}
            placeholder="http://127.0.0.1:8787"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text">Optional Security Token</label>
          <Input
            type="password"
            value={engineToken}
            onChange={(e) => setEngineTokenState(e.target.value)}
            placeholder="Optional ENGINE_TOKEN"
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-auto pt-4 flex gap-2">
        <Button variant="primary" size="lg" onClick={handleSave} className="w-full">
          Save Settings
        </Button>
      </div>

    </Drawer>
  );
}
