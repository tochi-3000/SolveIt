'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  Square,
  X,
  RefreshCw,
  CheckCircle2,
  Send,
  AlertCircle,
} from 'lucide-react';
import MathDisplay from './MathDisplay';
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
  const [askedQuestion, setAskedQuestion] = useState<string | null>(null);
  const [waecTip, setWaecTip] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const stopAudioRef = useRef<(() => void) | null>(null);
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Stop any playing speech or active recording when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (stopAudioRef.current) {
        stopAudioRef.current();
        stopAudioRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore abort errors on cleanup
        }
        recognitionRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore stop errors on cleanup
        }
      }
      setIsRecording(false);
      setIsPlayingAudio(false);
      setResponseAnswer(null);
      setAskedQuestion(null);
      setWaecTip(null);
      setVoiceError(null);
      setQuestionInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmitQuestion = async (customQuery?: string, audioBase64?: string) => {
    const query = (customQuery ?? questionInput).trim();
    if (!query && !audioBase64) {
      setVoiceError('Please speak a question into your microphone or type one in the box.');
      return;
    }

    setVoiceError(null);
    setIsLoading(true);
    setResponseAnswer(null);
    if (query) {
      setAskedQuestion(query);
    }
    if (stopAudioRef.current) {
      stopAudioRef.current();
      stopAudioRef.current = null;
    }

    try {
      const res = await fetch('/api/math/voice-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: query || undefined,
          audioBase64,
          currentStepNumber: stepNumber,
          stepLatex,
          stepExplanation,
          languageMode,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.transcribedQuestion) {
          setQuestionInput(data.transcribedQuestion);
          setAskedQuestion(data.transcribedQuestion);
        }
        setResponseAnswer(data.answer);
        setWaecTip(data.waecMarkRelevance);

        // Auto-play the exact on-screen answer text with math normalization so voice & text match 100%
        if (data.answer) {
          const cancel = playSpokenMath(data.answer, {
            rate: speechRate,
            language: languageMode,
            onStart: () => setIsPlayingAudio(true),
            onEnd: () => setIsPlayingAudio(false),
            onError: () => setIsPlayingAudio(false),
          });
          stopAudioRef.current = cancel;
        }
      } else {
        setVoiceError(data.error || 'Could not process your voice question. Please try again.');
      }
    } catch (err) {
      console.error('Voice question failed:', err);
      setVoiceError('Network error while contacting Professor SolvAm. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Real Browser Speech Recognition + MediaRecorder Fallback
  const handleToggleRecord = async () => {
    setVoiceError(null);

    // Stop any ongoing TTS playback before listening to user's voice
    if (stopAudioRef.current) {
      stopAudioRef.current();
      stopAudioRef.current = null;
      setIsPlayingAudio(false);
    }

    // If already recording, stop and submit whatever was captured
    if (isRecording) {
      setIsRecording(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
        return;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    // 1. Prefer Web Speech Recognition API (Chrome, Edge, Safari) for instant live transcription
    const SpeechRecognitionAPI =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (SpeechRecognitionAPI) {
      try {
        const recognition = new SpeechRecognitionAPI();
        recognitionRef.current = recognition;
        liveTranscriptRef.current = '';

        recognition.lang = 'en-NG';
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsRecording(true);
          setQuestionInput('');
        };

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          const cleaned = transcript.trim();
          liveTranscriptRef.current = cleaned;
          setQuestionInput(cleaned);
        };

        recognition.onerror = (event: any) => {
          setIsRecording(false);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setVoiceError(
              'Microphone permission was denied. Please allow microphone access in your browser address bar or type your question.'
            );
          } else if (event.error === 'no-speech') {
            setVoiceError(
              'No speech was detected. Click the microphone button and speak your question clearly, or type it below.'
            );
          } else if (event.error !== 'aborted') {
            setVoiceError(`Voice capture error (${event.error}). You can also type your question directly.`);
          }
        };

        recognition.onend = () => {
          setIsRecording(false);
          recognitionRef.current = null;
          const finalSpoken = liveTranscriptRef.current.trim();
          if (finalSpoken) {
            handleSubmitQuestion(finalSpoken);
          } else {
            setVoiceError((prev) =>
              prev ||
              'No speech was detected from your microphone. Please speak clearly while recording or type your question below.'
            );
          }
        };

        recognition.start();
        return;
      } catch (err) {
        console.warn('Web Speech API initialization failed, falling back to MediaRecorder:', err);
      }
    }

    // 2. Fallback: MediaRecorder audio capture for browsers without Web Speech Recognition
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          setIsRecording(false);
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (audioBlob.size < 1000) {
            setVoiceError('Recording was too short or silent. Please speak clearly or type your question.');
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result as string;
            handleSubmitQuestion(undefined, base64Audio);
          };
          reader.readAsDataURL(audioBlob);
        };

        setIsRecording(true);
        recorder.start();
      } catch (err) {
        setIsRecording(false);
        setVoiceError(
          'Could not access microphone. Please grant microphone permissions or type your question below.'
        );
      }
    } else {
      setVoiceError('Voice recording is not supported in this browser. Please type your question below.');
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
        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-2.5">
          <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
            Active Focus Step:
          </div>
          <MathDisplay
            value={stepExplanation}
            className="text-slate-100 font-medium leading-relaxed text-xs sm:text-sm"
          />
          <div className="pt-2 px-3 py-2 bg-slate-900/90 rounded-xl border border-slate-800/80 text-center">
            <MathDisplay
              value={stepLatex}
              displayMode
              className="text-emerald-300 text-sm font-semibold"
            />
          </div>
        </div>

        {/* Voice Input Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Speak or Type Your Question:</span>
            {isRecording && (
              <span className="flex items-center gap-1.5 text-rose-400 font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Listening... Speak now (click mic to finish)
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={questionInput}
              onChange={(e) => {
                setQuestionInput(e.target.value);
                if (voiceError) setVoiceError(null);
              }}
              placeholder={
                isRecording
                  ? 'Listening to your microphone...'
                  : `Ask anything about Step ${stepNumber} (e.g. How did we get these numbers?)`
              }
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitQuestion()}
            />

            {/* Submit Typed Question Button */}
            <button
              type="button"
              onClick={() => handleSubmitQuestion()}
              disabled={isLoading || !questionInput.trim()}
              className="px-3.5 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white transition flex items-center justify-center"
              title="Submit Question"
            >
              <Send className="w-4 h-4" />
            </button>

            {/* Live Microphone Voice Capture Button */}
            <button
              type="button"
              onClick={handleToggleRecord}
              disabled={isLoading}
              className={`p-3 rounded-xl font-bold transition flex items-center justify-center ${
                isRecording
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
              }`}
              title={isRecording ? 'Stop Recording & Submit' : 'Click to Speak Your Question'}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          </div>

          {/* Voice Error / Silence Alert */}
          {voiceError && (
            <div className="p-2.5 bg-amber-950/50 border border-amber-700/50 rounded-xl flex items-start gap-2 text-xs text-amber-200 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>{voiceError}</span>
            </div>
          )}

          {/* Contextual Quick Clickable Suggestions */}
          <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
            <span className="text-slate-400 self-center text-[11px]">Quick Questions:</span>
            <button
              type="button"
              onClick={() => {
                const q = `Can you explain Step ${stepNumber} in simpler words?`;
                setQuestionInput(q);
                handleSubmitQuestion(q);
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition text-[11px]"
            >
              Explain Step {stepNumber} Simply?
            </button>
            <button
              type="button"
              onClick={() => {
                const q = `Why did we choose these numbers in Step ${stepNumber}?`;
                setQuestionInput(q);
                handleSubmitQuestion(q);
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition text-[11px]"
            >
              Why These Numbers?
            </button>
            <button
              type="button"
              onClick={() => {
                const q = `What do WAEC examiners check on Step ${stepNumber}?`;
                setQuestionInput(q);
                handleSubmitQuestion(q);
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition text-[11px]"
            >
              WAEC Marking Tip?
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center gap-3">
            <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
            <span className="text-xs text-slate-300 font-semibold">
              Professor SolvAm is analyzing your question for Step {stepNumber}...
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

            {askedQuestion && (
              <div className="text-xs text-slate-400 italic border-l-2 border-slate-700 pl-2.5">
                &ldquo;{askedQuestion}&rdquo;
              </div>
            )}

            <MathDisplay
              value={responseAnswer}
              className="text-sm text-slate-100 leading-relaxed font-medium"
            />

            {waecTip && (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-xs text-emerald-300 font-medium">
                <MathDisplay value={waecTip} />
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
