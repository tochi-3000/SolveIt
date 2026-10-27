'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Scan,
  Layers,
  Award,
  Terminal,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldAlert,
  Zap,
} from 'lucide-react';

interface JudgeModeBarProps {
  onSelectSample1: () => void;
  onSelectSample2: () => void;
  onSelectSample3: () => void;
  onOpenTelemetryDrawer: () => void;
  activeSample?: number | null;
}

export const JudgeModeBar: React.FC<JudgeModeBarProps> = ({
  onSelectSample1,
  onSelectSample2,
  onSelectSample3,
  onOpenTelemetryDrawer,
  activeSample = null,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  if (isMinimized) {
    return (
      <div className="flex items-center justify-between p-2.5 px-4 bg-gradient-to-r from-[#1e3a8a]/90 via-[#2563eb]/90 to-[#1d4ed8]/90 text-white rounded-[12px] shadow-md border border-[#3b82f6]/40 select-none animate-fadeIn mb-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-bold tracking-tight">
            ⚡ Judge Mode Active (2-Min Demo Quickbar)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenTelemetryDrawer}
            className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white text-[11px] font-mono font-semibold rounded-[6px] transition flex items-center gap-1.5"
          >
            <Terminal className="w-3 h-3" />
            <span>Telemetry Drawer</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-1 hover:bg-white/20 rounded-[6px] text-white/80 hover:text-white transition"
            title="Expand Judge Bar"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-[#0f172a] via-[#1e3a8a] to-[#0f172a] text-white rounded-[16px] p-4 sm:p-5 shadow-lg border border-[#3b82f6]/40 select-none mb-6 animate-fadeIn">
      {/* Decorative Glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner Row */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-black tracking-wider uppercase text-blue-200">
            Hackathon Judge Quick-Demo (2-Minute Evaluation Flow)
          </span>
          <span className="px-2 py-0.5 rounded-[6px] bg-white/10 text-white font-mono text-[10px] font-bold">
            Meta AI 2026
          </span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={onOpenTelemetryDrawer}
            className="px-3 py-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-mono font-semibold rounded-[8px] transition flex items-center gap-1.5 border border-white/20 shadow-sm"
          >
            <Terminal className="w-3.5 h-3.5 text-blue-300" />
            <span>Open Architecture &amp; Telemetry HUD</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-white/15 rounded-[8px] text-white/70 hover:text-white transition"
            title="Minimize Judge Bar"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3 Guided Sample Buttons Matching Hackathon Criteria */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3 pt-3.5">
        {/* Sample 1: Multi-Equation SAM 3.1 Scanner */}
        <button
          type="button"
          onClick={onSelectSample1}
          className={`p-3 rounded-[12px] text-left transition-all border flex flex-col justify-between group active:scale-[0.98] ${
            activeSample === 1
              ? 'bg-blue-600/40 border-blue-400 shadow-md ring-2 ring-blue-400/40'
              : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/25'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="px-2 py-0.5 rounded-[6px] bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold flex items-center gap-1">
              <Scan className="w-3 h-3" />
              <span>SAM 3.1 Vision</span>
            </span>
            <span className="text-[10px] text-white/60 font-mono">Sample 01</span>
          </div>

          <div className="mt-2">
            <div className="text-xs font-bold text-white group-hover:text-blue-200 transition">
              Multi-Equation Exam Sheet
            </div>
            <p className="text-[11px] text-white/70 mt-0.5 leading-[1.4] line-clamp-2">
              Isolates 4 individual questions on authentic 2024 WAEC past paper with pulsing polygon masks.
            </p>
          </div>
        </button>

        {/* Sample 2: Geometry & Visual Diagram */}
        <button
          type="button"
          onClick={onSelectSample2}
          className={`p-3 rounded-[12px] text-left transition-all border flex flex-col justify-between group active:scale-[0.98] ${
            activeSample === 2
              ? 'bg-blue-600/40 border-blue-400 shadow-md ring-2 ring-blue-400/40'
              : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/25'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="px-2 py-0.5 rounded-[6px] bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold flex items-center gap-1">
              <Layers className="w-3 h-3" />
              <span>Muse Spark &amp; Image</span>
            </span>
            <span className="text-[10px] text-white/60 font-mono">Sample 02</span>
          </div>

          <div className="mt-2">
            <div className="text-xs font-bold text-white group-hover:text-indigo-200 transition">
              Geometry Diagram &amp; Pidgin Audio
            </div>
            <p className="text-[11px] text-white/70 mt-0.5 leading-[1.4] line-clamp-2">
              Circle sector (r=7cm, θ=60°) with generated SVG diagram, WAEC M1/A1 marks, and spoken voice tutor.
            </p>
          </div>
        </button>

        {/* Sample 3: Red-Pen Handwritten Grader */}
        <button
          type="button"
          onClick={onSelectSample3}
          className={`p-3 rounded-[12px] text-left transition-all border flex flex-col justify-between group active:scale-[0.98] ${
            activeSample === 3
              ? 'bg-rose-600/40 border-rose-400 shadow-md ring-2 ring-rose-400/40'
              : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/25'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="px-2 py-0.5 rounded-[6px] bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold flex items-center gap-1">
              <Award className="w-3 h-3" />
              <span>SymPy CAS AST</span>
            </span>
            <span className="text-[10px] text-white/60 font-mono">Sample 03</span>
          </div>

          <div className="mt-2">
            <div className="text-xs font-bold text-white group-hover:text-rose-200 transition">
              Red-Pen Handwritten Grader
            </div>
            <p className="text-[11px] text-white/70 mt-0.5 leading-[1.4] line-clamp-2">
              Authentic lined notebook with Bic blue ink. Pinpoints sign mistake on Line 2 (-6x - x = -7x).
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default JudgeModeBar;
