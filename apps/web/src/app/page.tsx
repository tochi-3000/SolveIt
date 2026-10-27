'use client';

import React, { useState, useEffect, useRef } from 'react';
import MathDisplay from '@/components/MathDisplay';
import CameraBridgeModal from '@/components/CameraBridgeModal';
import TelemetryHud from '@/components/TelemetryHud';
import SamSegmentationCanvas from '@/components/SamSegmentationCanvas';
import EquationVerificationModal from '@/components/EquationVerificationModal';
import { cropImageRegion } from '@/lib/image/crop';
import { optimizeImage } from '@/lib/image/optimizer';
import { getSampleWaecExamSheet } from '@/lib/fixtures/waecExamSheet';
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { SolveResponse, VerifyStepsResponse, GenerateTwinResponse, SAMSegment, BoundingBox } from '@solvam/shared-types';
import { PedagogicalSolution, TelemetryEvent, PedagogicalLevel, LanguageMode } from '@/lib/ai/types';
import { 
  Calculator, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Award, 
  ArrowRight, 
  ShieldCheck, 
  RefreshCw, 
  Cpu, 
  Smartphone, 
  Coins, 
  BookOpen,
  Volume2,
  AlertTriangle,
  Layers,
  Globe2,
  LogIn,
  FileText,
  Upload,
  Scan,
  Camera
} from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  email?: string;
  is_guest: boolean;
  credits: number;
  clerkEnabled?: boolean;
}

