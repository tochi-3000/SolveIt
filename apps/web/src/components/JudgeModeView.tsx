'use client';

import React, { useState } from 'react';
import MathDisplay from './MathDisplay';
import SamSegmentationCanvas from './SamSegmentationCanvas';
import RedPenGraderCanvas from './RedPenGraderCanvas';
import TelemetryHud from './TelemetryHud';
import { SolveResponse, SAMSegment, GradeHandwritingResponse } from '@solvam/shared-types';
import { TelemetryEvent } from '@/lib/ai/types';
import {
  Sparkles,
  Scan,
  Calculator,
  Award,
  Cpu,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  FileText,
  Upload,
  Terminal,
  Layers,
  CheckCircle2,
} from 'lucide-react';

interface JudgeModeViewProps {
  engineStatus: 'checking' | 'online' | 'offline';
  engineLatency: number | null;
  onOpenTelemetryDrawer: () => void;
  // SAM 3.1 Scanner props
  activeExamImage: string | null;
  samSegments: SAMSegment[];
  samLoading: boolean;
  selectedSegmentId: string | null;
  onSelectSegment: (segment: SAMSegment) => void;
  onLoadSampleSheet: () => void;
  onOpenUploadDialog: () => void;
  onOpenCameraBridge: () => void;
  // Muse Spark 1.3 Tool-Loop props
  onTriggerMusePidginDemo: () => void;
  transcribeLoading: boolean;
  aiSolutionCard: React.ReactNode;
  telemetry: TelemetryEvent | null;
  // Red-Pen Handwritten Grader props
  handwritingResult: GradeHandwritingResponse;
  handwritingLoading: boolean;
  onLoadHandwritingSample: (sampleId: string) => void;
  // Deterministic SymPy Benchmark props
  equationInput: string;
  onChangeEquationInput: (eq: string) => void;
  solveResult: SolveResponse | null;
  solveLoading: boolean;
  solveLatency: number | null;
  onSolveDeterministic: () => void;
  onNavigateToPractice: (eq: string) => void;
}

