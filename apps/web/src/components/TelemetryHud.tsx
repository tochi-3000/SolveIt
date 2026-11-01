'use client';

import React, { useState, useEffect } from 'react';
import { TelemetryEvent } from '@/lib/ai/types';
import {
  Terminal,
  ChevronDown,
  ChevronUp,
  Code2,
  Zap,
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
    <div className="bg-surface border border-line rounded-2xl shadow-card px-4 py-3 transition-colors">
      {/* Compact Collapsible Telemetry Bar Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full flex flex-wrap items-center justify-between gap-3 text-left select-none rounded-lg"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center gap-2 text-[13px] font-medium text-ink">
            <Terminal className="w-4 h-4 text-ink-muted" />
            <span>Neuro-Symbolic Telemetry HUD</span>
          </span>

          <span className="text-xs text-ink-muted hidden sm:inline truncate">
            {telemetry
              ? `${telemetry.model} • ${toolCalls.length} Native Tool Invocations`
              : 'Neuro-Symbolic Trace Monitor • Idle'}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-full bg-surface-subtle border border-line text-[11.5px] font-medium text-ink-soft flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`w-1.5 h-1.5 rounded-full ${
                engineStatus === 'online'
                  ? 'bg-emerald-500'
                  : engineStatus === 'checking'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span className="capitalize">
              SymPy AST: {engineStatus}
              {engineLatency !== null ? ` (${engineLatency}ms)` : ''}
            </span>
          </span>

          {telemetry && (
            <span className="px-2.5 py-1 rounded-full bg-brand-tint text-brand-ink text-[11.5px] font-medium tabular-nums">
              {telemetry.latencyMs}ms
            </span>
          )}

          <div className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expanded Telemetry Details & Native Tool Invocations */}
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-line space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-surface rounded-[8px] border border-line">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">
                Active Model
              </span>
              <span className="font-mono text-xs font-medium text-ink mt-1 block truncate">
                {telemetry?.model || 'meta-muse-spark-1.3 (Standby)'}
              </span>
            </div>

            <div className="p-3 bg-surface rounded-[8px] border border-line">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">
                Execution Pipeline
              </span>
              <span className="font-mono text-xs font-medium text-brand-ink mt-1 block truncate">
                SAM 3.1 + SymPy AST Verification
              </span>
            </div>

            <div className="p-3 bg-surface rounded-[8px] border border-line">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">
                Token &amp; Cache Economy
              </span>
              <span className="font-mono text-xs font-medium text-ink mt-1 block">
                {telemetry?.tokenUsage?.totalTokens
                  ? `${telemetry.tokenUsage.totalTokens} tokens (Prefix Cached)`
                  : 'Prefix Cache Warmed'}
              </span>
            </div>
          </div>

          {/* Native Tool Invocations Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-brand-fg" />
                <span>NATIVE TOOL INVOCATIONS ({toolCalls.length})</span>
              </span>
              {telemetry && (
                <span className="text-[11px] font-mono text-ink-muted">
                  Total Roundtrip: {telemetry.latencyMs}ms
                </span>
              )}
            </div>

            {toolCalls.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {toolCalls.map((tc, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-surface rounded-[8px] border border-line font-mono text-[11px] space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-brand-ink flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-brand-fg" />
                        {tc.toolName}()
                      </span>
                      <span className="px-2 py-0.5 rounded-[8px] bg-surface-subtle border border-line text-ink-muted text-[10px]">
                        {tc.durationMs}ms
                      </span>
                    </div>

                    <div className="text-ink-muted text-[11px] truncate">
                      <span className="text-ink font-medium">Args:</span>{' '}
                      {JSON.stringify(tc.arguments)}
                    </div>

                    <div className="text-brand-ink text-[11px] truncate">
                      <span className="text-ink font-medium">
                        SymPy Output:
                      </span>{' '}
                      {JSON.stringify(tc.result)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-surface rounded-[8px] border border-line font-mono text-[11px] text-ink-muted">
                No tool invocations recorded in this session yet. Select an equation from the exam sheet or run the Muse Spark pipeline to inspect live SymPy AST tool calls.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
