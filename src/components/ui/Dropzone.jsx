import React, { useState, useRef } from 'react';
import { UploadCloud, FileVideo, AlertCircle, X } from 'lucide-react';

export default function Dropzone({
  onFileSelected,
  isUploading = false,
  uploadPercent = 0,
  accept = '.mp4,.mov,.webm,.mkv,.m4a',
  className = ''
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const validateAndSetFile = (file) => {
    setError(null);
    if (!file) return;

    const allowed = accept.split(',').map(s => s.trim().toLowerCase());
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();

    if (!allowed.includes(ext)) {
      setError(`Invalid file format. Please upload: ${allowed.join(', ')}`);
      return;
    }

    setSelectedFile(file);
    onFileSelected?.(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const clearSelection = (e) => {
    e?.stopPropagation();
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-card transition-all duration-150 cursor-pointer ${
          isDragOver
            ? 'border-accent bg-accent/5'
            : selectedFile
            ? 'border-border bg-surface-2/60'
            : 'border-border hover:border-muted/50 bg-surface/80 hover:bg-surface-2/30'
        } ${isUploading ? 'pointer-events-none opacity-80' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          disabled={isUploading}
        />

        {selectedFile ? (
          <div className="flex flex-col items-center text-center gap-2 w-full max-w-sm">
            <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <FileVideo className="w-5 h-5" />
            </div>
            <div className="text-sm font-medium text-text truncate max-w-full">
              {selectedFile.name}
            </div>
            <div className="text-xs text-muted">
              {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
            </div>

            {isUploading ? (
              <div className="w-full mt-2">
                <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden border border-border">
                  <div
                    className="bg-accent h-2 transition-all duration-150"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
                <div className="text-xs text-accent mt-1 text-center font-medium">
                  Uploading to Engine: {uploadPercent}%
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={clearSelection}
                className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-danger transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Remove file
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center text-muted">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div className="text-sm font-medium text-text">
              Drop podcast video here, or <span className="text-accent underline underline-offset-2">browse</span>
            </div>
            <div className="text-xs text-muted">
              Supports .mp4, .mov, .webm, .mkv (up to 4 GB)
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-danger mt-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

