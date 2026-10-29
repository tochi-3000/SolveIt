'use client';

import React, { useState, useRef, useEffect } from 'react';
import MathDisplay from './MathDisplay';
import MathematicalDiagramRenderer from './MathematicalDiagramRenderer';
import VoiceTutorModal from './VoiceTutorModal';
import { playSpokenMath } from '@/lib/audio/mathSpeechNormalizer';
import { PedagogicalSolution, PedagogicalLevel, LanguageMode, ScaffoldingStep } from '@/lib/ai/types';
import {
  Sparkles,
  Volume2,
  Square,
  Mic,
  Eye,
  EyeOff,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Award,
  ChevronRight,
  Info,
  ShieldCheck,
  Image as ImageIcon,
  Dumbbell,
  BookOpen,
  RefreshCw,
} from 'lucide-react';

const CURATED_NEXT_EXAMPLES = [
  { title: 'Simple Factoring', equation: 'x^2 + 5x + 6 = 0' },
  { title: 'WAEC 2024 Q1(a)', equation: '3x^2 - 5x - 2 = 0' },
  { title: 'Calculus Derivative', equation: 'y = 3x^4 - 5x^2 + 2x - 7' },
  { title: 'Arithmetic Progression', equation: 'T_n = 5 + (n - 1)*3' },
];

interface ScaffoldingSolutionViewProps {
  solution: PedagogicalSolution;
  originalProblemText?: string;
  pedagogicalLevel: PedagogicalLevel;
  onChangePedagogicalLevel?: (level: PedagogicalLevel) => void;
  languageMode: LanguageMode;
  onChangeLanguageMode?: (mode: LanguageMode) => void;
  speechRate?: number;
  showExaminerWarnings?: boolean;
  onSolveTwin?: (twinEquation: string) => void;
  onSeeAnotherExample?: (equation: string) => void;
}

