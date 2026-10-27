'use client';

import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  X, 
  Smartphone, 
  QrCode, 
  RefreshCw, 
  CheckCircle2, 
  Copy, 
  Check, 
  Upload, 
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface CameraBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoReceived: (base64Image: string) => void;
}

export default function CameraBridgeModal({ isOpen, onClose, onPhotoReceived }: CameraBridgeModalProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [captureUrl, setCaptureUrl] = useState<string>('');
  const [status, setStatus] = useState<'initializing' | 'waiting' | 'connected' | 'received'>('initializing');
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize session when modal opens
  useEffect(() => {
    if (!isOpen) {
      cleanup();
      return;
    }

    async function initSession() {
      setStatus('initializing');
      setError(null);

      try {
        const res = await fetch('/api/session/create', { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.sessionId) throw new Error(data.error || 'Failed to start pairing');

        const fullUrl = `${window.location.origin}${data.capturePath}`;
        setSessionId(data.sessionId);
        setCaptureUrl(fullUrl);
        setStatus('waiting');

        // Start SSE stream
        startStream(data.sessionId);
      } catch (e: any) {
        console.error('Session init error:', e);
        setError(e.message || 'Could not initialize camera pairing');
      }
    }

    initSession();

    return cleanup;
  }, [isOpen]);

  const cleanup = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setSessionId(null);
    setCaptureUrl('');
    setStatus('initializing');
  };

  const startStream = (id: string) => {
    // 1. Native Server-Sent Events (SSE)
    const es = new EventSource(`/api/session/${id}/stream`);
    eventSourceRef.current = es;

    es.addEventListener('status-change', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.status === 'connected') {
          setStatus('connected');
        }
      } catch (_) {}
    });

    es.addEventListener('photo-captured', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.imageData) {
          handleSuccess(payload.imageData);
        }
      } catch (_) {}
    });

    es.onerror = () => {
      // SSE dropped or unsupported; fallback poll handles it
      es.close();
    };

    // 2. Production Safeguard: 1.5s fallback poll (guards against serverless stream drops)
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/session/${id}/status`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'connected' && status === 'waiting') {
          setStatus('connected');
        }

        if (data.status === 'completed' && data.imageData) {
          handleSuccess(data.imageData);
        }
      } catch (_) {}
    }, 1500);
  };

  const handleSuccess = (imageData: string) => {
    setStatus('received');
    cleanup();
    setTimeout(() => {
      onPhotoReceived(imageData);
      onClose();
    }, 600);
  };

  const copyLink = () => {
    if (!captureUrl) return;
    navigator.clipboard.writeText(captureUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Direct desktop upload fallback
  const handleDesktopFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const b64 = ev.target?.result as string;
        handleSuccess(b64);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile Camera Bridge</span>
          </div>
          <h2 className="text-xl font-extrabold text-white">Snap from Your Phone</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Scan the QR code below using your phone camera. Take a photo of your math problem to beam it here in real-time.
          </p>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-6 bg-slate-950 rounded-2xl border border-slate-800 mb-6 relative">
          {status === 'initializing' ? (
            <div className="h-[220px] flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
              <span>Generating secure session QR...</span>
            </div>
          ) : status === 'connected' ? (
            <div className="h-[220px] flex flex-col items-center justify-center gap-3 text-center px-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <Smartphone className="w-8 h-8 text-emerald-400 animate-pulse" />
              </div>
              <span className="text-sm font-bold text-white">Phone Connected!</span>
              <p className="text-xs text-slate-400">
                Aim your phone camera at the textbook and tap snap.
              </p>
            </div>
          ) : status === 'received' ? (
            <div className="h-[220px] flex flex-col items-center justify-center gap-3 text-center animate-fadeIn">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              <span className="text-sm font-bold text-white">Photo Beamed to Screen!</span>
              <p className="text-xs text-slate-400">Loading into SolvAm engine...</p>
            </div>
          ) : (
            captureUrl && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 shadow-inner">
                <QRCodeSVG
                  value={captureUrl}
                  size={200}
                  bgColor="#020617"
                  fgColor="#10b981"
                  level="M"
                />
              </div>
            )
          )}

          {/* Real-time Status Badge */}
          {status === 'waiting' && (
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-300 font-mono">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Waiting for phone scan...</span>
            </div>
          )}
        </div>

        {/* Link sharing & Desktop fallback */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <span className="truncate flex-1 font-mono text-slate-400 px-2">{captureUrl || '...'}</span>
            <button
              onClick={copyLink}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition flex items-center gap-1 font-medium flex-shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Desktop Upload Fallback */}
          <div className="pt-2 text-center">
            <label className="text-xs text-slate-400 hover:text-emerald-400 cursor-pointer transition flex items-center justify-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>Or upload an image directly from this computer</span>
              <input type="file" accept="image/*" onChange={handleDesktopFile} className="hidden" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
