'use client';

import React, { useState } from 'react';
import MathDisplay from './MathDisplay';
import RedPenGraderCanvas from './RedPenGraderCanvas';
import { VerifyStepsResponse, GradeHandwritingResponse } from '@solvam/shared-types';
import { PedagogicalSolution } from '@/lib/ai/types';
import {
  Award,
  Sparkles,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  RefreshCw,
  HelpCircle,
  Plus,
  Trash2,
  FileText,
  Calculator,
  BookOpen,
  ArrowRight,
} from 'lucide-react';

interface PracticeWorkspaceViewProps {
  originalProblem: string;
  onChangeOriginalProblem: (problem: string) => void;
  studentSteps: string[];
  onChangeStudentSteps: (steps: string[]) => void;
  verifyResult: VerifyStepsResponse | null;
  verifyLoading: boolean;
  onVerifySteps: () => void;
  onResetCorrectSteps: () => void;
  onInjectMistake: () => void;
  handwritingResult: GradeHandwritingResponse;
  handwritingLoading: boolean;
  onLoadHandwritingSample: (sampleId: string) => void;
  latestLearnedSolution: PedagogicalSolution | null;
  onSendToLearn: (equation: string) => void;
}

const PRACTICE_DRILLS = [
  {
    id: 'foundation-monic',
    badge: '🟢 Foundation',
    title: 'Simple Factorisation',
    equation: 'x^2 + 5x + 6 = 0',
    sampleSteps: ['(x + 2)(x + 3) = 0', 'x = -2', 'x = -3'],
    hint: 'Find two numbers that multiply to $+6$ and add up to $+5$. Both numbers must be positive ($+2$ and $+3$).',
  },
  {
    id: 'waec-grouping',
    badge: '🟡 WAEC Paper 2',
    title: 'Non-Monic Grouping',
    equation: '3x^2 - 5x - 2 = 0',
    sampleSteps: [
      '3x^2 - 6x + x - 2 = 0',
      '3x(x - 2) + 1(x - 2) = 0',
      '(3x + 1)(x - 2) = 0',
    ],
    hint: 'Multiply $a \\times c = 3 \\times (-2) = -6$. Find two factors of $-6$ that add up to $-5$: they are $-6$ and $+1$.',
  },
  {
    id: 'waec-quadratic-2',
    badge: '🟡 WAEC Paper 2',
    title: 'Quadratic Roots',
    equation: '2x^2 + 5x - 3 = 0',
    sampleSteps: [
      '2x^2 + 6x - x - 3 = 0',
      '2x(x + 3) - 1(x + 3) = 0',
      '(2x - 1)(x + 3) = 0',
    ],
    hint: 'Multiply $2 \\times (-3) = -6$. Two numbers that multiply to $-6$ and add to $+5$ are $+6$ and $-1$.',
  },
  {
    id: 'distinction-diff-squares',
    badge: '🔴 Distinction',
    title: 'Difference of Two Squares',
    equation: 'x^2 - 16 = 0',
    sampleSteps: ['(x - 4)(x + 4) = 0', 'x = 4', 'x = -4'],
    hint: 'Rewrite $x^2 - 16 = 0$ as $x^2 - 4^2 = 0$ and apply $a^2 - b^2 = (a - b)(a + b)$.',
  },
];

