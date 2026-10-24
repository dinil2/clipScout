import React, { useState } from 'react';
import { X, Lock, Key, ShieldCheck, Download, Upload, Check } from 'lucide-react';
import { loadUserPasscode, saveUserPasscode, exportAllDataBackup, importDataBackup } from '../utils/storage.js';

export default function SettingsModal({ isOpen, onClose, onNotify }) {
  const [passcode, setPasscode] = useState(() => loadUserPasscode());
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e?.preventDefault();
    saveUserPasscode(passcode);
    setSaved(true);
    if (onNotify) onNotify('Passcode saved in local browser storage!');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExportBackup = () => {
    const json = exportAllDataBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `clipscout-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(href);
    if (onNotify) onNotify('Exported complete data backup to JSON file!');
  };

  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result;
      if (typeof content === 'string') {
        const res = importDataBackup(content);
        if (res.success) {
          if (onNotify) onNotify(res.message);
          window.location.reload();
        } else {
          alert(res.message);
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-studio-900 border border-studio-700 rounded-2xl p-6 shadow-2xl relative space-y-5">
        
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-studio-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">App Settings & Security</h3>
            <p className="text-xs text-zinc-400">Manage API passcode and data backups</p>
          </div>
        </div>

        {/* Passcode Setting */}
        <form onSubmit={handleSave} className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Application Passcode (Optional)</span>
            </label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Matches APP_PASSCODE env variable"
              className="w-full bg-studio-950 border border-studio-750 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-amber-500"
            />
            <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
              If your backend has <code>APP_PASSCODE</code> set in Netlify, enter it here. Sent as header <code>x-app-passcode</code> on all requests to protect your Groq/Gemini quota.
            </p>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-studio-950 font-bold text-xs transition"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4 text-studio-950 stroke-[3]" />
                <span>Passcode Saved</span>
              </>
            ) : (
              <span>Save Passcode</span>
            )}
          </button>
        </form>

        {/* Backup Export/Import */}
        <div className="pt-3 border-t border-studio-800 space-y-2">
          <span className="text-xs font-semibold text-zinc-300 block">
            Offline JSON Backup
          </span>
          <p className="text-[11px] text-zinc-500">
            Export all your campaigns, custom rules, and clip tracking history to a single local JSON file.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleExportBackup}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-zinc-200 border border-studio-700 text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <label className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-studio-800 hover:bg-studio-750 text-zinc-200 border border-studio-700 text-xs font-semibold transition cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Import JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>

      </div>
    </div>
  );
}