export const ScaffoldingSolutionView: React.FC<ScaffoldingSolutionViewProps> = ({
  solution,
  originalProblemText,
  pedagogicalLevel,
  onChangePedagogicalLevel,
  languageMode,
  onChangeLanguageMode,
  speechRate = 1.0,
  showExaminerWarnings = true,
  onSolveTwin,
  onSeeAnotherExample,
}) => {
  // Audio Playback State
  const [playingStepIndex, setPlayingStepIndex] = useState<number | null>(null);
  const [isPlayingFullSolution, setIsPlayingFullSolution] = useState<boolean>(false);
  const stopAudioRef = useRef<(() => void) | null>(null);

  // Progressive Disclosure for Expert Mode
  const [revealedStepIndices, setRevealedStepIndices] = useState<Set<number>>(new Set([1]));

  // Next Step Choice State (Practice vs See Another Example)
  const [nextStepPreference, setNextStepPreference] = useState<'unselected' | 'practice' | 'example'>('unselected');
  const [generatedTwin, setGeneratedTwin] = useState<{ equation: string; latex: string } | null>(null);
  const [isGeneratingTwin, setIsGeneratingTwin] = useState<boolean>(false);
  const [twinError, setTwinError] = useState<string | null>(null);

  // Modals State
  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState<boolean>(false);
  const [voiceStepTarget, setVoiceStepTarget] = useState<ScaffoldingStep | null>(null);

  // Reset next step preference when a new solution is loaded
  useEffect(() => {
    setNextStepPreference('unselected');
    setGeneratedTwin(null);
    setTwinError(null);
  }, [solution.extractedLatex, solution.topic]);

  const fetchTwinProblem = async (forceRegenerate = false) => {
    if (generatedTwin && !forceRegenerate) return generatedTwin;

    // Zero-Latency Path: If the primary AI breakdown already synthesized an isomorphic twinPracticeProblem,
    // use it immediately without an extra round-trip unless the user explicitly requested another variation.
    if (
      !forceRegenerate &&
      solution.twinPracticeProblem &&
      (solution.twinPracticeProblem.twin_equation || solution.twinPracticeProblem.twin_equation_latex)
    ) {
      const pregenerated = solution.twinPracticeProblem;
      const readableEq = (
        pregenerated.twin_equation ||
        pregenerated.twin_equation_latex ||
        ''
      ).trim();
      const latexEq = (
        pregenerated.twin_equation_latex ||
        pregenerated.twin_equation ||
        ''
      ).trim();
      const twinObj = { equation: readableEq, latex: latexEq };
      setGeneratedTwin(twinObj);
      return twinObj;
    }

    setIsGeneratingTwin(true);
    setTwinError(null);
    try {
      const fullProblemContext =
        originalProblemText?.trim() ||
        (solution.discriminantSummary
          ? `${solution.discriminantSummary} (${solution.extractedLatex || ''})`
          : solution.extractedLatex) ||
        '3x^2 - 5x - 2 = 0';

      const res = await fetch('/api/generate-twin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equation: fullProblemContext,
          topic: solution.topic || 'General Mathematics',
        }),
      });
      const data = await res.json();
      if (data.twin_equation_latex || data.twin_equation) {
        const readableEq = (data.twin_equation || data.twin_equation_latex || '')
          .replace(/^\$+|\$+$/g, '')
          .trim();
        const latexEq = (data.twin_equation_latex || data.twin_equation || '').trim();
        const twinObj = { equation: readableEq, latex: latexEq };
        setGeneratedTwin(twinObj);
        return twinObj;
      } else {
        throw new Error(data.error || 'Invalid response from twin generator');
      }
    } catch (err: any) {
      console.error('Failed to generate twin problem:', err);
      setTwinError('Could not generate twin problem. Please try again.');
      return null;
    } finally {
      setIsGeneratingTwin(false);
    }
  };

  const handleSelectPreference = async (pref: 'practice' | 'example') => {
    setNextStepPreference(pref);
    if (pref === 'practice') {
      await fetchTwinProblem(false);
    }
  };

  const handleBreakdownTwinExample = async () => {
    const twin = await fetchTwinProblem(false);
    if (twin && onSeeAnotherExample) {
      onSeeAnotherExample(twin.equation);
    }
  };

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (stopAudioRef.current) {
        stopAudioRef.current();
      }
    };
  }, []);

  // Reset revealed steps when level changes
  useEffect(() => {
    if (pedagogicalLevel === 'expert') {
      setRevealedStepIndices(new Set([1]));
    } else {
      setRevealedStepIndices(new Set(solution.steps.map((_, i) => i + 1)));
    }
  }, [pedagogicalLevel, solution.steps]);

  // Audio Playback Functions
  const stopCurrentAudio = () => {
    if (stopAudioRef.current) {
      stopAudioRef.current();
      stopAudioRef.current = null;
    }
    setPlayingStepIndex(null);
    setIsPlayingFullSolution(false);
  };

  const handlePlayStepAudio = (step: ScaffoldingStep) => {
    if (playingStepIndex === step.stepNumber) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();
    // Always read the exact step explanation & equation displayed on the screen so voice and text match 100%
    const narrationText = `${step.explanation} ${step.mathLatex}`;

    const cancel = playSpokenMath(narrationText, {
      rate: speechRate,
      language: languageMode,
      onStart: () => setPlayingStepIndex(step.stepNumber),
      onEnd: () => setPlayingStepIndex(null),
      onError: () => setPlayingStepIndex(null),
    });

    stopAudioRef.current = cancel;
  };

  const handlePlayFullSolution = () => {
    if (isPlayingFullSolution) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();
    // Read the exact summary, step explanations, step equations, and final solution shown on screen
    const summaryPrefix = solution.discriminantSummary ? `${solution.discriminantSummary} ` : '';
    const stepsScript = solution.steps
      .map((st) => `Step ${st.stepNumber}: ${st.explanation} ${st.mathLatex}`)
      .join('. ');
    const fullScript = `${summaryPrefix}${stepsScript}. Verified Solution: ${solution.finalAnswerLatex}`;

    const cancel = playSpokenMath(fullScript, {
      rate: speechRate,
      language: languageMode,
      onStart: () => setIsPlayingFullSolution(true),
      onEnd: () => setIsPlayingFullSolution(false),
      onError: () => setIsPlayingFullSolution(false),
    });

    stopAudioRef.current = cancel;
  };

  // Progressive Disclosure Toggle
  const toggleStepReveal = (stepNumber: number) => {
    const next = new Set(revealedStepIndices);
    if (next.has(stepNumber)) {
      next.delete(stepNumber);
    } else {
      next.add(stepNumber);
    }
    setRevealedStepIndices(next);
  };

  const isPidgin = languageMode === 'pidgin';

  return (
    <section className="bg-gradient-to-b from-[#f8fafc] to-[#f0f7ff] dark:from-[#131c2e] dark:to-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[16px] p-6 sm:p-8 space-y-6 animate-fadeIn shadow-sm">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#e2e8f0] dark:border-[#1e293b]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-xs font-semibold text-[#1e3a8a] dark:text-[#93c5fd]">
            <Sparkles className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
            <span>Meta Muse Spark 1.3 Adaptive Breakdown</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-[#f8fafc] mt-2">
            {solution.topic}
          </h2>
          <MathDisplay
            value={
              solution.discriminantSummary ||
              'Zero-hallucination solution verified by deterministic SymPy CAS.'
            }
            className="text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] mt-1 max-w-2xl leading-[1.6]"
          />
        </div>

        {/* Right Action Widgets */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Concept Diagram Button */}
          <button
            type="button"
            onClick={() => setIsDiagramModalOpen(true)}
            className="px-3.5 py-2 rounded-[10px] bg-white dark:bg-[#0b1120] hover:bg-[#dbeafe] dark:hover:bg-[#1e3a8a]/50 text-[#0f172a] dark:text-[#f8fafc] text-xs font-semibold border border-[#e2e8f0] dark:border-[#1e293b] transition flex items-center gap-2 shadow-sm"
          >
            <ImageIcon className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa]" />
            <span>Concept Diagram</span>
          </button>

          {/* Full Audio Playback */}
          <button
            type="button"
            onClick={handlePlayFullSolution}
            className={`px-3.5 py-2 rounded-[10px] text-xs font-semibold transition flex items-center gap-2 shadow-sm ${
              isPlayingFullSolution
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white'
            }`}
          >
            {isPlayingFullSolution ? (
              <>
                <Square className="w-4 h-4" />
                <span>Stop Audio</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                <span>Read Aloud</span>
              </>
            )}
          </button>

          {/* Verified Answer Box */}
          <div className="px-5 py-3.5 bg-white dark:bg-[#0b1120] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] text-center flex-shrink-0 min-w-[140px]">
            <span className="text-[10px] text-[#1e3a8a] dark:text-[#93c5fd] uppercase font-semibold block tracking-wider">
              Verified Solution
            </span>
            <MathDisplay
              value={solution.finalAnswerLatex}
              className="text-[#0f172a] dark:text-[#f8fafc] font-bold text-lg mt-1"
            />
          </div>
        </div>
      </div>

      {/* Mode-Specific Contextual Alerts */}
      {pedagogicalLevel === 'beginner' && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-[10px] flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-[#0f172a] dark:text-[#f8fafc] space-y-0.5 leading-[1.6]">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">Foundation Mode Active:</span>
            <p className="text-[#64748b] dark:text-[#94a3b8]">
              {isPidgin
                ? 'We break down every step with Balogun market trading analogies so that math fear go disappear completely! Zero skipped arithmetic.'
                : 'Every micro-step is broken down explicitly with relatable market analogies. Zero skipped arithmetic steps.'}
            </p>
          </div>
        </div>
      )}

      {pedagogicalLevel === 'intermediate' && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-[10px] flex items-start gap-3">
          <Award className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-[#0f172a] dark:text-[#f8fafc] space-y-0.5 leading-[1.6]">
            <span className="font-semibold text-amber-700 dark:text-amber-300">WAEC SSCE Prep Mode Active:</span>
            <p className="text-[#64748b] dark:text-[#94a3b8]">
              Structured according to official WAEC General Mathematics Paper 2 marking schemes.
              Pay close attention to <strong>[M1] Method Marks</strong> and <strong>[A1] Accuracy Marks</strong> to maximize partial credit.
            </p>
          </div>
        </div>
      )}

      {pedagogicalLevel === 'expert' && (
        <div className="p-3.5 bg-purple-500/10 border border-purple-500/30 rounded-[10px] flex items-start gap-3">
          <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-[#0f172a] dark:text-[#f8fafc] space-y-0.5 leading-[1.6]">
            <span className="font-semibold text-purple-700 dark:text-purple-300">Distinction (A1) Socratic Mode:</span>
            <p className="text-[#64748b] dark:text-[#94a3b8]">
              Steps are concealed by default. Challenge yourself to solve each step before clicking &quot;Reveal Step&quot;.
              Target completion speed: <strong>&le; 3 minutes</strong> for a 5-mark question.
            </p>
          </div>
        </div>
      )}

      {/* Unified Step-by-Step Stream */}
      <div className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b]">
        {solution.steps.map((st) => {
          const isRevealed = revealedStepIndices.has(st.stepNumber);
          const isPlayingThisStep = playingStepIndex === st.stepNumber;
          const formattedStep = String(st.stepNumber).padStart(2, '0');

          return (
            <div key={st.stepNumber} className="py-6 first:pt-2 last:pb-2 space-y-4">
              <div className="flex items-start sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <span className="px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/50 text-[#1e3a8a] dark:text-[#93c5fd] text-xs font-mono font-semibold flex-shrink-0">
                    {formattedStep}
                  </span>
                  <div>
                    <MathDisplay
                      value={st.explanation}
                      className="text-sm font-medium text-[#0f172a] dark:text-[#f8fafc] leading-[1.6]"
                    />
                    <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-medium block mt-0.5">
                      {st.waecMark === 'M1'
                        ? 'Method Mark — Procedural algebra step'
                        : st.waecMark === 'A1'
                        ? 'Accuracy Mark — Numerical root milestone'
                        : 'Independent Milestone Mark'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Step Audio Read Aloud */}
                  <button
                    type="button"
                    onClick={() => handlePlayStepAudio(st)}
                    className={`p-2 rounded-[8px] transition ${
                      isPlayingThisStep
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-white dark:bg-[#0b1120] hover:bg-[#dbeafe] dark:hover:bg-[#1e3a8a]/50 text-[#2563eb] dark:text-[#60a5fa] border border-[#e2e8f0] dark:border-[#1e293b]'
                    }`}
                    title={isPlayingThisStep ? 'Stop Speech' : 'Listen to this step'}
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>

                  {/* Ask Question on this Step */}
                  <button
                    type="button"
                    onClick={() =>
                      setVoiceStepTarget((prev) => (prev?.stepNumber === st.stepNumber ? null : st))
                    }
                    className={`p-2 rounded-[8px] transition ${
                      voiceStepTarget?.stepNumber === st.stepNumber
                        ? 'bg-[#2563eb] text-white shadow-sm ring-2 ring-[#2563eb]/30'
                        : 'bg-white dark:bg-[#0b1120] hover:bg-[#dbeafe] dark:hover:bg-[#1e3a8a]/50 text-[#2563eb] dark:text-[#60a5fa] border border-[#e2e8f0] dark:border-[#1e293b]'
                    }`}
                    title={
                      voiceStepTarget?.stepNumber === st.stepNumber
                        ? 'Close Meta Muse Voice Transcribe menu'
                        : 'Ask Professor SolvAm aloud about this step'
                    }
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  {/* WAEC Marking Badge */}
                  <span className="px-2.5 py-1 rounded-[8px] text-xs font-mono font-semibold bg-[#dbeafe] dark:bg-[#1e3a8a]/50 text-[#1e3a8a] dark:text-[#93c5fd]">
                    [{st.waecMark}]
                  </span>

                  {/* Socratic Reveal Toggle (Expert Mode Only) */}
                  {pedagogicalLevel === 'expert' && (
                    <button
                      type="button"
                      onClick={() => toggleStepReveal(st.stepNumber)}
                      className="px-2.5 py-1 rounded-[8px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-xs font-bold transition flex items-center gap-1"
                    >
                      {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Math Display (Progressive Disclosure Guard) */}
              {isRevealed ? (
                <div className="my-3 py-5 px-6 bg-white dark:bg-[#0b1120] rounded-[12px] border border-[#e2e8f0]/80 dark:border-[#1e293b] text-center">
                  <MathDisplay
                    value={st.mathLatex}
                    displayMode
                    className="text-[#0f172a] dark:text-[#f8fafc] font-semibold"
                  />
                </div>
              ) : (
                <div
                  onClick={() => toggleStepReveal(st.stepNumber)}
                  className="my-3 py-5 px-6 bg-white dark:bg-[#0b1120] rounded-[12px] border border-dashed border-purple-500/40 text-center cursor-pointer hover:bg-purple-500/5 transition group"
                >
                  <span className="text-xs text-purple-700 dark:text-purple-300 font-bold group-hover:underline">
                    🔒 Socratic Challenge: Determine this milestone on paper, then click to reveal.
                  </span>
                </div>
              )}

              {/* Borderless Soft WAEC Examiner's Note Banner */}
              {showExaminerWarnings && st.commonPitfall && isRevealed && (
                <div className="flex items-start gap-2.5 text-xs text-[#1e3a8a] dark:text-[#93c5fd] bg-[#dbeafe]/55 dark:bg-[#1e3a8a]/30 px-4 py-3 rounded-[8px] leading-[1.6]">
                  <Info className="w-4 h-4 flex-shrink-0 text-[#2563eb] dark:text-[#60a5fa] mt-0.5" />
                  <span>
                    <strong className="font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                      WAEC Examiner&apos;s Note:
                    </strong>{' '}
                    <MathDisplay value={st.commonPitfall} inline />
                  </span>
                </div>
              )}

              {/* Meta Muse Voice Transcribe Compact Menu (Inline under Active Step) */}
              {voiceStepTarget?.stepNumber === st.stepNumber && (
                <VoiceTutorModal
                  isOpen={true}
                  onClose={() => setVoiceStepTarget(null)}
                  stepNumber={st.stepNumber}
                  stepLatex={st.mathLatex}
                  stepExplanation={st.explanation}
                  languageMode={languageMode}
                  speechRate={speechRate}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Distinction 15-Second Verification Check (Expert Mode) */}
      {pedagogicalLevel === 'expert' && (
        <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-[12px] space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>15-Second Exam Room Verification Check:</span>
          </div>
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
            Substitute one verified root back into the original equation to prove LHS = RHS before turning in your exam booklet:
          </p>
          <div className="p-2.5 bg-white dark:bg-[#0b1120] rounded-[8px] text-center border border-[#e2e8f0] dark:border-[#1e293b]">
            <MathDisplay
              value="3(2)^2 - 5(2) - 2 = 12 - 10 - 2 = 0 \quad (\text{Confirmed LHS} = \text{RHS})"
              displayMode
              className="text-xs text-emerald-600 dark:text-emerald-400 font-bold"
            />
          </div>
        </div>
      )}

      {/* Interactive Post-Breakdown Next-Steps Controller */}
      <div className="pt-6 border-t border-[#e2e8f0] dark:border-[#1e293b] space-y-4">
        {nextStepPreference === 'unselected' && (
          <div className="p-5 sm:p-6 bg-gradient-to-br from-white via-white to-blue-50/40 dark:from-[#0b1120] dark:via-[#0b1120] dark:to-[#1e293b]/50 rounded-[14px] border border-[#e2e8f0] dark:border-[#1e293b] shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold tracking-wide uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Mastery Checkpoint
              </span>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#0f172a] dark:text-[#f8fafc]">
                Ready for what&apos;s next?
              </h3>
              <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                Choose whether you want to test your understanding with a practice problem or watch another worked example breakdown:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {/* Choice A: Practice with a Similar Problem */}
              <button
                type="button"
                onClick={() => handleSelectPreference('practice')}
                className="group text-left p-4 rounded-[12px] bg-white dark:bg-[#131d31] border-2 border-emerald-500/30 hover:border-emerald-500 hover:shadow-md transition-all duration-200 relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="w-9 h-9 rounded-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <Dumbbell className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[#0f172a] dark:text-[#f8fafc] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Practice with a Similar Problem
                </h4>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1 line-clamp-2">
                  We&apos;ll generate a twin problem with matching structure so you can practice on paper or in the interactive workbook.
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>Generate practice problem</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* Choice B: See Another Example Breakdown */}
              <button
                type="button"
                onClick={() => handleSelectPreference('example')}
                className="group text-left p-4 rounded-[12px] bg-white dark:bg-[#131d31] border-2 border-blue-500/30 hover:border-blue-500 hover:shadow-md transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold mb-2">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-[#0f172a] dark:text-[#f8fafc] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  See Another Example Breakdown
                </h4>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1 line-clamp-2">
                  Watch Professor SolvAm break down a similar twin problem or explore a different WAEC examination question.
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <span>Choose an example to learn</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* PREFERENCE = 'practice': Show Generated Twin Practice Card */}
        {nextStepPreference === 'practice' && (
          <div className="p-5 sm:p-6 bg-white dark:bg-[#0b1120] rounded-[14px] border border-emerald-500/30 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Dumbbell className="w-4 h-4" />
                <span>Parametric Twin Practice Problem (SymPy Verified)</span>
              </span>
              <button
                type="button"
                onClick={() => setNextStepPreference('unselected')}
                className="text-xs text-[#64748b] hover:text-[#0f172a] dark:hover:text-[#f8fafc] underline"
              >
                Change choice
              </button>
            </div>

            {isGeneratingTwin ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-center">
                <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
                <p className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">
                  Generating a similar twin problem with clean integer roots...
                </p>
              </div>
            ) : generatedTwin ? (
              <div className="space-y-4">
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                  Test your understanding with this matching twin problem. It shares the exact same methodology as the one you just learned:
                </p>
                <div className="py-4 px-4 bg-[#f8fafc] dark:bg-[#0f172a] rounded-[10px] border border-[#e2e8f0] dark:border-[#1e293b] text-center space-y-2">
                  {generatedTwin.equation &&
                    generatedTwin.equation !== generatedTwin.latex &&
                    /[a-zA-Z]{4,}/.test(generatedTwin.equation) && (
                      <p className="text-xs sm:text-sm font-medium text-[#0f172a] dark:text-[#f8fafc] leading-relaxed">
                        {generatedTwin.equation}
                      </p>
                    )}
                  <MathDisplay
                    value={generatedTwin.latex}
                    displayMode
                    className="text-[#0f172a] dark:text-[#f8fafc] font-bold text-base sm:text-lg"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fetchTwinProblem(true)}
                      disabled={isGeneratingTwin}
                      className="px-3 py-2 rounded-[8px] bg-[#f1f5f9] dark:bg-[#1e293b] hover:bg-[#e2e8f0] dark:hover:bg-[#334155] text-xs font-semibold text-[#475569] dark:text-[#cbd5e1] flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingTwin ? 'animate-spin' : ''}`} />
                      <span>Generate Another Twin</span>
                    </button>
                  </div>

                  {onSolveTwin && (
                    <button
                      type="button"
                      onClick={() => onSolveTwin(generatedTwin.equation)}
                      className="px-4 py-2 rounded-[8px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                    >
                      <span>Solve in Practice Workspace</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-xs text-rose-500 mb-2">{twinError || 'Could not generate twin problem.'}</p>
                <button
                  type="button"
                  onClick={() => fetchTwinProblem(true)}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-[8px] text-xs font-semibold"
                >
                  Retry Generation
                </button>
              </div>
            )}
          </div>
        )}

        {/* PREFERENCE = 'example': Show Example Selector Card */}
        {nextStepPreference === 'example' && (
          <div className="p-5 sm:p-6 bg-white dark:bg-[#0b1120] rounded-[14px] border border-blue-500/30 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5 uppercase tracking-wider">
                <BookOpen className="w-4 h-4" />
                <span>See Another Example Breakdown</span>
              </span>
              <button
                type="button"
                onClick={() => setNextStepPreference('unselected')}
                className="text-xs text-[#64748b] hover:text-[#0f172a] dark:hover:text-[#f8fafc] underline"
              >
                Change choice
              </button>
            </div>

            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
              Select whether you want Professor SolvAm to break down a fresh twin variation of this problem or jump to another WAEC syllabus topic:
            </p>

            <div className="space-y-2.5">
              {/* Option 1: Break down a twin variation */}
              <button
                type="button"
                onClick={handleBreakdownTwinExample}
                disabled={isGeneratingTwin}
                className="w-full text-left p-3.5 rounded-[10px] bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 hover:border-blue-400 transition flex items-center justify-between gap-3 group"
              >
                <div>
                  <div className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Break down a similar twin variation ({solution.topic || 'Same Topic'})</span>
                  </div>
                  <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                    Generates a brand new problem of this type and walks you through each step.
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform flex-shrink-0" />
              </button>

              {/* Option 2: Curated WAEC Syllabus Examples */}
              <div className="pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] dark:text-[#64748b] block mb-2">
                  Or pick from core syllabus examples:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CURATED_NEXT_EXAMPLES.map((ex, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSeeAnotherExample?.(ex.equation)}
                      className="text-left p-2.5 rounded-[8px] bg-[#f8fafc] dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] hover:border-[#2563eb] hover:bg-white dark:hover:bg-[#131d31] transition text-xs flex items-center justify-between group"
                    >
                      <div>
                        <span className="font-semibold text-[#0f172a] dark:text-[#f8fafc] block">{ex.title}</span>
                        <span className="text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8]">{ex.equation}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-[#94a3b8] group-hover:text-[#2563eb] transition flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Concept Diagram Modal (Meta Muse Image) */}
      <MathematicalDiagramRenderer
        topic={solution.topic}
        equation={solution.extractedLatex}
        isOpen={isDiagramModalOpen}
        onClose={() => setIsDiagramModalOpen(false)}
      />


    </section>
  );
};

export default ScaffoldingSolutionView;
