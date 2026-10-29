'use client';

import React, { useState } from 'react';
import MathDisplay from './MathDisplay';
import { HandwrittenGradedLine, GradeHandwritingResponse } from '@solvam/shared-types';
import {
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Info,
  RefreshCw,
  Eye,
  ArrowRight,
  FileText,
  Upload,
  Camera,
  Layers,
} from 'lucide-react';

interface RedPenGraderCanvasProps {
  gradingResult: GradeHandwritingResponse;
  onSelectSample?: (sampleId: string) => void;
  onSolveTwin?: (twinEquation: string) => void;
  onReGrade?: () => void;
  isLoading?: boolean;
}

export const RedPenGraderCanvas: React.FC<RedPenGraderCanvasProps> = ({
  gradingResult,
  onSelectSample,
  onSolveTwin,
  onReGrade,
  isLoading = false,
}) => {
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(
    gradingResult.firstErrorIndex || 1
  );

  const selectedLine =
    gradingResult.lines.find((l) => l.lineIndex === selectedLineIndex) ||
    gradingResult.lines[0];

  return (
    <div className="bg-gradient-to-b from-[#f8fafc] to-[#f0f7ff] dark:from-[#131c2e] dark:to-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[16px] p-6 sm:p-8 space-y-6 shadow-sm animate-fadeIn">
      {/* Top Header & Scoreboard Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#e2e8f0] dark:border-[#1e293b]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-xs font-semibold text-[#1e3a8a] dark:text-[#93c5fd]">
            <Award className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
            <span>&quot;Red-Pen&quot; Handwritten Work Grader • WAEC Rubric Diagnostic</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-[#f8fafc] mt-2">
            Sequential Line-by-Line Equivalence Checker
          </h2>
          <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] mt-1 max-w-2xl leading-[1.6]">
            Every handwritten line is evaluated against SymPy algebraic truth. Stamped with official WAEC Method Marks [M1] and Accuracy Marks [A1].
          </p>
        </div>

        {/* Score Card Box */}
        <div className="flex items-center gap-3">
          <div
            className={`px-5 py-3.5 rounded-[12px] border text-center flex-shrink-0 min-w-[150px] ${
              gradingResult.isFullyCorrect
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-rose-500/10 border-rose-500/30'
            }`}
          >
            <span
              className={`text-[10px] uppercase font-bold block tracking-wider ${
                gradingResult.isFullyCorrect
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              WAEC Score Earned
            </span>
            <div
              className={`text-2xl font-black mt-0.5 ${
                gradingResult.isFullyCorrect
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-rose-700 dark:text-rose-300'
              }`}
            >
              {gradingResult.waecScoreEarned} / {gradingResult.waecScoreTotal}
            </div>
            <span
              className={`text-[10px] font-semibold ${
                gradingResult.isFullyCorrect
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {gradingResult.isFullyCorrect
                ? '100% Mathematically Rigorous'
                : `Error on Line ${gradingResult.firstErrorIndex || '?'}`}
            </span>
          </div>
        </div>
      </div>

      {/* 1-Click Sample Bar for Hackathon Judges */}
      {onSelectSample && (
        <div className="bg-white/80 dark:bg-[#0b1120]/80 border border-[#e2e8f0] dark:border-[#1e293b] rounded-[12px] p-3.5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa]" />
            <span>Judge Demo Samples:</span>
          </span>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSelectSample('flawed_student_notebook_sign_error')}
              className="px-3 py-1.5 rounded-[8px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>Sample A: Flawed Solution (Sign Mistake on Line 2)</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectSample('correct_student_notebook_rigorous')}
              className="px-3 py-1.5 rounded-[8px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Sample B: Perfect Solution (5/5 Marks)</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Visual Notebook Canvas (Left) + Line Breakdown (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Notebook Page with Overlays (7 cols) */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="relative w-full rounded-[14px] overflow-hidden border border-[#cbd5e1] dark:border-[#334155] shadow-lg select-none bg-[#FCFAF2]">
            {/* The Notebook Image / SVG */}
            {gradingResult.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={gradingResult.imageUrl}
                alt="Student Handwritten Notebook Working"
                className="w-full h-auto block object-contain max-h-[640px]"
                draggable={false}
              />
            )}

            {/* Overlaid Bounding Boxes with "Red-Pen" Annotations */}
            {gradingResult.lines.map((line) => {
              const isSelected = selectedLineIndex === line.lineIndex;
              const isError = !line.isMathematicallyValid;

              const top = `${line.boundingBox.yMin * 100}%`;
              const left = `${line.boundingBox.xMin * 100}%`;
              const width = `${(line.boundingBox.xMax - line.boundingBox.xMin) * 100}%`;
              const height = `${(line.boundingBox.yMax - line.boundingBox.yMin) * 100}%`;

              return (
                <div
                  key={line.lineIndex}
                  onClick={() => setSelectedLineIndex(line.lineIndex)}
                  className={`absolute rounded-[8px] cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? isError
                        ? 'border-2 border-rose-500 bg-rose-500/25 shadow-lg shadow-rose-500/30 z-20 scale-[1.01]'
                        : 'border-2 border-emerald-500 bg-emerald-500/25 shadow-lg shadow-emerald-500/30 z-20 scale-[1.01]'
                      : isError
                      ? 'border-2 border-dashed border-rose-500/70 bg-rose-500/15 animate-pulse'
                      : 'border-2 border-dashed border-emerald-500/60 bg-emerald-500/10 hover:border-emerald-500'
                  }`}
                  style={{ top, left, width, height }}
                >
                  {/* Stamped WAEC Mark Badge */}
                  <div
                    className={`absolute -top-3 left-3 px-2 py-0.5 rounded-[6px] text-[10px] font-mono font-black tracking-tight flex items-center gap-1 shadow-md ${
                      isError
                        ? 'bg-rose-600 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {isError ? (
                      <>
                        <XCircle className="w-3 h-3" />
                        <span>M0 Error Lost Here</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{line.waecMark} Earned</span>
                      </>
                    )}
                  </div>

                  {/* Red-Pen Callout on Error Step */}
                  {isError && (
                    <div className="hidden sm:flex absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full z-30 ml-2">
                      <div className="bg-rose-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-[8px] shadow-xl border border-rose-400 whitespace-nowrap flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                        <span>Equivalence Broken on Line {line.lineIndex}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Examiner Diagnostic Panel & Step-by-Step Breakdown (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <span className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider block">
              Line-by-Line Examiner Analysis ({gradingResult.lines.length} Lines)
            </span>

            {/* Step Selection List */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {gradingResult.lines.map((l) => {
                const isSelected = selectedLineIndex === l.lineIndex;
                const isError = !l.isMathematicallyValid;

                return (
                  <button
                    key={l.lineIndex}
                    type="button"
                    onClick={() => setSelectedLineIndex(l.lineIndex)}
                    className={`w-full text-left p-3 rounded-[10px] border transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? isError
                          ? 'bg-rose-500/15 border-rose-500 text-rose-900 dark:text-rose-100 shadow-sm'
                          : 'bg-emerald-500/15 border-emerald-500 text-emerald-900 dark:text-emerald-100 shadow-sm'
                        : 'bg-white dark:bg-[#0b1120] border-[#e2e8f0] dark:border-[#1e293b] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-6 h-6 rounded-[6px] font-mono text-xs font-bold flex items-center justify-center ${
                          isError
                            ? 'bg-rose-600 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        L{l.lineIndex}
                      </span>
                      <span className="text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] line-clamp-1">
                        <MathDisplay value={l.latex || l.rawText} inline />
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-[6px] text-xs font-mono font-bold ${
                          isError
                            ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                            : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {l.waecMark}
                      </span>
                      {isError ? (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Line In-Depth Feedback Card */}
            {selectedLine && (
              <div
                className={`p-4 rounded-[12px] border space-y-2.5 animate-fadeIn ${
                  selectedLine.isMathematicallyValid
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-rose-500/10 border-rose-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      selectedLine.isMathematicallyValid
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {selectedLine.isMathematicallyValid ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Line {selectedLine.lineIndex}: Valid Mathematical Step</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        <span>Line {selectedLine.lineIndex}: Equivalence Error Located</span>
                      </>
                    )}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-[6px] text-xs font-mono font-bold ${
                      selectedLine.isMathematicallyValid
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {selectedLine.waecMark}
                  </span>
                </div>

                <div className="p-2.5 bg-white dark:bg-[#0b1120] rounded-[8px] border border-[#e2e8f0] dark:border-[#1e293b] text-center">
                  <MathDisplay
                    value={selectedLine.latex}
                    displayMode
                    className="text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]"
                  />
                </div>

                <MathDisplay
                  value={
                    selectedLine.feedback ||
                    (selectedLine.isMathematicallyValid
                      ? 'Step is mathematically equivalent to preceding line. Method mark retained.'
                      : 'Step violates mathematical equivalence.')
                  }
                  className="text-xs text-[#0f172a] dark:text-[#f8fafc] leading-[1.6]"
                />
              </div>
            )}
          </div>

          {/* Pedagogical Summary & Practice Twin Trigger */}
          <div className="p-4 bg-white dark:bg-[#0b1120] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] space-y-3">
            <div className="flex items-start gap-2 text-xs text-[#64748b] dark:text-[#94a3b8] leading-[1.6]">
              <Info className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa] flex-shrink-0 mt-0.5" />
              <MathDisplay value={gradingResult.pedagogicalSummary} inline />
            </div>

            {onSolveTwin && (
              <button
                type="button"
                onClick={() => onSolveTwin('2x^2 + 5x - 3 = 0')}
                className="w-full py-2.5 px-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold rounded-[8px] transition flex items-center justify-center gap-2 shadow-sm active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Practice a Fresh Twin Problem on Paper</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RedPenGraderCanvas;
