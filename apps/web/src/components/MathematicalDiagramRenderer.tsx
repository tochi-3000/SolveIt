'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Eye, X, RefreshCw, ZoomIn, Info } from 'lucide-react';
import MathDisplay from './MathDisplay';

interface MathematicalDiagramRendererProps {
  topic: string;
  equation: string;
  isOpen: boolean;
  onClose: () => void;
}

export const MathematicalDiagramRenderer: React.FC<MathematicalDiagramRendererProps> = ({
  topic,
  equation,
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [diagramUrl, setDiagramUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>('');
  const [modelLabel, setModelLabel] = useState<string>('Meta Muse Image');

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    fetch('/api/math/diagram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        equationOrPrompt: equation,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.imageUrl) {
          setDiagramUrl(data.imageUrl);
          setCaption(data.caption || `Illustrative visual diagram for ${topic}`);
          setModelLabel(data.model || 'Meta Muse Image');
        }
      })
      .catch((err) => {
        console.error('Failed to load diagram:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, topic, equation]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Multimodal Concept Visualizer • {modelLabel}</span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1">Mathematical Geometric Figure</h2>
          <p className="text-xs text-slate-400 mt-1">
            Visual concept representation generated for <strong>{topic}</strong> (
            <MathDisplay value={equation} inline />
            ).
          </p>
        </div>

        {/* Diagram Display Container */}
        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center justify-center min-h-[300px] overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <span className="text-xs text-slate-400 font-medium">
                Synthesizing geometric diagram via {modelLabel}...
              </span>
            </div>
          ) : diagramUrl ? (
            <div className="w-full flex flex-col items-center space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={diagramUrl}
                alt={caption}
                className="max-h-[340px] w-auto object-contain rounded-xl shadow-lg border border-slate-800/80"
              />
              <p className="text-xs text-slate-300 text-center px-4 leading-relaxed font-medium">
                {caption}
              </p>
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-12">
              No geometric figure required for this purely algebraic problem.
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-emerald-400" />
            <span>WAEC Theory Paper 2 requires labeled diagrams for full [M1] marks.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
          >
            Close Diagram
          </button>
        </div>
      </div>
    </div>
  );
};

export default MathematicalDiagramRenderer;
