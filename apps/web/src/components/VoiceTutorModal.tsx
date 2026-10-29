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

  // Production Safeguard: Stop active speech synthesis or recording when unmounting or closing
  useEffect(() => {
    return () => {
      if (stopAudioRef.current) {
        stopAudioRef.current();
        stopAudioRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore abort errors during cleanup
        }
        recognitionRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore stop errors during cleanup
        }
      }
    };
  }, []);

  // Reset local state when closing
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
          // Ignore abort errors during cleanup
        }
        recognitionRef.current = null;
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

        // Auto-play the exact on-screen answer text with math normalization
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

    // Stop any ongoing TTS playback before listening to user voice
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
          // Ignore stop errors
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
              'Microphone permission was denied. Please allow microphone access in your browser or type your question.'
            );
          } else if (event.error === 'no-speech') {
            setVoiceError(
              'No speech was detected. Please speak clearly into your microphone, or type your question.'
            );
          } else if (event.error !== 'aborted') {
            setVoiceError(`Voice capture error (${event.error}). You can also type your question.`);
          }
        };

        recognition.onend = () => {
          setIsRecording(false);
          recognitionRef.current = null;
          const finalSpoken = liveTranscriptRef.current.trim();
          if (finalSpoken) {
            handleSubmitQuestion(finalSpoken);
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
    <div className="mt-3 w-full rounded-[12px] bg-gradient-to-b from-[#f0f7ff] to-white dark:from-[#0b1120] dark:to-[#0f172a] border border-[#bfdbfe] dark:border-[#1e3a8a] shadow-sm p-3.5 sm:p-4.5 space-y-3 transition-all">
      {/* Compact Header: Sparkles badge + Title + Close Button */}
      <div className="flex items-center justify-between gap-2 border-b border-[#e2e8f0]/80 dark:border-[#1e293b] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#dbeafe] dark:bg-[#1e3a8a]/60 text-[#1e3a8a] dark:text-[#93c5fd] text-[11px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
            Meta Muse Voice Transcribe
          </span>
          <span className="text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc]">
            Step {stepNumber} Inquiries
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-[6px] text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white hover:bg-[#e2e8f0] dark:hover:bg-[#1e293b] transition"
          aria-label="Close voice menu"
          title="Close voice menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Voice & Text Input Row */}
      <div className="space-y-2">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={questionInput}
            onChange={(e) => {
              setQuestionInput(e.target.value);
              if (voiceError) setVoiceError(null);
            }}
            placeholder={
              isRecording
                ? 'Listening to microphone... Speak clearly'
                : `Ask anything about Step ${stepNumber} (or click mic to speak)...`
            }
            className="flex-1 bg-white dark:bg-[#0b1120] border border-[#cbd5e1] dark:border-[#334155] rounded-[8px] px-3.5 py-2 text-xs sm:text-sm text-[#0f172a] dark:text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[#2563eb] transition"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmitQuestion()}
          />

          {/* Submit Question Button */}
          <button
            type="button"
            onClick={() => handleSubmitQuestion()}
            disabled={isLoading || !questionInput.trim()}
            className="px-3.5 py-2 rounded-[8px] font-semibold bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-40 disabled:pointer-events-none text-white text-xs transition flex items-center justify-center gap-1.5 flex-shrink-0"
            title="Submit Question"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ask</span>
          </button>

          {/* Voice Capture Microphone Toggle */}
          <button
            type="button"
            onClick={handleToggleRecord}
            disabled={isLoading}
            className={`p-2 sm:px-3 sm:py-2 rounded-[8px] font-semibold transition flex items-center justify-center gap-1.5 flex-shrink-0 ${
              isRecording
                ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse ring-2 ring-rose-500/40'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
            }`}
            title={isRecording ? 'Stop Recording & Submit' : 'Click to Speak Aloud'}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span className="hidden sm:inline text-xs">
              {isRecording ? 'Listening...' : 'Speak'}
            </span>
          </button>
        </div>

        {/* Live Recording Pulse Banner */}
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-[8px] text-xs font-semibold text-rose-700 dark:text-rose-300 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>Listening... SolvAm is transcribing your spoken question in real-time. Click mic to send.</span>
          </div>
        )}

        {/* Error Notification */}
        {voiceError && (
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-[8px] flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <span>{voiceError}</span>
          </div>
        )}

        {/* Contextual Quick Question Suggestions */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs">
          <span className="text-[#64748b] dark:text-[#94a3b8] text-[11px] font-medium mr-1">
            Quick Inquiries:
          </span>
          <button
            type="button"
            onClick={() => {
              const q = `Explain Step ${stepNumber} in simpler words.`;
              setQuestionInput(q);
              handleSubmitQuestion(q);
            }}
            className="px-2.5 py-1 bg-white dark:bg-[#0b1120] hover:bg-[#e0f0fe] dark:hover:bg-[#1e3a8a]/40 border border-[#e2e8f0] dark:border-[#1e293b] text-[#1e3a8a] dark:text-[#93c5fd] rounded-[6px] transition text-[11px] font-medium"
          >
            Explain Step {stepNumber} Simply
          </button>
          <button
            type="button"
            onClick={() => {
              const q = `Why did we select these numbers in Step ${stepNumber}?`;
              setQuestionInput(q);
              handleSubmitQuestion(q);
            }}
            className="px-2.5 py-1 bg-white dark:bg-[#0b1120] hover:bg-[#e0f0fe] dark:hover:bg-[#1e3a8a]/40 border border-[#e2e8f0] dark:border-[#1e293b] text-[#1e3a8a] dark:text-[#93c5fd] rounded-[6px] transition text-[11px] font-medium"
          >
            Why These Numbers?
          </button>
          <button
            type="button"
            onClick={() => {
              const q = `What do WAEC examiners check for on Step ${stepNumber}?`;
              setQuestionInput(q);
              handleSubmitQuestion(q);
            }}
            className="px-2.5 py-1 bg-white dark:bg-[#0b1120] hover:bg-[#e0f0fe] dark:hover:bg-[#1e3a8a]/40 border border-[#e2e8f0] dark:border-[#1e293b] text-[#1e3a8a] dark:text-[#93c5fd] rounded-[6px] transition text-[11px] font-medium"
          >
            WAEC Marking Tip
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-3 bg-white dark:bg-[#0b1120] rounded-[8px] border border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-center gap-2.5 text-xs text-[#2563eb] dark:text-[#60a5fa] font-semibold">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Professor SolvAm is analyzing your question for Step {stepNumber}...</span>
        </div>
      )}

      {/* Professor SolvAm Response */}
      {responseAnswer && !isLoading && (
        <div className="p-3.5 bg-white dark:bg-[#0b1120] rounded-[10px] border border-[#bfdbfe] dark:border-[#1e3a8a] space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#e2e8f0]/80 dark:border-[#1e293b] pb-2">
            <span className="text-xs font-bold text-[#1e3a8a] dark:text-[#93c5fd] uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Professor SolvAm Clarification:</span>
            </span>

            {/* Audio Controls */}
            {isPlayingAudio ? (
              <button
                type="button"
                onClick={handleStopAudio}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-[6px] transition flex items-center gap-1 shadow-sm"
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
                className="px-2.5 py-1 bg-[#dbeafe] dark:bg-[#1e3a8a]/50 hover:bg-[#bfdbfe] text-[#1e3a8a] dark:text-[#93c5fd] text-[10px] font-semibold rounded-[6px] transition flex items-center gap-1"
              >
                <Volume2 className="w-3 h-3 text-[#2563eb] dark:text-[#60a5fa]" />
                <span>Replay Audio</span>
              </button>
            )}
          </div>

          {askedQuestion && (
            <div className="text-xs text-[#64748b] dark:text-[#94a3b8] italic border-l-2 border-[#2563eb] pl-2.5">
              &ldquo;{askedQuestion}&rdquo;
            </div>
          )}

          <MathDisplay
            value={responseAnswer}
            className="text-xs sm:text-sm text-[#0f172a] dark:text-[#f8fafc] leading-[1.6] font-medium"
          />

          {waecTip && (
            <div className="p-2.5 bg-[#dbeafe]/50 dark:bg-[#1e3a8a]/30 border border-[#bfdbfe]/60 dark:border-[#1e3a8a]/60 rounded-[8px] text-xs text-[#1e3a8a] dark:text-[#93c5fd] font-medium">
              <MathDisplay value={waecTip} />
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-[#f1f5f9] dark:bg-[#1e293b] hover:bg-[#e2e8f0] dark:hover:bg-[#334155] text-[#0f172a] dark:text-[#f8fafc] text-[11px] font-bold rounded-[6px] transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceTutorModal;
