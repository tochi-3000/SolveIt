'use client';

import React, { useState, useEffect } from 'react';
import { TelemetryEvent } from '@/lib/ai/types';
import {
  Terminal,
  ChevronDown,
  ChevronUp,
  Code2,
  Zap,
  Activity,
} from 'lucide-react';

interface TelemetryHudProps {
  telemetry: TelemetryEvent | null;
  engineStatus?: 'checking' | 'online' | 'offline';
  engineLatency?: number | null;
  defaultExpanded?: boolean;
}

export default function TelemetryHud({
  telemetry,
  engineStatus = 'online',
  engineLatency = null,
  defaultExpanded = false,
}: TelemetryHudProps) {
  const [isOpen, setIsOpen] = useState<boolean>(defaultExpanded);

  useEffect(() => {
    if (telemetry && defaultExpanded) {
      setIsOpen(true);
    }
  }, [telemetry, defaultExpanded]);

  const toolCalls = telemetry?.toolCalls ?? [];

  return (
    <div className="bg-[#f8fafc] dark:bg-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[12px] px-5 py-3.5 transition-all">
      {/* Compact Collapsible Telemetry Bar Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex flex-wrap items-center justify-between gap-3 text-left select-none"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-[#1e3a8a] dark:text-[#93c5fd] text-[11px] font-mono font-semibold tracking-tight">
            <Terminal className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
            <span>NEURO-SYMBOLIC TELEMETRY HUD</span>
          </span>

          <span className="text-xs font-mono text-[#64748b] dark:text-[#94a3b8] hidden sm:inline">
            {telemetry
              ? `${telemetry.model} • ${toolCalls.length} Native Tool Invocations`
              : 'Neuro-Symbolic Trace Monitor • Idle'}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-[8px] bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] text-[11px] font-mono text-[#0f172a] dark:text-[#f8fafc] flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-[#2563eb] dark:text-[#60a5fa]" />
            <span>
              SymPy AST: {engineStatus.toUpperCase()}
              {engineLatency !== null ? ` (${engineLatency}ms)` : ''}
            </span>
          </span>

          {telemetry && (
            <span className="px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-[#1e3a8a] dark:text-[#93c5fd] text-[11px] font-mono font-semibold">
              {telemetry.latencyMs}ms
            </span>
          )}

          <div className="p-1 rounded-[8px] text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc] hover:bg-[#e2e8f0]/50 dark:hover:bg-[#1e293b] transition">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expanded Telemetry Details & Native Tool Invocations */}
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-[#e2e8f0] dark:border-[#1e293b] space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-white dark:bg-[#0f172a] rounded-[8px] border border-[#e2e8f0] dark:border-[#1e293b]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] block">
                Active Model
              </span>
              <span className="font-mono text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] mt-1 block truncate">
                {telemetry?.model || 'meta-muse-spark-1.3 (Standby)'}
              </span>
            </div>

            <div className="p-3 bg-white dark:bg-[#0f172a] rounded-[8px] border border-[#e2e8f0] dark:border-[#1e293b]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] block">
                Execution Pipeline
              </span>
              <span className="font-mono text-xs font-semibold text-[#1e3a8a] dark:text-[#93c5fd] mt-1 block truncate">
                SAM 3.1 + SymPy AST Verification
              </span>
            </div>

            <div className="p-3 bg-white dark:bg-[#0f172a] rounded-[8px] border border-[#e2e8f0] dark:border-[#1e293b]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] block">
                Token &amp; Cache Economy
              </span>
              <span className="font-mono text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] mt-1 block">
                {telemetry?.tokenUsage?.totalTokens
                  ? `${telemetry.tokenUsage.totalTokens} tokens (Prefix Cached)`
                  : 'Prefix Cache Warmed'}
              </span>
            </div>
          </div>

          {/* Native Tool Invocations Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
                <span>NATIVE TOOL INVOCATIONS ({toolCalls.length})</span>
              </span>
              {telemetry && (
                <span className="text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8]">
                  Total Roundtrip: {telemetry.latencyMs}ms
                </span>
              )}
            </div>

            {toolCalls.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {toolCalls.map((tc, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white dark:bg-[#0f172a] rounded-[8px] border border-[#e2e8f0] dark:border-[#1e293b] font-mono text-[11px] space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#1e3a8a] dark:text-[#93c5fd] flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
                        {tc.toolName}()
                      </span>
                      <span className="px-2 py-0.5 rounded-[8px] bg-[#f8fafc] dark:bg-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] text-[#64748b] dark:text-[#94a3b8] text-[10px]">
                        {tc.durationMs}ms
                      </span>
                    </div>

                    <div className="text-[#64748b] dark:text-[#94a3b8] text-[11px] truncate">
                      <span className="text-[#0f172a] dark:text-[#f8fafc] font-medium">Args:</span>{' '}
                      {JSON.stringify(tc.arguments)}
                    </div>

                    <div className="text-[#1e3a8a] dark:text-[#93c5fd] text-[11px] truncate">
                      <span className="text-[#0f172a] dark:text-[#f8fafc] font-medium">
                        SymPy Output:
                      </span>{' '}
                      {JSON.stringify(tc.result)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-white dark:bg-[#0f172a] rounded-[8px] border border-[#e2e8f0] dark:border-[#1e293b] font-mono text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                No tool invocations recorded in this session yet. Select an equation from the exam sheet or run the Muse Spark pipeline to inspect live SymPy AST tool calls.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