export const JudgeModeView: React.FC<JudgeModeViewProps> = ({
  engineStatus,
  engineLatency,
  onOpenTelemetryDrawer,
  activeExamImage,
  samSegments,
  samLoading,
  selectedSegmentId,
  onSelectSegment,
  onLoadSampleSheet,
  onOpenUploadDialog,
  onOpenCameraBridge,
  onTriggerMusePidginDemo,
  transcribeLoading,
  aiSolutionCard,
  telemetry,
  handwritingResult,
  handwritingLoading,
  onLoadHandwritingSample,
  equationInput,
  onChangeEquationInput,
  solveResult,
  solveLoading,
  solveLatency,
  onSolveDeterministic,
  onNavigateToPractice,
}) => {
  const [activeScenarioTab, setActiveScenarioTab] = useState<
    'sam-scanner' | 'muse-tool-loop' | 'red-pen-grader' | 'sympy-benchmark'
  >('sam-scanner');

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Judge Command Center Header Card */}
      <section className="bg-gradient-to-r from-[#0f172a] via-[#131c31] to-[#0f172a] border border-[#1e293b] rounded-[16px] p-6 sm:p-8 text-white shadow-lg space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-xs font-bold text-blue-300 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Hackathon Judge Evaluation Suite • Zero API Setup Required</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              SolvAm Neuro-Symbolic Architecture Sandbox
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-[1.6]">
              Test every Meta AI integration and deterministic SymPy proof from a single page. Click any of the 4 live evaluation modules below to inspect <strong>Meta SAM 3.1 segmentation</strong>, <strong>Muse Spark 1.3 native tool-calling</strong>, <strong>Red-Pen WAEC grading</strong>, and <strong>sub-50ms SymPy AST benchmarks</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
            <button
              type="button"
              onClick={onOpenTelemetryDrawer}
              className="px-4 py-2.5 rounded-[10px] bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <Terminal className="w-4 h-4" />
              <span>Architecture &amp; Rubric Specs</span>
            </button>
          </div>
        </div>

        {/* 4 Interactive Scenario Cards (1-Click Triggers) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <button
            type="button"
            onClick={() => {
              setActiveScenarioTab('sam-scanner');
              onLoadSampleSheet();
            }}
            className={`p-4 rounded-[12px] border text-left transition flex flex-col justify-between gap-3 ${
              activeScenarioTab === 'sam-scanner'
                ? 'bg-blue-600/25 border-blue-400 text-white shadow-md'
                : 'bg-slate-900/90 hover:bg-slate-800/80 border-slate-800 text-slate-300'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold">
                  01 • Meta SAM 3.1
                </span>
                <Scan className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-sm font-bold text-white">Multi-Problem Exam Scanner</div>
              <p className="text-[11px] text-slate-400 leading-[1.5]">
                Segment a full 2024 WASSCE Paper 2 sheet into clickable equation masks.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-blue-300 flex items-center gap-1">
              <span>Run Live Demo</span>
              <ArrowRight className="w-3 h-3" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveScenarioTab('muse-tool-loop');
              onTriggerMusePidginDemo();
            }}
            className={`p-4 rounded-[12px] border text-left transition flex flex-col justify-between gap-3 ${
              activeScenarioTab === 'muse-tool-loop'
                ? 'bg-blue-600/25 border-blue-400 text-white shadow-md'
                : 'bg-slate-900/90 hover:bg-slate-800/80 border-slate-800 text-slate-300'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                  02 • Muse Spark 1.3
                </span>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-sm font-bold text-white">Pidgin &amp; Tool-Call Loop</div>
              <p className="text-[11px] text-slate-400 leading-[1.5]">
                Execute native SymPy tool calls + Nigerian Pidgin WAEC M1/A1 scaffolding.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
              <span>Run Live Demo</span>
              <ArrowRight className="w-3 h-3" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveScenarioTab('red-pen-grader');
              onLoadHandwritingSample('flawed_student_notebook_sign_error');
            }}
            className={`p-4 rounded-[12px] border text-left transition flex flex-col justify-between gap-3 ${
              activeScenarioTab === 'red-pen-grader'
                ? 'bg-blue-600/25 border-blue-400 text-white shadow-md'
                : 'bg-slate-900/90 hover:bg-slate-800/80 border-slate-800 text-slate-300'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold">
                  03 • AST Grader
                </span>
                <Award className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-sm font-bold text-white">&ldquo;Red-Pen&rdquo; Mistake Grader</div>
              <p className="text-[11px] text-slate-400 leading-[1.5]">
                Pinpoint a student&apos;s Line 2 sign slip on ruled paper while awarding partial M1 marks.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-rose-300 flex items-center gap-1">
              <span>Run Live Demo</span>
              <ArrowRight className="w-3 h-3" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveScenarioTab('sympy-benchmark');
              onSolveDeterministic();
            }}
            className={`p-4 rounded-[12px] border text-left transition flex flex-col justify-between gap-3 ${
              activeScenarioTab === 'sympy-benchmark'
                ? 'bg-blue-600/25 border-blue-400 text-white shadow-md'
                : 'bg-slate-900/90 hover:bg-slate-800/80 border-slate-800 text-slate-300'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[10px] font-bold">
                  04 • SymPy CAS
                </span>
                <Calculator className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-sm font-bold text-white">Deterministic Benchmark</div>
              <p className="text-[11px] text-slate-400 leading-[1.5]">
                Test raw sub-50ms symbolic roots &amp; discriminant ($\Delta = b^2 - 4ac$) proofs.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-purple-300 flex items-center gap-1">
              <span>Run Benchmark</span>
              <ArrowRight className="w-3 h-3" />
            </span>
          </button>
        </div>
      </section>

      {/* 2. Active Scenario Interactive Stage */}
      {activeScenarioTab === 'sam-scanner' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#f8fafc] dark:bg-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[12px]">
            <div className="flex items-center gap-2.5">
              <Scan className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa]" />
              <span className="text-xs sm:text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]">
                Scenario 01: Meta SAM 3.1 Multi-Equation Exam Sheet Segmentation
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onLoadSampleSheet}
                className="px-3 py-1.5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold transition flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Reload 2024 WAEC Sheet</span>
              </button>
              <button
                type="button"
                onClick={onOpenUploadDialog}
                className="px-3 py-1.5 rounded-[8px] bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] transition flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-[#2563eb]" />
                <span>Upload Custom Sheet</span>
              </button>
              <button
                type="button"
                onClick={onOpenCameraBridge}
                className="px-3 py-1.5 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/50 text-[#1e3a8a] dark:text-[#93c5fd] text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>QR Phone Lens</span>
              </button>
            </div>
          </div>

          {activeExamImage ? (
            <SamSegmentationCanvas
              imageUrl={activeExamImage}
              segments={samSegments}
              selectedSegmentId={selectedSegmentId}
              onSelectSegment={onSelectSegment}
              isLoading={samLoading}
            />
          ) : (
            <div className="p-10 bg-gradient-to-b from-[#f8fafc] to-[#f0f7ff] dark:from-[#131c2e] dark:to-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[12px] text-center space-y-4">
              <Scan className="w-8 h-8 text-[#2563eb] mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#0f172a] dark:text-[#f8fafc]">
                  Load the Pre-Calibrated WASSCE 2024 Exam Sheet
                </h3>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] max-w-md mx-auto">
                  Click the button below to segment 4 distinct WAEC questions using Meta SAM 3.1 bounding boxes.
                </p>
              </div>
              <button
                type="button"
                onClick={onLoadSampleSheet}
                className="px-5 py-2.5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold transition inline-flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>Load 1-Click WAEC 2024 Exam Sheet</span>
              </button>
            </div>
          )}

          {aiSolutionCard}
        </div>
      )}

      {activeScenarioTab === 'muse-tool-loop' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#f8fafc] dark:bg-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[12px]">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa]" />
              <span className="text-xs sm:text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]">
                Scenario 02: Meta Muse Spark 1.3 Native Tool-Calling &amp; Nigerian Pidgin Scaffolding
              </span>
            </div>
            <button
              type="button"
              onClick={onTriggerMusePidginDemo}
              disabled={transcribeLoading}
              className="px-4 py-2 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${transcribeLoading ? 'animate-spin' : ''}`} />
              <span>{transcribeLoading ? 'Executing Tool-Loop...' : 'Re-Run Tool-Call Loop'}</span>
            </button>
          </div>

          {aiSolutionCard}

          <TelemetryHud
            telemetry={telemetry}
            engineStatus={engineStatus}
            engineLatency={engineLatency}
            defaultExpanded={true}
          />
        </div>
      )}

      {activeScenarioTab === 'red-pen-grader' && (
        <div className="space-y-6 animate-fadeIn">
          <RedPenGraderCanvas
            gradingResult={handwritingResult}
            onSelectSample={onLoadHandwritingSample}
            onSolveTwin={(twinEq) => onNavigateToPractice(twinEq)}
            isLoading={handwritingLoading}
          />
        </div>
      )}

      {activeScenarioTab === 'sympy-benchmark' && (
        <section className="bg-gradient-to-b from-[#f8fafc] to-[#f0f7ff] dark:from-[#131c2e] dark:to-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[12px] p-6 sm:p-8 space-y-6 animate-fadeIn">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-xs font-semibold text-[#1e3a8a] dark:text-[#93c5fd]">
              <Calculator className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
              <span>Deterministic Symbolic Engine Benchmark</span>
            </div>
            <h3 className="text-xl font-bold text-[#0f172a] dark:text-[#f8fafc] mt-2">
              Exact Algebraic Root &amp; Discriminant Solver
            </h3>
            <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] mt-1 leading-[1.6]">
              Test the underlying Python SymPy CAS directly. Computes exact roots, discriminants (
              <MathDisplay value="$\Delta = b^2 - 4ac$" inline />
              ), and algebraic milestones with 0% LLM arithmetic hallucination.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] mb-1.5">
                  Mathematical Equation (LaTeX or Standard Notation)
                </label>
                <input
                  type="text"
                  value={equationInput}
                  onChange={(e) => onChangeEquationInput(e.target.value)}
                  placeholder="e.g. 3x^2 - 5x - 2 = 0"
                  className="w-full bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[8px] px-4 py-3 text-sm font-mono text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
                />
              </div>

              <div className="py-5 px-6 bg-white dark:bg-[#0f172a] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] text-center min-h-[84px] flex flex-col items-center justify-center">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] mb-1">
                  Live KaTeX Preview
                </span>
                <MathDisplay
                  value={equationInput}
                  displayMode
                  className="text-[#0f172a] dark:text-[#f8fafc] font-bold text-lg"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8]">
                  Presets:
                </span>
                {[
                  { label: 'Quadratic (3x² - 5x - 2 = 0)', eq: '3x^2 - 5x - 2 = 0' },
                  { label: 'Diff of Squares (x² - 16 = 0)', eq: 'x^2 - 16 = 0' },
                  { label: 'Linear (3x - 12 = 0)', eq: '3x - 12 = 0' },
                  { label: 'Perfect Square (x² - 6x + 9 = 0)', eq: 'x^2 - 6x + 9 = 0' },
                ].map((preset) => (
                  <button
                    key={preset.eq}
                    type="button"
                    onClick={() => onChangeEquationInput(preset.eq)}
                    className="px-3 py-1.5 bg-[#dbeafe] dark:bg-[#1e3a8a]/40 hover:bg-[#bfdbfe] dark:hover:bg-[#1e3a8a]/60 text-[#1e3a8a] dark:text-[#93c5fd] rounded-[8px] text-xs font-semibold transition"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={onSolveDeterministic}
                disabled={solveLoading}
                className="w-full py-3 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-xs sm:text-sm rounded-[8px] transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {solveLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Solve Deterministically with SymPy</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            <div className="lg:col-span-5">
              {solveResult ? (
                <div className="h-full p-6 bg-white dark:bg-[#0f172a] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] space-y-4 flex flex-col justify-between animate-fadeIn">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-xs font-semibold text-[#1e3a8a] dark:text-[#93c5fd]">
                        {solveResult.topic_label}
                      </span>
                      {solveLatency !== null && (
                        <span className="text-xs font-mono text-[#64748b] dark:text-[#94a3b8]">
                          {solveLatency}ms
                        </span>
                      )}
                    </div>

                    <div className="p-5 bg-[#f8fafc] dark:bg-[#0b1120] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] text-center">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] mb-1">
                        Verified Exact Roots
                      </div>
                      <MathDisplay
                        value={solveResult.solution_latex}
                        displayMode
                        className="text-[#1e3a8a] dark:text-[#93c5fd] font-bold text-xl"
                      />
                    </div>

                    {solveResult.discriminant !== null && solveResult.discriminant !== undefined && (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-[#f8fafc] dark:bg-[#0b1120] rounded-[8px] border border-[#e2e8f0] dark:border-[#1e293b]">
                          <span className="text-[#64748b] dark:text-[#94a3b8] block text-[10px] uppercase font-semibold">
                            Discriminant (Δ)
                          </span>
                          <span className="font-mono font-bold text-base text-[#0f172a] dark:text-[#f8fafc]">
                            {solveResult.discriminant}
                          </span>
                        </div>
                        <div className="p-3 bg-[#f8fafc] dark:bg-[#0b1120] rounded-[8px] border border-[#e2e8f0] dark:border-[#1e293b]">
                          <span className="text-[#64748b] dark:text-[#94a3b8] block text-[10px] uppercase font-semibold">
                            Nature of Roots
                          </span>
                          <span className="font-semibold text-[#0f172a] dark:text-[#f8fafc] block mt-0.5">
                            {solveResult.milestones.nature_of_roots}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between text-xs text-[#64748b] dark:text-[#94a3b8]">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>AST Guard: Verified</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigateToPractice(equationInput)}
                      className="font-semibold text-[#2563eb] dark:text-[#60a5fa] hover:underline flex items-center gap-1"
                    >
                      <span>Open in Practice</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-[240px] p-6 bg-white dark:bg-[#0f172a] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] flex flex-col items-center justify-center text-center">
                  <Calculator className="w-8 h-8 text-[#2563eb] dark:text-[#60a5fa] mb-2" />
                  <h3 className="text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]">
                    Ready for Symbolic Computation
                  </h3>
                  <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1 max-w-xs leading-[1.6]">
                    Click &ldquo;Solve Deterministically with SymPy&rdquo; to compute exact roots and discriminants.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default JudgeModeView;
