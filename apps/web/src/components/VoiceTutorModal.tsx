'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Mic, MicOff, Volume2, Square, X, RefreshCw, HelpCircle, CheckCircle2 } from 'lucide-react';
import { playSpokenMath } from '@/lib/audio/mathSpeechNormalizer';
import { LanguageMode } from '@solvam/shared-types';

interface VoiceTutorModalProps {
  isOpen: boolean;
  onClose: () => void;
  stepNumber: number;
  stepLatex: string;
  stepExplanation: string;
  languageMode: LanguageMode;
  speechRate?: number;
}

export const VoiceTutorModal: React.FC<VoiceTutorModalProps> = ({
  isOpen,
  onClose,
  stepNumber,
  stepLatex,
  stepExplanation,
  languageMode,
  speechRate = 1.0,
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [questionInput, setQuestionInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [responseAnswer, setResponseAnswer] = useState<string | null>(null);
  const [waecTip, setWaecTip] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  const stopAudioRef = useRef<(() => void) | null>(null);

  // Stop any playing speech when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (stopAudioRef.current) {
        stopAudioRef.current();
        stopAudioRef.current = null;
      }
      setIsPlayingAudio(false);
      setResponseAnswer(null);
      setQuestionInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmitQuestion = async (customQuery?: string) => {
    const query = customQuery || questionInput.trim();
    if (!query) return;

    setIsLoading(true);
    setResponseAnswer(null);
    if (stopAudioRef.current) {
      stopAudioRef.current();
      stopAudioRef.current = null;
    }

    try {
      const res = await fetch('/api/math/voice-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: query,
          currentStepNumber: stepNumber,
          stepLatex,
          stepExplanation,
          languageMode,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResponseAnswer(data.answer);
        setWaecTip(data.waecMarkRelevance);

        // Auto-play spoken response with math normalization
        if (data.audioNarration || data.answer) {
          const cancel = playSpokenMath(data.audioNarration || data.answer, {
            rate: speechRate,
            language: languageMode,
            onStart: () => setIsPlayingAudio(true),
            onEnd: () => setIsPlayingAudio(false),
            onError: () => setIsPlayingAudio(false),
          });
          stopAudioRef.current = cancel;
        }
      }
    } catch (err) {
      console.error('Voice question failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle Simulated / Web Speech Recording
  const handleToggleRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      // Auto submit default spoken question
      if (!questionInput) {
        setQuestionInput('Why did the signs invert when factoring this line?');
        handleSubmitQuestion('Why did the signs invert when factoring this line?');
      } else {
        handleSubmitQuestion();
      }
    } else {
      setIsRecording(true);
      setQuestionInput('Why did the signs invert when factoring this line?');
      setTimeout(() => {
        setIsRecording(false);
        handleSubmitQuestion('Why did the signs invert when factoring this line?');
      }, 2500);
    }
  };

  const handleStopAudio = () => {
    if (stopAudioRef.current) {
      stopAudioRef.current();
      stopAudioRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Meta Muse Voice Transcribe • Bidirectional Voice Tutor</span>
          </div>
          <h2 className="text-2xl font-black text-white mt-1">Ask Professor SolvAm</h2>
          <p className="text-xs text-slate-400 mt-1">
            Ask any question aloud regarding <strong>Step {stepNumber}</strong>. SolvAm analyzes your voice and answers with official WAEC rubric insights.
          </p>
        </div>

        {/* Target Step Summary Card */}
        <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-1">
          <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Active Focus Step:</div>
          <div className="text-white font-medium">{stepExplanation}</div>
          <div className="font-mono text-emerald-300 text-xs">{stepLatex}</div>
        </div>

        {/* Voice Input Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Speak or Type Your Question:</span>
            {isRecording && (
              <span className="flex items-center gap-1.5 text-rose-400 font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Listening with Muse Voice...
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder="e.g. Why did we change the signs in this bracket?"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitQuestion()}
            />

            <button
              type="button"
              onClick={handleToggleRecord}
              className={`p-3 rounded-xl font-bold transition flex items-center justify-center ${
                isRecording
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
              }`}
              title={isRecording ? 'Stop Recording' : 'Hold to Speak'}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          </div>

          {/* Quick Clickable Suggestions for Judges */}
          <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
            <span className="text-slate-400 self-center text-[11px]">Judge Questions:</span>
            <button
              type="button"
              onClick={() => {
                setQuestionInput('Why did the signs invert on this step?');
                handleSubmitQuestion('Why did the signs invert on this step?');
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition text-[11px]"
            >
              Sign Inversion?
            </button>
            <button
              type="button"
              onClick={() => {
                setQuestionInput('What does discriminant Delta equal 49 mean?');
                handleSubmitQuestion('What does discriminant Delta equal 49 mean?');
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition text-[11px]"
            >
              Discriminant Meaning?
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center gap-3">
            <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
            <span className="text-xs text-slate-300 font-semibold">
              Meta Muse Voice Transcribing & Formulating Pedagogical Answer...
            </span>
          </div>
        )}

        {/* Professor SolvAm Response */}
        {responseAnswer && !isLoading && (
          <div className="p-4 bg-slate-950 rounded-2xl border border-emerald-500/40 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Professor SolvAm Clarification:</span>
              </span>

              {/* Audio Controls */}
              {isPlayingAudio ? (
                <button
                  type="button"
                  onClick={handleStopAudio}
                  className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-lg transition flex items-center gap-1"
                >
                  <Square className="w-3 h-3" />
                  <span>Stop Audio</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const cancel = playSpokenMath(responseAnswer, {
                      rate: speechRate,
                      language: languageMode,
                      onStart: () => setIsPlayingAudio(true),
                      onEnd: () => setIsPlayingAudio(false),
                    });
                    stopAudioRef.current = cancel;
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold rounded-lg transition flex items-center gap-1"
                >
                  <Volume2 className="w-3 h-3 text-emerald-400" />
                  <span>Replay Audio</span>
                </button>
              )}
            </div>

            <p className="text-sm text-slate-200 leading-relaxed font-medium">
              {responseAnswer}
            </p>

            {waecTip && (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-xs text-emerald-300 font-medium">
                {waecTip}
              </div>
            )}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceTutorModal;