export const PracticeWorkspaceView: React.FC<PracticeWorkspaceViewProps> = ({
  originalProblem,
  onChangeOriginalProblem,
  studentSteps,
  onChangeStudentSteps,
  verifyResult,
  verifyLoading,
  onVerifySteps,
  onResetCorrectSteps,
  onInjectMistake,
  handwritingResult,
  handwritingLoading,
  onLoadHandwritingSample,
  latestLearnedSolution,
  onSendToLearn,
}) => {
  const [practiceMode, setPracticeMode] = useState<'step-workbook' | 'notebook-grader'>('step-workbook');
  const [showHint, setShowHint] = useState<boolean>(false);
  const [generatingTwin, setGeneratingTwin] = useState<boolean>(false);
  const [twinNotice, setTwinNotice] = useState<string | null>(null);

  const activeDrill = PRACTICE_DRILLS.find((d) => d.equation === originalProblem);
  const currentHint =
    activeDrill?.hint ||
    'Isolate or factor the terms step by step. Ensure every line remains algebraically equivalent to the original equation so SymPy awards your [M1] Method Mark.';

  const handleGenerateFreshTwin = async () => {
    setGeneratingTwin(true);
    setTwinNotice(null);
    try {
      const res = await fetch('/api/generate-twin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equation: originalProblem || '3x^2 - 5x - 2 = 0',
          topic: latestLearnedSolution?.topic || 'Quadratic Equations',
        }),
      });
      const data = await res.json();
      if (data.twin_equation_latex) {
        const cleanTwin = data.twin_equation_latex.replace(/\$/g, '').trim();
        onChangeOriginalProblem(cleanTwin);
        onChangeStudentSteps(['', '', '']);
        setTwinNotice(`Generated fresh SymPy-verified twin problem: $${cleanTwin}$`);
      }
    } catch (err) {
      console.error('Failed to generate twin practice problem:', err);
    } finally {
      setGeneratingTwin(false);
    }
  };

  const handleAddStepLine = () => {
    if (studentSteps.length >= 8) return;
    onChangeStudentSteps([...studentSteps, '']);
  };

  const handleRemoveStepLine = (idx: number) => {
    if (studentSteps.length <= 1) return;
    onChangeStudentSteps(studentSteps.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Practice Banner: Connects directly to what the user learned in "Learn" */}
      <section className="bg-gradient-to-b from-[#f8fafc] to-[#f0f7ff] dark:from-[#131c2e] dark:to-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[12px] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#e2e8f0] dark:border-[#1e293b]">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-xs font-semibold text-[#1e3a8a] dark:text-[#93c5fd]">
              <Award className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
              <span>Active Recall &amp; WAEC Rubric Drills</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-[#f8fafc] mt-2">
              Practice &amp; Master What You Learned
            </h2>
            <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] mt-1 max-w-2xl leading-[1.6]">
              Solve practice questions line-by-line or check your handwritten notebook. Our SymPy engine verifies each step and awards official WAEC <strong>[M1] Method</strong> and <strong>[A1] Accuracy</strong> marks.
            </p>
          </div>

          {/* Mode Switcher: Step-by-Step Workbook vs Handwritten Notebook Grader */}
          <div className="flex items-center p-1 bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[10px] self-start lg:self-center">
            <button
              type="button"
              onClick={() => setPracticeMode('step-workbook')}
              className={`px-3.5 py-2 rounded-[8px] text-xs font-semibold transition flex items-center gap-1.5 ${
                practiceMode === 'step-workbook'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Step-by-Step Workbook</span>
            </button>
            <button
              type="button"
              onClick={() => setPracticeMode('notebook-grader')}
              className={`px-3.5 py-2 rounded-[8px] text-xs font-semibold transition flex items-center gap-1.5 ${
                practiceMode === 'notebook-grader'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Handwritten Notebook Grader</span>
            </button>
          </div>
        </div>

        {/* Recommended Twin Problem from "Learn" Page (if available) */}
        {latestLearnedSolution?.twinPracticeProblem && (
          <div className="p-4 rounded-[12px] bg-[#dbeafe]/60 dark:bg-[#1e3a8a]/30 border border-[#bfdbfe] dark:border-[#1e3a8a] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold text-[#1e3a8a] dark:text-[#93c5fd] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
                <span>Recommended from Your Recent &ldquo;Learn&rdquo; Session ({latestLearnedSolution.topic}):</span>
              </div>
              <div className="text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]">
                <MathDisplay value={latestLearnedSolution.twinPracticeProblem.twin_equation_latex} inline />
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const cleanEq = latestLearnedSolution.twinPracticeProblem!.twin_equation_latex
                  .replace(/\$/g, '')
                  .trim();
                onChangeOriginalProblem(cleanEq);
                onChangeStudentSteps(['', '', '']);
                setPracticeMode('step-workbook');
              }}
              className="px-4 py-2 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold transition flex items-center gap-1.5 self-start sm:self-center shadow-sm"
            >
              <span>Load Twin Problem</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Curated Practice Drills Selector */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
              Select a Practice Drill or Generate a New Twin Question:
            </span>
            <button
              type="button"
              onClick={handleGenerateFreshTwin}
              disabled={generatingTwin}
              className="px-3 py-1.5 rounded-[8px] bg-white dark:bg-[#0f172a] hover:bg-[#dbeafe] dark:hover:bg-[#1e3a8a]/50 text-[#1e3a8a] dark:text-[#93c5fd] border border-[#e2e8f0] dark:border-[#1e293b] text-xs font-semibold transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generatingTwin ? 'animate-spin' : ''}`} />
              <span>Generate Fresh Twin Question</span>
            </button>
          </div>

          {twinNotice && (
            <div className="p-2.5 rounded-[8px] bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300">
              <MathDisplay value={twinNotice} inline />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PRACTICE_DRILLS.map((drill) => {
              const isSelected = originalProblem === drill.equation;
              return (
                <button
                  key={drill.id}
                  type="button"
                  onClick={() => {
                    onChangeOriginalProblem(drill.equation);
                    onChangeStudentSteps(drill.sampleSteps);
                    setShowHint(false);
                    setPracticeMode('step-workbook');
                  }}
                  className={`p-3.5 rounded-[10px] border text-left transition flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#e0f0fe] dark:bg-[#1e293b] border-[#2563eb] shadow-sm'
                      : 'bg-white dark:bg-[#0f172a] hover:bg-[#f8fafc] dark:hover:bg-[#1e293b]/50 border-[#e2e8f0] dark:border-[#1e293b]'
                  }`}
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1e3a8a] dark:text-[#93c5fd] block">
                      {drill.badge}
                    </span>
                    <span className="text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] mt-0.5 block">
                      {drill.title}
                    </span>
                  </div>
                  <div className="pt-1 border-t border-[#e2e8f0]/70 dark:border-[#1e293b]">
                    <MathDisplay
                      value={drill.equation}
                      className="text-xs font-semibold text-[#2563eb] dark:text-[#60a5fa]"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* PRACTICE MODE 1: INTERACTIVE STEP-BY-STEP WORKBOOK */}
      {practiceMode === 'step-workbook' ? (
        <section className="bg-gradient-to-b from-[#f8fafc] to-[#f0f7ff] dark:from-[#131c2e] dark:to-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[12px] p-6 sm:p-8 space-y-6">
          {/* Active Problem Card */}
          <div className="p-5 bg-white dark:bg-[#0f172a] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <label className="block text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                Active Practice Question (Editable):
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  type="text"
                  value={originalProblem}
                  onChange={(e) => onChangeOriginalProblem(e.target.value)}
                  placeholder="e.g. 3x^2 - 5x - 2 = 0"
                  className="w-full sm:w-80 bg-[#f8fafc] dark:bg-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[8px] px-4 py-2.5 text-sm font-mono text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
                />
                <div className="px-4 py-2 bg-[#f8fafc] dark:bg-[#0b1120] rounded-[8px] border border-[#e2e8f0] dark:border-[#1e293b]">
                  <MathDisplay
                    value={originalProblem}
                    className="text-base font-bold text-[#0f172a] dark:text-[#f8fafc]"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHint((prev) => !prev)}
                className="px-3.5 py-2 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 rounded-[8px] transition flex items-center gap-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{showHint ? 'Hide Hint' : 'Need a Hint?'}</span>
              </button>

              <button
                type="button"
                onClick={() => onSendToLearn(originalProblem)}
                className="px-3.5 py-2 text-xs font-semibold bg-[#dbeafe] dark:bg-[#1e3a8a]/40 hover:bg-[#bfdbfe] dark:hover:bg-[#1e3a8a]/60 text-[#1e3a8a] dark:text-[#93c5fd] rounded-[8px] transition flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Teach Me This in Learn</span>
              </button>
            </div>
          </div>

          {/* Socratic Hint Banner */}
          {showHint && (
            <div className="p-4 rounded-[10px] bg-amber-500/10 border border-amber-500/30 text-xs text-[#0f172a] dark:text-[#f8fafc] flex items-start gap-2.5 animate-fadeIn">
              <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-amber-800 dark:text-amber-300">
                  Professor SolvAm Hint:
                </strong>{' '}
                <MathDisplay value={currentHint} inline />
              </div>
            </div>
          )}

          {/* Student Step-by-Step Working Input */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                Your Sequential Working Steps (SymPy checks each line for algebraic equivalence):
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onResetCorrectSteps}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#dbeafe] dark:bg-[#1e3a8a]/40 hover:bg-[#bfdbfe] dark:hover:bg-[#1e3a8a]/60 text-[#1e3a8a] dark:text-[#93c5fd] rounded-[8px] transition"
                >
                  Load Correct Example
                </button>
                <button
                  type="button"
                  onClick={onInjectMistake}
                  className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#0f172a] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-[#e2e8f0] dark:border-[#1e293b] rounded-[8px] transition"
                >
                  Simulate Sign Mistake (Line 2)
                </button>
              </div>
            </div>

            {studentSteps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-[#1e3a8a] dark:text-[#93c5fd] font-mono text-xs flex items-center justify-center font-semibold flex-shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <input
                  type="text"
                  value={step}
                  placeholder={`Enter working step ${idx + 1} (e.g. (x + 2)(x + 3) = 0)`}
                  onChange={(e) => {
                    const updated = [...studentSteps];
                    updated[idx] = e.target.value;
                    onChangeStudentSteps(updated);
                  }}
                  className="flex-1 bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[8px] px-4 py-2.5 text-sm font-mono text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
                />
                <div className="w-52 hidden sm:block p-2.5 bg-white dark:bg-[#0f172a] rounded-[8px] text-xs text-[#0f172a] dark:text-[#f8fafc] text-center border border-[#e2e8f0] dark:border-[#1e293b]">
                  <MathDisplay value={step || '\\text{...}'} />
                </div>
                {studentSteps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveStepLine(idx)}
                    className="p-2 rounded-[8px] text-[#64748b] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                    title="Remove step line"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddStepLine}
              className="px-3.5 py-2 rounded-[8px] bg-white dark:bg-[#0f172a] hover:bg-[#f0f5fa] dark:hover:bg-[#1e293b] text-[#2563eb] dark:text-[#60a5fa] border border-dashed border-[#cbd5e1] dark:border-[#334155] text-xs font-semibold transition inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Step Line</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onVerifySteps}
            disabled={verifyLoading}
            className="w-full py-3 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-xs sm:text-sm rounded-[8px] transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {verifyLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Grade My Working (WAEC M1/A1 Step Verifier)</span>
              </>
            )}
          </button>

          {/* Verification Scorecard Output */}
          {verifyResult && (
            <div className="p-6 bg-white dark:bg-[#0f172a] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                <div>
                  <div className="text-sm font-bold flex items-center gap-2">
                    {verifyResult.is_fully_correct ? (
                      <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        100% Mathematically Rigorous Working!
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                        <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        Step-Level Equivalence Break Detected
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1 leading-[1.6]">
                    <MathDisplay value={verifyResult.pedagogical_summary} inline />
                  </div>
                </div>

                <div className="px-5 py-2.5 bg-[#f8fafc] dark:bg-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[12px] text-center">
                  <div className="text-[10px] text-[#64748b] dark:text-[#94a3b8] font-semibold uppercase tracking-wider">
                    WAEC Marks Earned
                  </div>
                  <div className="text-2xl font-bold text-[#1e3a8a] dark:text-[#93c5fd] font-mono">
                    {verifyResult.waec_score_earned} / {verifyResult.waec_score_total}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b]">
                {verifyResult.step_analyses.map((sa) => (
                  <div
                    key={sa.step_index}
                    className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-xs font-mono font-semibold text-[#1e3a8a] dark:text-[#93c5fd]">
                        Line {sa.step_index}
                      </span>
                      <span className="text-sm text-[#0f172a] dark:text-[#f8fafc] font-semibold">
                        <MathDisplay value={sa.raw_text} inline />
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-[1.6]">
                        <MathDisplay value={sa.feedback || ''} inline />
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-[8px] text-xs font-semibold font-mono ${
                          sa.waec_mark === 'M1' || sa.waec_mark === 'A1'
                            ? 'bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-[#1e3a8a] dark:text-[#93c5fd]'
                            : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {sa.waec_mark}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        /* PRACTICE MODE 2: HANDWRITTEN NOTEBOOK GRADER */
        <RedPenGraderCanvas
          gradingResult={handwritingResult}
          onSelectSample={onLoadHandwritingSample}
          onSolveTwin={(twinEq) => {
            onChangeOriginalProblem(twinEq);
            setPracticeMode('step-workbook');
          }}
          isLoading={handwritingLoading}
        />
      )}
    </div>
  );
};

export default PracticeWorkspaceView;
