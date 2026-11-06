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
import { CLIP_COUNT_OPTIONS, DURATION_PRESETS, FORMAT_OPTIONS } from '../../lib/constants.js';
import { defaultEngineClient } from '../../api/engineClient.js';
import { Server, CheckCircle2, AlertCircle } from 'lucide-react';

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
      
      {/* 1. Captions Burn-In Switch */}
      <div className="flex flex-col gap-2 pb-5 border-b border-border">
        <Switch
          id="burn-captions-switch"
          checked={settings.burnedCaptions}
          onChange={(checked) => setSettingsState(s => ({ ...s, burnedCaptions: checked }))}
          label="Burn-in Captions (9:16)"
          description="Renders bold yellow & white animated captions directly onto the video via FFmpeg libass."
        />
      </div>

      {/* 2. Default Options */}
      <div className="flex flex-col gap-4 pb-5 border-b border-border">
        <h3 className="text-xs uppercase tracking-wider font-bold text-muted">
          Default Clip Options
        </h3>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text">Clip Count</label>
          <Segmented
            options={CLIP_COUNT_OPTIONS}
            value={settings.clipCount}
            onChange={(val) => setSettingsState(s => ({ ...s, clipCount: val }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text">Duration Preset</label>
          <Segmented
            options={DURATION_PRESETS}
            value={settings.durationPreset}
            onChange={(val) => setSettingsState(s => ({ ...s, durationPreset: val }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text">Default Aspect Ratio</label>
          <Segmented
            options={FORMAT_OPTIONS}
            value={settings.format}
            onChange={(val) => setSettingsState(s => ({ ...s, format: val }))}
          />
        </div>
      </div>

      {/* 3. Engine Connection & Localhost Endpoint */}
      <div className="flex flex-col gap-3 pb-5 border-b border-border">
        <h3 className="text-xs uppercase tracking-wider font-bold text-muted">
          Engine Connection
        </h3>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text">Engine Server URL</label>
          <Input
            value={engineUrl}
            onChange={(e) => setEngineUrlState(e.target.value)}
            placeholder="http://127.0.0.1:8787"
          />
          <span className="text-[11px] text-muted">
            Default: Same origin or http://127.0.0.1:8787
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text">Engine Token (Optional)</label>
          <Input
            type="password"
            value={engineToken}
            onChange={(e) => setEngineTokenState(e.target.value)}
            placeholder="Optional ENGINE_TOKEN"
          />
        </div>

        {/* Live Health Status Box */}
        <div className="p-3 rounded-control bg-surface-2 border border-border flex items-center justify-between text-xs mt-1">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-muted" />
            <span>Status:</span>
            {healthStatus?.ok ? (
              <span className="text-success font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ready (FFmpeg + Groq)
              </span>
            ) : (
              <span className="text-danger font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Disconnected
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={checkConnection}
            disabled={isChecking}
            className="text-xs text-accent hover:underline cursor-pointer disabled:opacity-50"
          >
            {isChecking ? 'Checking...' : 'Test'}
          </button>
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

