'use client';

import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  Copy,
  Check,
  Upload,
  Wifi,
} from 'lucide-react';

interface CameraBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoReceived: (base64Image: string) => void;
}

export default function CameraBridgeModal({
  isOpen,
  onClose,
  onPhotoReceived,
}: CameraBridgeModalProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [captureUrl, setCaptureUrl] = useState<string>('');
  const [status, setStatus] = useState<'initializing' | 'waiting' | 'connected' | 'received'>(
    'initializing'
  );
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

        const fullUrl = data.captureUrl || `${window.location.origin}${data.capturePath}`;
        setSessionId(data.sessionId);
        setCaptureUrl(fullUrl);
        setStatus('waiting');

        startStream(data.sessionId);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Could not initialize camera pairing';
        console.error('Session init error:', e);
        setError(msg);
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
      es.close();
    };

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/session/${id}/status`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'connected') {
          setStatus((prev) => (prev === 'waiting' || prev === 'initializing' ? 'connected' : prev));
        }

        if (data.status === 'completed' && data.imageData) {
          handleSuccess(data.imageData);
        }
      } catch (_) {}
    }, 1200);
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
    <div className="fixed inset-0 z-50 bg-[#0f172a]/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[16px] max-w-md w-full p-6 sm:p-7 shadow-app-shell relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-[8px] bg-[#f8fafc] dark:bg-[#0b1120] hover:bg-[#e2e8f0]/60 dark:hover:bg-[#1e293b] text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc] transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-[#1e3a8a] dark:text-[#93c5fd] text-xs font-semibold mb-2">
            <Smartphone className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
            <span>Mobile Camera Bridge</span>
          </div>
          <h2 className="text-xl font-bold text-[#0f172a] dark:text-[#f8fafc]">
            Scan from Your Phone
          </h2>
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1 max-w-xs mx-auto leading-[1.6]">
            Scan the QR code below with your smartphone camera. Snap a photo of your WAEC exam paper to beam it here live.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-[8px] bg-rose-50 dark:bg-rose-950/50 text-xs text-rose-700 dark:text-rose-300 text-center">
            {error}
          </div>
        )}

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#f8fafc] to-[#f0f7ff] dark:from-[#131c2e] dark:to-[#0b1120] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] mb-6 relative">
          {status === 'initializing' ? (
            <div className="h-[210px] flex flex-col items-center justify-center gap-2 text-[#64748b] dark:text-[#94a3b8] text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-[#2563eb] dark:text-[#60a5fa]" />
              <span>Generating secure session QR...</span>
            </div>
          ) : status === 'connected' ? (
            <div className="h-[210px] flex flex-col items-center justify-center gap-3 text-center px-4 animate-fadeIn">
              <div className="w-14 h-14 rounded-[12px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 flex items-center justify-center">
                <Smartphone className="w-7 h-7 text-[#2563eb] dark:text-[#60a5fa] animate-pulse" />
              </div>
              <span className="text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]">
                Phone Connected!
              </span>
              <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                Aim your phone camera at the math exam paper and tap snap.
              </p>
            </div>
          ) : status === 'received' ? (
            <div className="h-[210px] flex flex-col items-center justify-center gap-3 text-center animate-fadeIn">
              <CheckCircle2 className="w-11 h-11 text-[#2563eb] dark:text-[#60a5fa]" />
              <span className="text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]">
                Photo Beamed to Screen!
              </span>
              <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                Loading into SolvAm SAM 3.1 engine...
              </p>
            </div>
          ) : (
            captureUrl && (
              <div className="p-3.5 bg-white rounded-[12px] border border-[#e2e8f0] shadow-sm">
                <QRCodeSVG
                  value={captureUrl}
                  size={188}
                  bgColor="#ffffff"
                  fgColor="#1e3a8a"
                  level="M"
                />
              </div>
            )
          )}

          {status === 'waiting' && (
            <div className="mt-4 flex items-center gap-2 text-xs text-[#1e3a8a] dark:text-[#93c5fd] font-mono font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#2563eb] dark:bg-[#60a5fa] animate-ping" />
              <span>Waiting for phone scan...</span>
            </div>
          )}
        </div>

        {/* Same Wi-Fi / Hotspot Requirement Note */}
        <div className="mb-4 px-3.5 py-2.5 rounded-[10px] bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 flex items-start gap-2.5 text-left">
          <Wifi className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-[1.5]">
            <strong className="font-semibold">Same Network Required:</strong> Make sure your{' '}
            <strong className="font-semibold">laptop and phone are connected to the same Wi-Fi network</strong>{' '}
            (or mobile hotspot) before scanning the QR code.
          </p>
        </div>

        {/* Link sharing & Desktop fallback */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-2 bg-[#f8fafc] dark:bg-[#0b1120] rounded-[8px] border border-[#e2e8f0] dark:border-[#1e293b] text-xs">
            <span className="truncate flex-1 font-mono text-[#64748b] dark:text-[#94a3b8] px-2">
              {captureUrl || '...'}
            </span>
            <button
              onClick={copyLink}
              className="px-3 py-1.5 bg-[#dbeafe] dark:bg-[#1e3a8a]/40 hover:bg-[#bfdbfe] dark:hover:bg-[#1e3a8a]/60 text-[#1e3a8a] dark:text-[#93c5fd] rounded-[8px] transition flex items-center gap-1 font-semibold flex-shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="pt-2 text-center">
            <label className="text-xs text-[#2563eb] dark:text-[#60a5fa] hover:text-[#1d4ed8] font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>Or upload an exam photo directly from this computer</span>
              <input type="file" accept="image/*" onChange={handleDesktopFile} className="hidden" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
