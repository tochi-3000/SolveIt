'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Camera, CheckCircle2, RefreshCw, AlertCircle, Smartphone } from 'lucide-react';

function CaptureContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');

  const [connected, setConnected] = useState<boolean>(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const processAndUploadFile = (file: File) => {
    setUploading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1280;
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
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.78);
        setPhotoPreview(compressedBase64);

        uploadToDesktop(compressedBase64);
      };
      img.onerror = () => {
        setError('Could not decode captured photo. Please try snapping again.');
        setUploading(false);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      setError('Failed to read image file from camera.');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const uploadToDesktop = async (base64Data: string, attempt = 1) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`/api/session/${sessionId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: base64Data }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setSuccess(true);
      setUploading(false);
    } catch (err: unknown) {
      if (attempt < 2) {
        // Automatic single retry on transient mobile Wi-Fi hiccup
        return uploadToDesktop(base64Data, attempt + 1);
      }
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      const msg = isTimeout
        ? 'Connection timed out while beaming. Ensure your phone and laptop are still on the same Wi-Fi network, then tap Retry.'
        : err instanceof Error
        ? err.message
        : 'Failed to beam photo to computer';
      console.error(err);
      setError(msg);
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processAndUploadFile(e.target.files[0]);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f8fd] text-slate-900 flex flex-col justify-between p-6 max-w-md mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 mb-2">
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-sky-700 font-mono">
            SolvAm Phone Lens
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">Camera Bridge</h1>
        <p className="text-xs text-slate-500 mt-1">
          {connected ? 'Connected to desktop workspace. Ready to snap.' : 'Connecting to desktop...'}
        </p>
      </div>

      {/* Main View Area */}
      <div className="my-8 flex flex-col items-center justify-center">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-sm mb-6 w-full">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {photoPreview ? (
          <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden border border-sky-200 bg-white shadow-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview} alt="Captured Math" className="w-full h-full object-cover" />
            {uploading && (
              <div className="absolute inset-0 bg-white/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-sky-600 animate-spin" />
                <span className="text-sm font-bold text-slate-900">Beaming to Desktop...</span>
              </div>
            )}
            {success && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-6 text-center animate-fadeIn">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                <span className="text-lg font-extrabold text-slate-900">Beamed to Computer!</span>
                <p className="text-xs text-slate-500">
                  Your exam sheet is now segmented on your desktop screen.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full aspect-[3/4] rounded-3xl border-2 border-dashed border-sky-200 bg-white flex flex-col items-center justify-center p-6 text-center shadow-soft">
            <div className="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center mb-4">
              <Camera className="w-8 h-8 text-sky-600" />
            </div>
            <h3 className="font-bold text-slate-900">Snap WAEC Problem</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
              Point your phone at textbook questions or your handwritten solution on paper.
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
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
            className="w-full py-4 bg-sky-600 hover:bg-sky-500 active:scale-[0.98] text-white font-bold rounded-2xl transition flex items-center justify-center gap-3 shadow-lg shadow-sky-500/25 disabled:opacity-50 text-base"
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
            className="w-full py-3.5 bg-white hover:bg-sky-50 border border-sky-200 text-sky-700 font-bold rounded-2xl transition flex items-center justify-center gap-2 shadow-sm"
          >
            <Camera className="w-5 h-5" />
            <span>Snap Another Problem</span>
          </button>
        )}

        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <Smartphone className="w-3.5 h-3.5 text-sky-500" />
          <span>Session Token: <code className="font-mono text-sky-700 font-semibold">{sessionId || '...'}</code></span>
        </div>
      </div>
    </div>
  );
}

export default function CapturePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f4f8fd] flex items-center justify-center text-slate-500 text-sm">
        Initializing Phone Lens...
      </div>
    }>
      <CaptureContent />
    </Suspense>
  );
}
