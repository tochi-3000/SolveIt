'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Camera, CheckCircle2, RefreshCw, Upload, AlertCircle, Smartphone } from 'lucide-react';

function CaptureContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');

  const [connected, setConnected] = useState<boolean>(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notify desktop that phone has connected
  useEffect(() => {
    if (!sessionId) {
      setError('Invalid or missing camera session token.');
      return;
    }

    async function notifyConnected() {
      try {
        await fetch(`/api/session/${sessionId}/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'connected' }),
        });
        setConnected(true);
      } catch (e) {
        console.error('Failed to notify connection:', e);
      }
    }

    notifyConnected();
  }, [sessionId]);

  // Client-side canvas compression (<150KB, max 1600x1600)
  const processAndUploadFile = (file: File) => {
    setUploading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Failed to process image on device');
          setUploading(false);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        setPhotoPreview(compressedBase64);

        // Upload to session
        uploadToDesktop(compressedBase64);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const uploadToDesktop = async (base64Data: string) => {
    try {
      const res = await fetch(`/api/session/${sessionId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: base64Data }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to beam photo to computer');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processAndUploadFile(e.target.files[0]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 max-w-md mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
            SolvAm Phone Lens
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-white">Camera Bridge</h1>
        <p className="text-xs text-slate-400 mt-1">
          {connected ? 'Connected to desktop computer. Ready to snap.' : 'Connecting to desktop...'}
        </p>
      </div>

      {/* Main View Area */}
      <div className="my-8 flex flex-col items-center justify-center">
        {error && (
          <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-2xl flex items-center gap-3 text-rose-300 text-sm mb-6 w-full">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {photoPreview ? (
          <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 shadow-2xl">
            <img src={photoPreview} alt="Captured Math" className="w-full h-full object-cover" />
            {uploading && (
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                <span className="text-sm font-semibold text-white">Beaming to Desktop...</span>
              </div>
            )}
            {success && (
              <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-6 text-center animate-fadeIn">
                <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                <span className="text-lg font-bold text-white">Beamed to Computer!</span>
                <p className="text-xs text-slate-300">
                  Your photo is now loaded on your desktop screen.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/40 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <Camera className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="font-bold text-slate-200">Snap WAEC Problem</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
              Point your phone at textbook questions or your handwritten solution on paper.
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Hidden Native Camera Input */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {!success ? (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-2xl transition flex items-center justify-center gap-3 shadow-xl shadow-emerald-950 disabled:opacity-50 text-base"
          >
            <Camera className="w-6 h-6" />
            <span>{photoPreview ? 'Retake Photo' : 'Open Camera & Snap'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPhotoPreview(null);
              setSuccess(false);
              fileInputRef.current?.click();
            }}
            className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-2xl transition flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            <span>Snap Another Problem</span>
          </button>
        )}

        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
          <span>Session Token: <code className="font-mono text-emerald-400">{sessionId || '...'}</code></span>
        </div>
      </div>
    </div>
  );
}

export default function CapturePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Initializing Phone Lens...
      </div>
    }>
      <CaptureContent />
    </Suspense>
  );
}