export default function HomePage() {
  const [engineStatus, setEngineStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [engineLatency, setEngineLatency] = useState<number | null>(null);

  // User Profile & Credits
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // QR Camera Bridge State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);
  const [beamedPhoto, setBeamedPhoto] = useState<string | null>(null);

  // Phase 3: Meta SAM 3.1 Page Segmentation State
  const [activeExamImage, setActiveExamImage] = useState<string | null>(null);
  const [samSegments, setSamSegments] = useState<SAMSegment[]>([]);
  const [samLoading, setSamLoading] = useState<boolean>(false);
  const [selectedSegment, setSelectedSegment] = useState<SAMSegment | null>(null);
  const [croppedSegmentUri, setCroppedSegmentUri] = useState<string | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multimodal Vision + Tool-Calling State (Phase 2b)
  const [pedagogicalLevel, setPedagogicalLevel] = useState<PedagogicalLevel>('intermediate');
  const [languageMode, setLanguageMode] = useState<LanguageMode>('standard');
  const [aiSolution, setAiSolution] = useState<PedagogicalSolution | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryEvent | null>(null);
  const [transcribeLoading, setTranscribeLoading] = useState<boolean>(false);

  // Section 1: Deterministic Solver State
  const [equationInput, setEquationInput] = useState<string>('3x^2 - 5x - 2 = 0');
  const [solveResult, setSolveResult] = useState<SolveResponse | null>(null);
  const [solveLoading, setSolveLoading] = useState<boolean>(false);
  const [solveLatency, setSolveLatency] = useState<number | null>(null);

  // Section 2: Step Verifier State
  const [originalProblem, setOriginalProblem] = useState<string>('3x^2 - 5x - 2 = 0');
  const [studentSteps, setStudentSteps] = useState<string[]>([
    '3x^2 - 6x + x - 2 = 0',
    '3x(x - 2) + 1(x - 2) = 0',
    '(3x + 1)(x - 2) = 0'
  ]);
  const [verifyResult, setVerifyResult] = useState<VerifyStepsResponse | null>(null);
  const [verifyLoading, setVerifyLoading] = useState<boolean>(false);

  // Check Engine Health & Fetch User Profile on Load
  useEffect(() => {
    async function initPage() {
      const start = performance.now();
      const engineBaseUrl =
        process.env.NEXT_PUBLIC_SYMBOLIC_ENGINE_URL || 'http://localhost:8000';
      try {
        const res = await fetch(`${engineBaseUrl}/health`);
        if (res.ok) {
          setEngineLatency(Math.round(performance.now() - start));
          setEngineStatus('online');
        } else {
          setEngineStatus('offline');
        }
      } catch (e) {
        setEngineStatus('offline');
      }

      try {
        const userRes = await fetch('/api/user/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          setUserProfile(userData);
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
      }
    }

    initPage();
  }, []);

  // Segment an exam image with Meta SAM 3.1
  const segmentExamImage = async (imageUri: string, sampleId?: string) => {
    setSamLoading(true);
    setActiveExamImage(imageUri);
    try {
      const res = await fetch('/api/math/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: imageUri, sampleId }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.segments)) {
        setSamSegments(data.segments);
        if (userProfile && typeof data.remainingCredits === 'number') {
          setUserProfile({ ...userProfile, credits: data.remainingCredits });
        }
      }
    } catch (err) {
      console.error('SAM 3.1 segmentation failed:', err);
    } finally {
      setSamLoading(false);
    }
  };

  // 1-Click Load Sample WAEC 2024 Exam Paper
  const handleLoadSampleSheet = () => {
    const fixture = getSampleWaecExamSheet();
    setActiveExamImage(fixture.svgDataUri);
    setSamSegments(fixture.segments);
    // Call segment API for telemetry recording and DB credit sync
    segmentExamImage(fixture.svgDataUri, 'waec-2024-paper-2');
  };

  // Handle Photo Beamed from Mobile via Native SSE
  const handlePhotoReceived = async (base64Image: string) => {
    setBeamedPhoto(base64Image);
    try {
      const optimized = await optimizeImage(base64Image);
      segmentExamImage(optimized);
    } catch (e) {
      segmentExamImage(base64Image);
    }
  };

  // Handle Desktop File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await optimizeImage(file);
      segmentExamImage(optimized);
    } catch (err) {
      console.error('File optimization error:', err);
    }
  };

  // Select a Segment on SAM Canvas
  const handleSelectSegment = async (segment: SAMSegment) => {
    setSelectedSegment(segment);
    if (!activeExamImage) return;

    try {
      const cropped = await cropImageRegion(activeExamImage, segment.boundingBox);
      setCroppedSegmentUri(cropped);
    } catch (err) {
      console.warn('Canvas crop fallback:', err);
      setCroppedSegmentUri(activeExamImage);
    }

    setIsVerificationModalOpen(true);
  };

  // Confirm in Verification Modal & Trigger Solver Loop
  const handleConfirmAndSolve = (verifiedEquation: string, croppedBase64: string) => {
    setIsVerificationModalOpen(false);
    runMultimodalSolve(croppedBase64, verifiedEquation);
  };

  // Run Meta Muse Spark Multimodal Transcription + Tool Loop
  const runMultimodalSolve = async (imageData: string, verifiedEquation?: string) => {
    setTranscribeLoading(true);
    try {
      const res = await fetch('/api/math/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageData,
          pedagogicalLevel,
          languageMode,
          verifiedEquation,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAiSolution(data.solution);
        setTelemetry(data.telemetry);
        if (data.solution.extractedLatex) {
          setEquationInput(data.solution.extractedLatex);
        }
        if (userProfile) {
          const nextCredits =
            typeof data.remainingCredits === 'number'
              ? data.remainingCredits
              : Math.max(0, userProfile.credits - 1);
          setUserProfile({ ...userProfile, credits: nextCredits });
        }
      }
    } catch (e) {
      console.error('Multimodal solve failed:', e);
    } finally {
      setTranscribeLoading(false);
    }
  };

  // Handle Manual Solve
  const handleSolve = async () => {
    setSolveLoading(true);
    const start = performance.now();
    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equation: equationInput, solveFor: 'x' })
      });
      const data = await res.json();
      setSolveResult(data);
      setSolveLatency(Math.round(performance.now() - start));

      if (userProfile) {
        const nextCredits =
          typeof data.remainingCredits === 'number'
            ? data.remainingCredits
            : Math.max(0, userProfile.credits - 1);
        setUserProfile({ ...userProfile, credits: nextCredits });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSolveLoading(false);
    }
  };

  // Handle Step Verification
  const handleVerify = async () => {
    setVerifyLoading(true);
    try {
      const res = await fetch('/api/verify-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalProblem,
          steps: studentSteps,
          solveFor: 'x'
        })
      });
      const data = await res.json();
      setVerifyResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setVerifyLoading(false);
    }
  };

  // Audio Speech Synthesis for any step
  const speakStep = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  const injectMistake = () => {
    setStudentSteps([
      '3x^2 - 6x + x - 2 = 0',
      '3x^2 + 6x + x - 2 = 0',
      '(3x + 1)(x - 2) = 0'
    ]);
  };

  const resetCorrectSteps = () => {
    setStudentSteps([
      '3x^2 - 6x + x - 2 = 0',
      '3x(x - 2) + 1(x - 2) = 0',
      '(3x + 1)(x - 2) = 0'
    ]);
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Top Navigation & Status Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
              Meta Hackathon 2026 — Track 1
            </span>
            <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-full">
              Phase 3: SAM 3.1 Multi-Equation Segmentation
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-2 text-white flex items-center gap-2">
            SolvAm <span className="text-emerald-400">Core</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            "Shazam for Math" • Meta SAM 3.1 Perception & Neuro-Symbolic WAEC Grader
          </p>
        </div>

        {/* Right Badges: QR Camera Trigger + Credits + SymPy Health */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsCameraModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-950"
          >
            <Smartphone className="w-4 h-4" />
            <span>Scan with Phone (QR)</span>
          </button>

          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-white">{userProfile ? userProfile.credits : 50}</span>
            <span className="text-slate-400 text-[10px] uppercase font-bold">Credits</span>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span className={`inline-block w-2 h-2 rounded-full ${engineStatus === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className={engineStatus === 'online' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {engineStatus.toUpperCase()}
            </span>
          </div>

          {/* Clerk Auth Badge (Only rendered when Clerk keys are configured) */}
          {userProfile?.clerkEnabled && (
            <div className="flex items-center">
              <SignedOut>
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sign In</span>
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>
          )}
        </div>
      </header>

      {/* PHASE 3 HERO: Shazam for Math • Meta SAM 3.1 Multi-Equation Scanner */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <Scan className="w-4 h-4" />
              <span>Perception Engine • Meta SAM 3.1</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
              "Shazam for Math" Exam Page Scanner
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Snap an entire multi-problem WAEC exam paper. Meta SAM 3.1 isolates each equation with glowing segmentation boxes so you can tap the exact question you want to solve.
            </p>
          </div>

          {/* Action Trigger Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1-Click Sample Sheet for Judges */}
            <button
              type="button"
              onClick={handleLoadSampleSheet}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-950 active:scale-95 transition flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>📄 1-Click WAEC 2024 Exam Sheet</span>
            </button>

            {/* Upload File */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-2"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Upload Photo</span>
            </button>

            {/* Scan via QR Bridge */}
            <button
              type="button"
              onClick={() => setIsCameraModalOpen(true)}
              className="px-3.5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold rounded-xl border border-emerald-500/40 transition flex items-center gap-2"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>Phone Lens</span>
            </button>
          </div>
        </div>

        {/* SAM 3.1 Interactive Canvas (when an exam image is active) */}
        {activeExamImage ? (
          <SamSegmentationCanvas
            imageUrl={activeExamImage}
            segments={samSegments}
            selectedSegmentId={selectedSegment?.id || null}
            onSelectSegment={handleSelectSegment}
            isLoading={samLoading}
          />
        ) : (
          <div
            onClick={handleLoadSampleSheet}
            className="cursor-pointer border-2 border-dashed border-slate-800 hover:border-emerald-500/60 rounded-2xl p-8 sm:p-12 text-center bg-slate-950/40 hover:bg-slate-900/40 transition group"
          >
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition">
              <Scan className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition">
              Click Here to Load Official WAEC 2024 Exam Sheet
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Or beam a photo from your phone using the QR bridge to test SAM 3.1 real-time multi-equation segmentation.
            </p>
          </div>
        )}
      </section>

      {/* Scaffolding & Language Controls */}
      <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Scaffolding Level:</span>
          </span>
          <div className="flex gap-1.5">
            {(['beginner', 'intermediate', 'expert'] as PedagogicalLevel[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setPedagogicalLevel(lvl)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                  pedagogicalLevel === lvl
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Language Mode:</span>
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setLanguageMode('standard')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                languageMode === 'standard'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Standard English
            </button>
            <button
              onClick={() => setLanguageMode('pidgin')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                languageMode === 'pidgin'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Nigerian Pidgin 🇳🇬
            </button>
          </div>
        </div>
      </section>

      {/* Multimodal AI Solution Display (Phase 2b Feature) */}
      {aiSolution && (
        <section className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Meta Muse Spark 1.3 Adaptive Breakdown</span>
              </div>
              <h2 className="text-2xl font-black text-white mt-1">{aiSolution.topic}</h2>
              <p className="text-xs text-slate-400 mt-1">{aiSolution.discriminantSummary}</p>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Verified Answer</span>
              <MathDisplay value={aiSolution.finalAnswerLatex} className="text-emerald-400 font-bold text-lg" />
            </div>
          </div>

          {/* Steps List */}
          <div className="space-y-4">
            {aiSolution.steps.map((st) => (
              <div key={st.stepNumber} className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold flex items-center justify-center">
                      {st.stepNumber}
                    </span>
                    <span className="text-sm font-semibold text-slate-200">{st.explanation}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {st.audioNarration && (
                      <button
                        onClick={() => speakStep(st.audioNarration!)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        title="Read aloud"
                      >
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                      </button>
                    )}
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {st.waecMark}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/60 rounded-xl text-center">
                  <MathDisplay value={st.mathLatex} displayMode className="text-white font-medium" />
                </div>

                {st.commonPitfall && (
                  <div className="flex items-center gap-2 text-xs text-amber-300/90 bg-amber-950/30 p-2.5 rounded-xl border border-amber-800/30">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                    <span><strong>Examiner's Warning:</strong> {st.commonPitfall}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Generated Twin Problem */}
          {aiSolution.twinPracticeProblem && (
            <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Practice Twin Question (Ready for Student Solve):</span>
              </span>
              <div className="p-2 bg-slate-950 rounded-xl text-center">
                <MathDisplay value={aiSolution.twinPracticeProblem.twin_equation_latex} displayMode className="text-white font-bold" />
              </div>
            </div>
          )}

          {/* Telemetry HUD */}
          <TelemetryHud telemetry={telemetry} />
        </section>
      )}

      {/* Grid Layout: Solver & Twin Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Deterministic Equation Solver */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-400" />
                Deterministic Solver
              </h2>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                Zero-Hallucination
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Enter any WAEC equation. SymPy calculates exact roots, discriminants, and milestones deterministically.
            </p>

            <div className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={equationInput}
                  onChange={(e) => setEquationInput(e.target.value)}
                  placeholder="e.g. 3x^2 - 5x - 2 = 0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-center min-h-[48px] flex items-center justify-center">
                <MathDisplay value={equationInput} displayMode />
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-slate-400 self-center">WAEC Samples:</span>
                <button
                  type="button"
                  onClick={() => setEquationInput('3x^2 - 5x - 2 = 0')}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                >
                  Quadratic
                </button>
                <button
                  type="button"
                  onClick={() => setEquationInput('x^2 - 16 = 0')}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                >
                  Diff of Squares
                </button>
                <button
                  type="button"
                  onClick={() => setEquationInput('3x - 12 = 0')}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                >
                  Linear
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleSolve}
              disabled={solveLoading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 disabled:opacity-50"
            >
              {solveLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Solve Deterministically</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {solveResult && (
              <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-emerald-500/30 space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-emerald-400">{solveResult.topic_label}</span>
                  {solveLatency && <span>Latency: {solveLatency}ms</span>}
                </div>

                <div className="py-1">
                  <div className="text-xs text-slate-400">Verified Roots:</div>
                  <MathDisplay value={solveResult.solution_latex} displayMode className="text-emerald-300 font-bold" />
                </div>

                {solveResult.discriminant !== null && solveResult.discriminant !== undefined && (
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
                    <div>
                      <span className="text-slate-400">Discriminant (Δ):</span>
                      <span className="ml-1 font-mono text-amber-300">{solveResult.discriminant}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Nature:</span>
                      <span className="ml-1 text-slate-200">{solveResult.milestones.nature_of_roots}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: One-Click AI Trigger Demo */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                Meta Muse Spark Tool-Loop Test
              </h2>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                Phase 3 Live
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Test the full Multimodal Perception + SymPy Tool Calling loop on any verified WAEC formula.
            </p>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="text-xs text-slate-400">Active Test Target:</div>
              <div className="text-sm font-semibold text-white">WAEC Standard Quadratic Scaffolding ($3x^2 - 5x - 2 = 0$)</div>
              <div className="text-xs text-slate-400">Triggers: Multimodal Vision &rarr; SymPy Tool &rarr; WAEC M1/A1 Marks &rarr; Practice Twin.</div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => runMultimodalSolve('mockBase64ImageData', '3x^2 - 5x - 2 = 0')}
              disabled={transcribeLoading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 disabled:opacity-50"
            >
              {transcribeLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Trigger Meta Muse Spark Pipeline</span>
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Section 3: "Red-Pen" Step Verifier (WAEC Marking Rubric) */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Award className="w-6 h-6 text-emerald-400" />
              "Red-Pen" Step Verifier & WAEC Rubric Diagnostic
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Checks line-by-line mathematical equivalence using SymPy AST comparison. Awards WAEC M1 (Method) and A1 (Accuracy) marks.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetCorrectSteps}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
            >
              Load 100% Correct Steps
            </button>
            <button
              type="button"
              onClick={injectMistake}
              className="px-3 py-1.5 text-xs font-medium bg-rose-950/80 hover:bg-rose-900/80 text-rose-300 border border-rose-800/40 rounded-lg transition flex items-center gap-1"
            >
              <span>Inject Sign Mistake (Step 2)</span>
            </button>
          </div>
        </div>

        {/* Steps Editor */}
        <div className="space-y-3 mb-6">
          <div className="text-xs font-semibold text-slate-400">Student's Sequential Handwritten Lines:</div>
          {studentSteps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 font-mono text-xs flex items-center justify-center font-bold">
                L{idx + 1}
              </span>
              <input
                type="text"
                value={step}
                onChange={(e) => {
                  const updated = [...studentSteps];
                  updated[idx] = e.target.value;
                  setStudentSteps(updated);
                }}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <div className="w-48 hidden sm:block p-2 bg-slate-950 rounded-lg text-xs text-slate-300 text-center border border-slate-800/50">
                <MathDisplay value={step} />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleVerify}
          disabled={verifyLoading}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 disabled:opacity-50"
        >
          {verifyLoading ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              <span>Run Line-by-Line WAEC Diagnostic Verification</span>
            </>
          )}
        </button>

        {verifyResult && (
          <div className="mt-6 p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  {verifyResult.is_fully_correct ? (
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                      100% Mathematically Rigorous
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <XCircle className="w-5 h-5" />
                      Step-Level Error Detected
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">{verifyResult.pedagogical_summary}</p>
              </div>

              <div className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">WAEC Marks Earned</div>
                <div className="text-2xl font-extrabold text-emerald-400">
                  {verifyResult.waec_score_earned} / {verifyResult.waec_score_total}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {verifyResult.step_analyses.map((sa) => (
                <div
                  key={sa.step_index}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    sa.is_mathematically_valid
                      ? 'bg-emerald-950/20 border-emerald-800/40'
                      : 'bg-rose-950/30 border-rose-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-400">
                      Line {sa.step_index}:
                    </span>
                    <span className="font-mono text-sm text-white font-semibold">
                      {sa.raw_text}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-300">
                      {sa.feedback}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-extrabold font-mono ${
                        sa.waec_mark === 'M1' || sa.waec_mark === 'A1'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
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

      {/* The QR Camera Bridge Modal */}
      <CameraBridgeModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onPhotoReceived={handlePhotoReceived}
      />

      {/* Phase 3: Equation Verification Modal */}
      <EquationVerificationModal
        isOpen={isVerificationModalOpen}
        onClose={() => setIsVerificationModalOpen(false)}
        segment={selectedSegment}
        croppedImageUri={croppedSegmentUri}
        pedagogicalLevel={pedagogicalLevel}
        onChangePedagogicalLevel={setPedagogicalLevel}
        languageMode={languageMode}
        onChangeLanguageMode={setLanguageMode}
        onConfirmAndSolve={handleConfirmAndSolve}
        isSolving={transcribeLoading}
      />
    </main>
  );
}
