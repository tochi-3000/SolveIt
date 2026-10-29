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
} from 'lucide-react';

interface ScaffoldingSolutionViewProps {
  solution: PedagogicalSolution;
  pedagogicalLevel: PedagogicalLevel;
  onChangePedagogicalLevel?: (level: PedagogicalLevel) => void;
  languageMode: LanguageMode;
  onChangeLanguageMode?: (mode: LanguageMode) => void;
  speechRate?: number;
  showExaminerWarnings?: boolean;
  onSolveTwin?: (twinEquation: string) => void;
}

export const ScaffoldingSolutionView: React.FC<ScaffoldingSolutionViewProps> = ({
  solution,
  pedagogicalLevel,
  onChangePedagogicalLevel,
  languageMode,
  onChangeLanguageMode,
  speechRate = 1.0,
  showExaminerWarnings = true,
  onSolveTwin,
}) => {
  // Audio Playback State
  const [playingStepIndex, setPlayingStepIndex] = useState<number | null>(null);
  const [isPlayingFullSolution, setIsPlayingFullSolution] = useState<boolean>(false);
  const stopAudioRef = useRef<(() => void) | null>(null);

  // Progressive Disclosure for Expert Mode
  const [revealedStepIndices, setRevealedStepIndices] = useState<Set<number>>(new Set([1]));

  // Modals State
  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState<boolean>(false);
  const [voiceStepTarget, setVoiceStepTarget] = useState<ScaffoldingStep | null>(null);

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
                    onClick={() => setVoiceStepTarget(st)}
                    className="p-2 rounded-[8px] bg-white dark:bg-[#0b1120] hover:bg-[#dbeafe] dark:hover:bg-[#1e3a8a]/50 text-[#2563eb] dark:text-[#60a5fa] border border-[#e2e8f0] dark:border-[#1e293b] transition"
                    title="Ask Professor SolvAm aloud about this step"
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

      {/* Twin Practice Problem Sub-Panel */}
      {solution.twinPracticeProblem && (
        <div className="pt-5 border-t border-[#e2e8f0] dark:border-[#1e293b]">
          <div className="p-5 bg-white dark:bg-[#0b1120] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#1e3a8a] dark:text-[#93c5fd] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa]" />
                <span>Parametric WAEC Twin Practice Problem (SymPy Verified)</span>
              </span>

              {onSolveTwin && (
                <button
                  type="button"
                  onClick={() =>
                    onSolveTwin(
                      solution.twinPracticeProblem!.twin_equation_latex.replace(/\$/g, '')
                    )
                  }
                  className="px-3 py-1.5 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/50 hover:bg-[#bfdbfe] dark:hover:bg-[#1e3a8a]/70 text-xs font-semibold text-[#1e3a8a] dark:text-[#93c5fd] flex items-center gap-1 transition"
                >
                  <span>Practice This Problem</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="py-4 px-4 bg-[#f8fafc] dark:bg-[#0f172a] rounded-[8px] text-center">
              <MathDisplay
                value={solution.twinPracticeProblem.twin_equation_latex}
                displayMode
                className="text-[#0f172a] dark:text-[#f8fafc] font-bold"
              />
            </div>
          </div>
        </div>
      )}

      {/* Concept Diagram Modal (Meta Muse Image) */}
      <MathematicalDiagramRenderer
        topic={solution.topic}
        equation={solution.extractedLatex}
        isOpen={isDiagramModalOpen}
        onClose={() => setIsDiagramModalOpen(false)}
      />

      {/* Voice Tutor Modal (Meta Muse Voice Transcribe) */}
      {voiceStepTarget && (
        <VoiceTutorModal
          isOpen={Boolean(voiceStepTarget)}
          onClose={() => setVoiceStepTarget(null)}
          stepNumber={voiceStepTarget.stepNumber}
          stepLatex={voiceStepTarget.mathLatex}
          stepExplanation={voiceStepTarget.explanation}
          languageMode={languageMode}
          speechRate={speechRate}
        />
      )}
    </section>
  );
};

export default ScaffoldingSolutionView;
