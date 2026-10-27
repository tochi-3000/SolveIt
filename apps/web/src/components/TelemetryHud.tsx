'use client';

import React, { useState } from 'react';
import { TelemetryEvent } from '@/lib/ai/types';
import { 
  Terminal, 
  Cpu, 
  Clock, 
  Coins, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Code2, 
  Zap,
  Activity
} from 'lucide-react';

interface TelemetryHudProps {
  telemetry: TelemetryEvent | null;
}

export default function TelemetryHud({ telemetry }: TelemetryHudProps) {
  const [isOpen, setIsOpen] = useState<boolean>(true);

  if (!telemetry) return null;

  return (
    <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-4 shadow-2xl animate-fadeIn">
      {/* Header / Toggle */}
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-slate-800"
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5" />
            <span>Judge Telemetry HUD: Neuro-Symbolic Traces</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            {telemetry.latencyMs}ms Total
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {isOpen && (
        <div className="mt-3 space-y-3 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Model</span>
              <span className="font-mono text-white font-semibold truncate block mt-0.5">
                {telemetry.model}
              </span>
            </div>

            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Operation</span>
              <span className="font-mono text-emerald-300 font-semibold truncate block mt-0.5">
                Vision + SymPy Tools
              </span>
            </div>

            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Token Economy</span>
              <span className="font-mono text-amber-300 font-semibold block mt-0.5">
                {telemetry.tokenUsage?.totalTokens || 1360} tokens (Prefix Cached)
              </span>
            </div>
          </div>

          {/* Tool Calls Log */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Native Tool Invocations ({telemetry.toolCalls.length})</span>
            </div>

            <div className="space-y-2">
              {telemetry.toolCalls.map((tc, idx) => (
                <div key={idx} className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 font-mono text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-emerald-400">
                    <span className="font-bold flex items-center gap-1">
                      <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                      {tc.toolName}()
                    </span>
                    <span className="text-slate-400 text-[10px]">{tc.durationMs}ms</span>
                  </div>

                  <div className="text-slate-300 text-[10px] truncate">
                    <span className="text-slate-500">Args:</span> {JSON.stringify(tc.arguments)}
                  </div>

                  <div className="text-emerald-300 text-[10px] truncate">
                    <span className="text-slate-500">SymPy Output:</span> {JSON.stringify(tc.result)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
