'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import MathDisplay from '@/components/MathDisplay';
import CameraBridgeModal from '@/components/CameraBridgeModal';
import TelemetryHud from '@/components/TelemetryHud';
import SamSegmentationCanvas from '@/components/SamSegmentationCanvas';
import EquationVerificationModal from '@/components/EquationVerificationModal';
import ScaffoldingSolutionView from '@/components/ScaffoldingSolutionView';
import PracticeWorkspaceView from '@/components/PracticeWorkspaceView';
import JudgeModeView from '@/components/JudgeModeView';
import JudgeTelemetryDrawer from '@/components/JudgeTelemetryDrawer';
import AuthProfileModal, { UserProfileData } from '@/components/AuthProfileModal';
import { cropImageRegion } from '@/lib/image/crop';
import { optimizeImage } from '@/lib/image/optimizer';
import { playSpokenMath } from '@/lib/audio/mathSpeechNormalizer';
import { getSampleWaecExamSheet } from '@/lib/fixtures/waecExamSheet';
import {
  getFlawedStudentNotebookFixture,
  getCorrectStudentNotebookFixture,
} from '@/lib/fixtures/studentNotebookFixtures';
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import {
  SolveResponse,
  VerifyStepsResponse,
  SAMSegment,
  GradeHandwritingResponse,
} from '@solvam/shared-types';
import {
  PedagogicalSolution,
  TelemetryEvent,
  PedagogicalLevel,
  LanguageMode,
} from '@/lib/ai/types';
import {
  Sparkles,
  Award,
  RefreshCw,
  Cpu,
  Coins,
  Volume2,
  Layers,
  Globe2,
  LogIn,
  FileText,
  Upload,
  Scan,
  Settings,
  Menu,
  X,
  Sliders,
  Check,
  Sun,
  Moon,
  Monitor,
  BookOpen,
  Terminal,
  ArrowRight,
} from 'lucide-react';

type ActiveWorkspaceView = 'learn' | 'practice' | 'judge-mode' | 'settings';
type ThemeMode = 'light' | 'dark' | 'system';

interface AppPreferences {
  themeMode: ThemeMode;
  pedagogicalLevel: PedagogicalLevel;
  languageMode: LanguageMode;
  speechRate: number;
  autoExpandTelemetry: boolean;
  showExaminerWarnings: boolean;
}

const DEFAULT_PREFERENCES: AppPreferences = {
  themeMode: 'light',
  pedagogicalLevel: 'intermediate',
  languageMode: 'standard',
  speechRate: 0.95,
  autoExpandTelemetry: false,
  showExaminerWarnings: true,
};

const STORAGE_KEY_PREFS = 'solvam_user_preferences_v1';

export default function HomePage() {
  // Navigation & Responsive Drawer State
  const [activeView, setActiveView] = useState<ActiveWorkspaceView>('learn');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Engine Health & Latency
  const [engineStatus, setEngineStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [engineLatency, setEngineLatency] = useState<number | null>(null);

  // User Profile & Auth Modal State
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // QR Camera Bridge State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);

  // Meta SAM 3.1 Page Segmentation State (Used when scanning/uploading into Learn or inside Judge Mode)
  const [activeExamImage, setActiveExamImage] = useState<string | null>(null);
  const [samSegments, setSamSegments] = useState<SAMSegment[]>([]);
  const [samLoading, setSamLoading] = useState<boolean>(false);
  const [selectedSegment, setSelectedSegment] = useState<SAMSegment | null>(null);
  const [croppedSegmentUri, setCroppedSegmentUri] = useState<string | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persisted Settings & Theme State
  const [themeMode, setThemeMode] = useState<ThemeMode>(DEFAULT_PREFERENCES.themeMode);
  const [resolvedDark, setResolvedDark] = useState<boolean>(false);
  const [pedagogicalLevel, setPedagogicalLevel] = useState<PedagogicalLevel>(
    DEFAULT_PREFERENCES.pedagogicalLevel
  );
  const [languageMode, setLanguageMode] = useState<LanguageMode>(DEFAULT_PREFERENCES.languageMode);
  const [speechRate, setSpeechRate] = useState<number>(DEFAULT_PREFERENCES.speechRate);
  const [autoExpandTelemetry, setAutoExpandTelemetry] = useState<boolean>(
    DEFAULT_PREFERENCES.autoExpandTelemetry
  );
  const [showExaminerWarnings, setShowExaminerWarnings] = useState<boolean>(
    DEFAULT_PREFERENCES.showExaminerWarnings
  );
  const [settingsSavedBanner, setSettingsSavedBanner] = useState<boolean>(false);

  // Learn Page (Meta Muse Spark 1.3 + SymPy Tool-Loop) State
  const [aiSolution, setAiSolution] = useState<PedagogicalSolution | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryEvent | null>(null);
  const [transcribeLoading, setTranscribeLoading] = useState<boolean>(false);
  const [museTestEquation, setMuseTestEquation] = useState<string>('3x^2 - 5x - 2 = 0');

  // Deterministic Solver State (For Judge Mode Benchmark)
  const [equationInput, setEquationInput] = useState<string>('3x^2 - 5x - 2 = 0');
  const [solveResult, setSolveResult] = useState<SolveResponse | null>(null);
  const [solveLoading, setSolveLoading] = useState<boolean>(false);
  const [solveLatency, setSolveLatency] = useState<number | null>(null);

  // Practice Page (Step Verifier & Handwritten Grader) State
  const [originalProblem, setOriginalProblem] = useState<string>('3x^2 - 5x - 2 = 0');
  const [studentSteps, setStudentSteps] = useState<string[]>([
    '3x^2 - 6x + x - 2 = 0',
    '3x(x - 2) + 1(x - 2) = 0',
    '(3x + 1)(x - 2) = 0',
  ]);
  const [verifyResult, setVerifyResult] = useState<VerifyStepsResponse | null>(null);
  const [verifyLoading, setVerifyLoading] = useState<boolean>(false);

  // Red-Pen Handwritten Grader State
  const [handwritingResult, setHandwritingResult] = useState<GradeHandwritingResponse>(() => {
    const fixture = getFlawedStudentNotebookFixture();
    return {
      success: true,
      model: 'Meta Muse Spark 1.3 & Deterministic SymPy CAS',
      isFullyCorrect: fixture.isFullyCorrect,
      totalLines: fixture.lines.length,
      validLineCount: 1,
      firstErrorIndex: 2,
      waecScoreEarned: fixture.waecScoreEarned,
      waecScoreTotal: fixture.waecScoreTotal,
      lines: fixture.lines,
      pedagogicalSummary: fixture.pedagogicalSummary,
      imageUrl: fixture.svgDataUri,
      durationMs: 42,
    };
  });
  const [handwritingLoading, setHandwritingLoading] = useState<boolean>(false);

  // Hackathon Judge Architecture Drawer State
  const [isJudgeDrawerOpen, setIsJudgeDrawerOpen] = useState<boolean>(false);

  // Apply theme mode to <html> element and keep resolvedDark synchronized
  const applyDomTheme = useCallback((mode: ThemeMode) => {
    if (typeof window === 'undefined') return;
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = mode === 'dark' || (mode === 'system' && isSystemDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
    setResolvedDark(shouldBeDark);
  }, []);

  // Check Engine Health & Fetch User Profile
  const checkEngineHealth = useCallback(async () => {
    setEngineStatus('checking');
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
    } catch (_) {
      setEngineStatus('offline');
    }
  }, []);

  useEffect(() => {
    try {
      const rawPrefs = window.localStorage.getItem(STORAGE_KEY_PREFS);
      if (rawPrefs) {
        const parsed = JSON.parse(rawPrefs) as Partial<AppPreferences>;
        const initialTheme: ThemeMode = parsed.themeMode || 'light';
        setThemeMode(initialTheme);
        applyDomTheme(initialTheme);
        if (parsed.pedagogicalLevel) setPedagogicalLevel(parsed.pedagogicalLevel);
        if (parsed.languageMode) setLanguageMode(parsed.languageMode);
        if (typeof parsed.speechRate === 'number') setSpeechRate(parsed.speechRate);
        if (typeof parsed.autoExpandTelemetry === 'boolean') {
          setAutoExpandTelemetry(parsed.autoExpandTelemetry);
        }
        if (typeof parsed.showExaminerWarnings === 'boolean') {
          setShowExaminerWarnings(parsed.showExaminerWarnings);
        }
      } else {
        applyDomTheme('light');
      }
    } catch (_) {
      applyDomTheme('light');
    }

    checkEngineHealth();

    async function loadUser() {
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
    loadUser();
  }, [checkEngineHealth, applyDomTheme]);

  // Listen for OS theme changes when in 'system' mode
  useEffect(() => {
    if (themeMode !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyDomTheme('system');
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [themeMode, applyDomTheme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  const savePreferences = (next?: Partial<AppPreferences>) => {
    const payload: AppPreferences = {
      themeMode: next?.themeMode ?? themeMode,
      pedagogicalLevel: next?.pedagogicalLevel ?? pedagogicalLevel,
      languageMode: next?.languageMode ?? languageMode,
      speechRate: next?.speechRate ?? speechRate,
      autoExpandTelemetry: next?.autoExpandTelemetry ?? autoExpandTelemetry,
      showExaminerWarnings: next?.showExaminerWarnings ?? showExaminerWarnings,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(payload));
      setSettingsSavedBanner(true);
      setTimeout(() => setSettingsSavedBanner(false), 2500);
    } catch (_) {}
  };

  // 1-Click Light / Dark Mode Toggle
  const handleToggleTheme = () => {
    const nextTheme: ThemeMode = resolvedDark ? 'light' : 'dark';
    setThemeMode(nextTheme);
    applyDomTheme(nextTheme);
    savePreferences({ themeMode: nextTheme });
  };

  const handleSetSpecificTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    applyDomTheme(mode);
    savePreferences({ themeMode: mode });
  };

  const navigateToView = (view: ActiveWorkspaceView) => {
    setActiveView(view);
    setIsMobileMenuOpen(false);
  };

  const segmentExamImage = async (imageUri: string, sampleId?: string) => {
    setSamLoading(true);
    setActiveExamImage(imageUri);
    // Keep user on Judge Mode if they triggered segmentation there; otherwise open in Learn
    setActiveView((prev) => (prev === 'judge-mode' ? 'judge-mode' : 'learn'));
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

  const handleLoadSampleSheet = () => {
    const fixture = getSampleWaecExamSheet();
    setActiveExamImage(fixture.svgDataUri);
    setSamSegments(fixture.segments);
    segmentExamImage(fixture.svgDataUri, 'waec-2024-paper-2');
  };

  const handlePhotoReceived = async (base64Image: string) => {
    try {
      const optimized = await optimizeImage(base64Image);
      segmentExamImage(optimized);
    } catch (_) {
      segmentExamImage(base64Image);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await optimizeImage(file);
      segmentExamImage(optimized);
    } catch (err) {
      console.error('File optimization error:', err);
    } finally {
      e.target.value = '';
    }
  };

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

  const handleConfirmAndSolve = (verifiedEquation: string, croppedBase64: string) => {
    setIsVerificationModalOpen(false);
    setMuseTestEquation(verifiedEquation);
    runMultimodalSolve(croppedBase64, verifiedEquation);
  };

  const runMultimodalSolve = async (
    imageData: string,
    verifiedEquation?: string,
    targetLevel?: PedagogicalLevel,
    targetLang?: LanguageMode
  ) => {
    setTranscribeLoading(true);
    try {
      const res = await fetch('/api/math/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageData,
          pedagogicalLevel: targetLevel || pedagogicalLevel,
          languageMode: targetLang || languageMode,
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

  const handleSolve = async () => {
    setSolveLoading(true);
    const start = performance.now();
    try {
      const res = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equation: equationInput, solveFor: 'x' }),
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

  const handleVerify = async () => {
    setVerifyLoading(true);
    try {
      const res = await fetch('/api/verify-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalProblem,
          steps: studentSteps.filter((s) => s.trim().length > 0),
          solveFor: 'x',
        }),
      });
      const data = await res.json();
      setVerifyResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setVerifyLoading(false);
    }
  };

  const speakStep = (text: string) => {
    playSpokenMath(text, {
      rate: speechRate,
      language: languageMode,
    });
  };

  const injectMistake = () => {
    setStudentSteps([
      '3x^2 - 6x + x - 2 = 0',
      '3x^2 + 6x + x - 2 = 0',
      '(3x + 1)(x - 2) = 0',
    ]);
  };

  const resetCorrectSteps = () => {
    setStudentSteps([
      '3x^2 - 6x + x - 2 = 0',
      '3x(x - 2) + 1(x - 2) = 0',
      '(3x + 1)(x - 2) = 0',
    ]);
  };

  const handleLoadHandwritingSample = useCallback(async (sampleId: string) => {
    setHandwritingLoading(true);
    try {
      const res = await fetch('/api/math/grade-handwriting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleId }),
      });
      if (res.ok) {
        const data: GradeHandwritingResponse = await res.json();
        setHandwritingResult(data);
      } else {
        const fix =
          sampleId === 'correct_student_notebook_rigorous'
            ? getCorrectStudentNotebookFixture()
            : getFlawedStudentNotebookFixture();
        setHandwritingResult({
          success: true,
          model: 'Meta Muse Spark 1.3 & Deterministic SymPy CAS (Client Fallback)',
          isFullyCorrect: fix.isFullyCorrect,
          totalLines: fix.lines.length,
          validLineCount: fix.lines.filter((l) => l.isMathematicallyValid).length,
          firstErrorIndex: fix.isFullyCorrect
            ? null
            : fix.lines.find((l) => !l.isMathematicallyValid)?.lineIndex ?? 2,
          waecScoreEarned: fix.waecScoreEarned,
          waecScoreTotal: fix.waecScoreTotal,
          lines: fix.lines,
          pedagogicalSummary: fix.pedagogicalSummary,
          imageUrl: fix.svgDataUri,
          durationMs: 45,
        });
      }
    } catch (err) {
      console.error('Failed to grade student handwriting sample:', err);
      const fix = getFlawedStudentNotebookFixture();
      setHandwritingResult({
        success: true,
        model: 'Meta Muse Spark 1.3 & Deterministic SymPy CAS (Client Fallback)',
        isFullyCorrect: fix.isFullyCorrect,
        totalLines: fix.lines.length,
        validLineCount: 1,
        firstErrorIndex: 2,
        waecScoreEarned: fix.waecScoreEarned,
        waecScoreTotal: fix.waecScoreTotal,
        lines: fix.lines,
        pedagogicalSummary: fix.pedagogicalSummary,
        imageUrl: fix.svgDataUri,
        durationMs: 45,
      });
    } finally {
      setHandwritingLoading(false);
    }
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Reorganized Sidebar Navigation: Learn -> Practice -> Judge Mode -> Settings
  const navItems: Array<{
    id: ActiveWorkspaceView;
    label: string;
    headerTitle: string;
    badge?: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }> = [
    {
      id: 'learn',
      label: 'Learn',
      headerTitle: 'Learn with Professor SolvAm',
      badge: 'AI Tutor',
      icon: BookOpen,
      description: 'Step-by-step adaptive WAEC math breakdowns, voice tutor & concept diagrams',
    },
    {
      id: 'practice',
      label: 'Practice',
      headerTitle: 'Practice & WAEC Step Grader',
      badge: 'Drills',
      icon: Award,
      description: 'Practice twin problems and verify your steps line-by-line with SymPy',
    },
    {
      id: 'judge-mode',
      label: 'Judge Mode',
      headerTitle: 'Hackathon Judge Evaluation Suite',
      badge: 'Demo',
      icon: Terminal,
      description: 'All-in-one sandbox for SAM 3.1, Muse Spark 1.3, Red-Pen Grader & SymPy telemetry',
    },
    {
      id: 'settings',
      label: 'Settings',
      headerTitle: 'Workspace & Pedagogy Settings',
      icon: Settings,
      description: 'Configure appearance, pedagogy level, Nigerian Pidgin mode & voice',
    },
  ];

  const activeNavMeta = navItems.find((item) => item.id === activeView) || navItems[0];
  const isUserLoggedIn = Boolean(userProfile && !userProfile.is_guest);

  // ===========================================================================
  // SIDEBAR CONTENT
  // ===========================================================================
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Top Section: Brand + Primary Navigation + Quick Study Shortcuts */}
      <div className="space-y-6">
        {/* Brand Row */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-[#2563eb] flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-[#0f172a] dark:text-[#f8fafc]">
                  SolvAm
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#dbeafe] dark:bg-[#1e3a8a]/50 text-[#1e3a8a] dark:text-[#93c5fd] rounded-[8px]">
                  Copilot
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-[8px] text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc] hover:bg-[#e0f0fe] dark:hover:bg-[#1e293b] transition"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Workspaces Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateToView(item.id)}
                className={`w-full group flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-[8px] text-left text-[13px] transition-all ${
                  isActive
                    ? 'bg-[#e0f0fe] dark:bg-[#1e293b] text-[#0f172a] dark:text-[#f8fafc] font-semibold'
                    : 'text-[#64748b] dark:text-[#94a3b8] font-medium hover:bg-[#e0f0fe]/50 dark:hover:bg-[#1e293b]/60 hover:text-[#2563eb] dark:hover:text-[#60a5fa]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 transition-colors ${
                      isActive
                        ? 'text-[#2563eb] dark:text-[#60a5fa]'
                        : 'text-[#64748b] dark:text-[#94a3b8] group-hover:text-[#2563eb] dark:group-hover:text-[#60a5fa]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded-[8px] flex-shrink-0 ${
                      isActive
                        ? 'bg-[#dbeafe] dark:bg-[#1e3a8a]/60 text-[#1e3a8a] dark:text-[#93c5fd]'
                        : 'bg-white/80 dark:bg-[#0f172a] text-[#64748b] dark:text-[#94a3b8] group-hover:bg-[#dbeafe] dark:group-hover:bg-[#1e3a8a]/50 group-hover:text-[#1e3a8a] dark:group-hover:text-[#93c5fd]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Topic Shortcuts */}
        <div className="pt-4 border-t border-[#e2e8f0] dark:border-[#1e293b] space-y-1.5">
          <div className="flex items-center justify-between px-3.5 pb-1">
            <span className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8]">
              Quick Study Topics
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              const eq = 'x^2 + 5x + 6 = 0';
              setMuseTestEquation(eq);
              navigateToView('learn');
              runMultimodalSolve('mockBase64ImageData', eq);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-[8px] text-xs font-medium text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#60a5fa] hover:bg-[#e0f0fe]/50 dark:hover:bg-[#1e293b]/60 transition text-left"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="truncate">Simple Factoring (x² + 5x + 6 = 0)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const eq = '3x^2 - 5x - 2 = 0';
              setMuseTestEquation(eq);
              navigateToView('learn');
              runMultimodalSolve('mockBase64ImageData', eq);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-[8px] text-xs font-medium text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#60a5fa] hover:bg-[#e0f0fe]/50 dark:hover:bg-[#1e293b]/60 transition text-left"
          >
            <span className="w-2 h-2 rounded-full bg-[#2563eb] flex-shrink-0" />
            <span className="truncate">WAEC 2024 Q1(a) (3x² - 5x - 2 = 0)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              navigateToView('practice');
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-[8px] text-xs font-medium text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#60a5fa] hover:bg-[#e0f0fe]/50 dark:hover:bg-[#1e293b]/60 transition text-left"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
            <span className="truncate">Practice Workbook &amp; Grader</span>
          </button>
        </div>
      </div>

      {/* Bottom Section: Compact Pedagogy Status Card + Profile/Sign-In */}
      <div className="space-y-3 pt-4 mt-6">
        <div className="p-3.5 rounded-[12px] bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#0f172a] dark:text-[#f8fafc]">
              Active Tutor Mode
            </span>
            <button
              type="button"
              onClick={() => navigateToView('settings')}
              className="text-[11px] font-semibold text-[#2563eb] dark:text-[#60a5fa] hover:underline"
            >
              Configure
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/50 text-[10px] font-semibold text-[#1e3a8a] dark:text-[#93c5fd] capitalize">
              {pedagogicalLevel}
            </span>
            <span className="px-2 py-0.5 rounded-[8px] bg-[#f0f5fa] dark:bg-[#1e293b] text-[10px] font-semibold text-[#0f172a] dark:text-[#f8fafc]">
              {languageMode === 'pidgin' ? 'Pidgin 🇳🇬' : 'Standard EN'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#64748b] dark:text-[#94a3b8] pt-2 border-t border-[#e2e8f0] dark:border-[#1e293b]">
            <span className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
              <span>Credits</span>
            </span>
            <span className="font-mono font-semibold text-[#0f172a] dark:text-[#f8fafc]">
              {userProfile ? userProfile.credits : 50}
            </span>
          </div>
        </div>

        {/* Isolated Bottom Profile / Sign-In Control */}
        <div className="pt-2 border-t border-[#e2e8f0] dark:border-[#1e293b]">
          {isUserLoggedIn && userProfile ? (
            <div
              onClick={() => setIsAuthModalOpen(true)}
              className="cursor-pointer group p-2.5 rounded-[12px] hover:bg-[#e0f0fe]/60 dark:hover:bg-[#1e293b] transition flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[#dbeafe] dark:bg-[#1e3a8a]/60 text-[#1e3a8a] dark:text-[#93c5fd] font-bold text-xs flex items-center justify-center flex-shrink-0">
                  {getInitials(userProfile.name)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] truncate">
                    {userProfile.name}
                  </div>
                  <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8] truncate">
                    {userProfile.email || 'candidate@waec.ng'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#dbeafe] dark:bg-[#1e3a8a]/50 text-[#1e3a8a] dark:text-[#93c5fd] rounded-[8px]">
                  Pro
                </span>
                {userProfile.clerkEnabled && (
                  <SignedIn>
                    <UserButton afterSignOutUrl="/" />
                  </SignedIn>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#dbeafe] dark:bg-[#1e3a8a]/50 text-[#1e3a8a] dark:text-[#93c5fd] font-bold text-xs flex items-center justify-center flex-shrink-0">
                    GS
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] truncate">
                      Guest Student
                    </div>
                    <div className="text-[10px] text-[#64748b] dark:text-[#94a3b8] truncate">
                      Unauthenticated
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/50 text-[#1e3a8a] dark:text-[#93c5fd] text-[10px] font-semibold">
                  Free
                </span>
              </div>

              {userProfile?.clerkEnabled ? (
                <SignedOut>
                  <SignInButton mode="modal">
                    <button
                      type="button"
                      className="w-full py-2 px-3 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold rounded-[8px] transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In</span>
                    </button>
                  </SignInButton>
                </SignedOut>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsAuthModalOpen(true);
                  }}
                  className="w-full py-2 px-3 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold rounded-[8px] transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ===========================================================================
  // AI MATH SOLVER OUTPUT CARD (Connects "Learn" directly to "Practice")
  // ===========================================================================
  const renderAiSolutionCard = () => {
    if (!aiSolution) return null;
    return (
      <ScaffoldingSolutionView
        solution={aiSolution}
        pedagogicalLevel={pedagogicalLevel}
        onChangePedagogicalLevel={(lvl) => {
          setPedagogicalLevel(lvl);
          runMultimodalSolve(
            aiSolution.extractedLatex,
            aiSolution.extractedLatex,
            lvl,
            languageMode
          );
        }}
        languageMode={languageMode}
        onChangeLanguageMode={(lang) => {
          setLanguageMode(lang);
          runMultimodalSolve(
            aiSolution.extractedLatex,
            aiSolution.extractedLatex,
            pedagogicalLevel,
            lang
          );
        }}
        speechRate={speechRate}
        showExaminerWarnings={showExaminerWarnings}
        onSolveTwin={(twinEq) => {
          setOriginalProblem(twinEq);
          setStudentSteps(['', '', '']);
          setVerifyResult(null);
          setActiveView('practice');
        }}
        onSeeAnotherExample={(nextEq) => {
          setMuseTestEquation(nextEq);
          setActiveView('learn');
          runMultimodalSolve('mockBase64ImageData', nextEq, pedagogicalLevel, languageMode);
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 180, behavior: 'smooth' });
          }
        }}
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#f4f7fa] dark:bg-[#070b14] p-2 sm:p-5 lg:p-7 transition-colors">
      {/* Hidden Global File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* APP CONTAINER */}
      <div className="max-w-[1440px] mx-auto bg-white dark:bg-[#0f172a] rounded-[16px] border border-[#e2e8f0] dark:border-[#1e293b] shadow-app-shell overflow-hidden min-h-[calc(100vh-3.5rem)] flex flex-col transition-colors">
        {/* TOP WINDOW / APPLICATION HEADER BAR */}
        <header className="bg-white dark:bg-[#0f172a] border-b border-[#e2e8f0] dark:border-[#1e293b] px-5 sm:px-8 py-3.5 flex items-center justify-between gap-4 transition-colors">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-[#1e3a8a] dark:text-[#93c5fd] hover:bg-[#bfdbfe] transition flex-shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="hidden lg:flex items-center gap-1.5 pr-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
            </div>

            <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-[#0f172a] dark:text-[#f8fafc] truncate">
                {activeNavMeta.headerTitle}
              </h1>
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-[#1e3a8a] dark:text-[#93c5fd] text-[11px] font-mono font-semibold">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    engineStatus === 'online'
                      ? 'bg-[#2563eb] dark:bg-[#60a5fa]'
                      : engineStatus === 'checking'
                      ? 'bg-[#2563eb] animate-ping'
                      : 'bg-rose-500'
                  }`}
                />
                <span>SymPy {engineStatus.toUpperCase()}</span>
                {engineLatency !== null && engineStatus === 'online' && (
                  <span className="opacity-80">({engineLatency}ms)</span>
                )}
              </span>
            </div>
          </div>

          {/* Right: Theme Switcher + Upload & Scan Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleToggleTheme}
              className="px-3 py-2 rounded-[8px] bg-[#f0f5fa] dark:bg-[#1e293b] hover:bg-[#dbeafe] dark:hover:bg-[#334155] text-[#1e3a8a] dark:text-[#93c5fd] text-xs font-semibold transition flex items-center gap-1.5"
              title={resolvedDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={resolvedDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {resolvedDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#2563eb]" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-[8px] bg-white dark:bg-[#0b1120] hover:bg-[#f0f5fa] dark:hover:bg-[#1e293b] text-[#0f172a] dark:text-[#f8fafc] border border-[#e2e8f0] dark:border-[#1e293b] text-xs font-semibold transition flex items-center gap-2"
            >
              <Upload className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
              <span>Upload</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCameraModalOpen(true)}
              className="px-4 py-2 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold transition flex items-center gap-2 shadow-sm"
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Scan</span>
            </button>
          </div>
        </header>

        {/* BODY SPLIT: Left Sidebar + Right Main Content Panel */}
        <div className="flex-1 flex flex-col lg:flex-row">
          {/* DESKTOP LEFT SIDEBAR */}
          <aside className="hidden lg:flex lg:w-[272px] lg:flex-shrink-0 bg-[#f0f5fa] dark:bg-[#0b1120] border-r border-[#e2e8f0] dark:border-[#1e293b] p-5 flex-col justify-between transition-colors">
            {renderSidebarContent()}
          </aside>

          {/* MOBILE HAMBURGER DRAWER */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 z-50 lg:hidden flex">
              <div
                className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-sm animate-fadeIn"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <div className="relative z-10 w-72 max-w-[85vw] bg-[#f0f5fa] dark:bg-[#0b1120] h-full p-5 shadow-2xl border-r border-[#e2e8f0] dark:border-[#1e293b] flex flex-col justify-between animate-fadeIn">
                {renderSidebarContent()}
              </div>
            </div>
          )}

          {/* MAIN WORKSPACE CONTENT PANEL */}
          <main className="flex-1 bg-[#ffffff] dark:bg-[#0f172a] p-6 sm:p-8 lg:p-10 flex flex-col justify-between min-w-0 transition-colors">
            <div className="max-w-5xl w-full mx-auto space-y-8">
              {/* =================================================================
                  PAGE 1: LEARN (Standalone Adaptive AI Tutor Page)
                 ================================================================= */}
              {activeView === 'learn' && (
                <div className="space-y-8 animate-fadeIn">
                  {/* If user scanned or uploaded an exam sheet via the top header, display SAM 3.1 segmentation here */}
                  {activeExamImage && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-[#dbeafe]/60 dark:bg-[#1e3a8a]/30 rounded-[10px] border border-[#bfdbfe] dark:border-[#1e3a8a]">
                        <span className="text-xs font-semibold text-[#1e3a8a] dark:text-[#93c5fd] flex items-center gap-2">
                          <Scan className="w-4 h-4 text-[#2563eb]" />
                          <span>Scanned Exam Sheet Active — Tap any highlighted equation to learn its step-by-step solution</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveExamImage(null)}
                          className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          Close Sheet
                        </button>
                      </div>
                      <SamSegmentationCanvas
                        imageUrl={activeExamImage}
                        segments={samSegments}
                        selectedSegmentId={selectedSegment?.id || null}
                        onSelectSegment={handleSelectSegment}
                        isLoading={samLoading}
                      />
                    </div>
                  )}

                  <section className="bg-gradient-to-b from-[#f8fafc] to-[#f0f7ff] dark:from-[#131c2e] dark:to-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[12px] p-6 sm:p-8 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-xs font-semibold text-[#1e3a8a] dark:text-[#93c5fd]">
                          <Sparkles className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
                          <span>Interactive AI Math Tutor • Meta Muse Spark 1.3</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-[#f8fafc] mt-2">
                          Learn Any Math Problem Step-by-Step
                        </h2>
                        <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] mt-1 max-w-2xl leading-[1.6]">
                          Enter an equation below (or scan your paper using the top-right <strong>Scan</strong> button) to get a crystal-clear, zero-hallucination breakdown tailored to your learning level and dialect.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigateToView('practice')}
                        className="px-3.5 py-2 rounded-[8px] bg-white dark:bg-[#0f172a] hover:bg-[#dbeafe] dark:hover:bg-[#1e3a8a]/50 text-[#1e3a8a] dark:text-[#93c5fd] border border-[#e2e8f0] dark:border-[#1e293b] text-xs font-semibold transition flex items-center gap-1.5 self-start sm:self-center shadow-sm"
                      >
                        <Award className="w-3.5 h-3.5 text-[#2563eb]" />
                        <span>Go to Practice</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-7 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] mb-1.5">
                            Enter or Select a Math Equation to Learn
                          </label>
                          <input
                            type="text"
                            value={museTestEquation}
                            onChange={(e) => setMuseTestEquation(e.target.value)}
                            placeholder="e.g. 3x^2 - 5x - 2 = 0"
                            className="w-full bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[8px] px-4 py-3 text-sm font-mono text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                          />
                        </div>

                        <div className="py-5 px-6 bg-white dark:bg-[#0f172a] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] text-center overflow-hidden">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] block mb-1">
                            Equation Preview
                          </span>
                          <div className="w-full text-center py-2 px-1 min-h-[50px] flex items-center justify-center overflow-x-auto overflow-y-hidden max-w-full">
                            <MathDisplay
                              value={museTestEquation || '3x^2 - 5x - 2 = 0'}
                              displayMode
                              className="text-[#0f172a] dark:text-[#f8fafc] font-medium text-sm sm:text-base max-w-full break-words"
                            />
                          </div>
                        </div>

                        {/* Explain Step-by-Step Action Button placed under the equation */}
                        <button
                          type="button"
                          onClick={() =>
                            runMultimodalSolve('mockBase64ImageData', museTestEquation)
                          }
                          disabled={transcribeLoading}
                          className="w-full py-3.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-sm rounded-[10px] transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 active:scale-[0.99]"
                        >
                          {transcribeLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Generating Step-by-Step Lesson...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              <span>Explain Step-by-Step</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Right Column: Examples */}
                      <div className="lg:col-span-5 p-5 bg-white dark:bg-[#0f172a] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] flex flex-col justify-between space-y-3">
                        <div>
                          <span className="text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] flex items-center gap-1.5 mb-2">
                            <BookOpen className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa]" />
                            <span>Examples</span>
                          </span>
                          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-3 leading-[1.5]">
                            Select an example problem below to load it into the solver:
                          </p>
                          <div className="space-y-2">
                            {[
                              { label: 'Simple Factoring: x² + 5x + 6 = 0', eq: 'x^2 + 5x + 6 = 0' },
                              { label: 'WAEC 2024 Q1(a): 3x² - 5x - 2 = 0', eq: '3x^2 - 5x - 2 = 0' },
                              { label: 'Quadratic: 2x² + 5x - 3 = 0', eq: '2x^2 + 5x - 3 = 0' },
                              { label: 'Factorisation: x² - 7x + 10 = 0', eq: 'x^2 - 7x + 10 = 0' },
                            ].map((sample) => {
                              const isSelected = museTestEquation === sample.eq;
                              return (
                                <button
                                  key={sample.eq}
                                  type="button"
                                  onClick={() => setMuseTestEquation(sample.eq)}
                                  className={`w-full p-2.5 rounded-[8px] border text-left text-xs font-semibold transition flex items-center justify-between ${
                                    isSelected
                                      ? 'bg-[#e0f0fe] dark:bg-[#1e293b] border-[#2563eb] text-[#2563eb] dark:text-[#60a5fa] shadow-sm'
                                      : 'bg-[#f8fafc] dark:bg-[#0b1120] hover:bg-[#e0f0fe]/50 dark:hover:bg-[#1e293b]/60 text-[#0f172a] dark:text-[#f8fafc] border-[#e2e8f0] dark:border-[#1e293b]'
                                  }`}
                                >
                                  <span className="truncate">{sample.label}</span>
                                  {isSelected && (
                                    <Check className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa] flex-shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {aiSolution && renderAiSolutionCard()}
                </div>
              )}

              {/* =================================================================
                  PAGE 2: PRACTICE (Interactive Workbook, Twin Drills & Grader)
                 ================================================================= */}
              {activeView === 'practice' && (
                <PracticeWorkspaceView
                  originalProblem={originalProblem}
                  onChangeOriginalProblem={setOriginalProblem}
                  studentSteps={studentSteps}
                  onChangeStudentSteps={setStudentSteps}
                  verifyResult={verifyResult}
                  verifyLoading={verifyLoading}
                  onVerifySteps={handleVerify}
                  onResetCorrectSteps={resetCorrectSteps}
                  onInjectMistake={injectMistake}
                  handwritingResult={handwritingResult}
                  handwritingLoading={handwritingLoading}
                  onLoadHandwritingSample={handleLoadHandwritingSample}
                  latestLearnedSolution={aiSolution}
                  onSendToLearn={(eq) => {
                    setMuseTestEquation(eq);
                    setActiveView('learn');
                    runMultimodalSolve('mockBase64ImageData', eq);
                  }}
                />
              )}

              {/* =================================================================
                  PAGE 3: JUDGE MODE (Dedicated Hackathon Evaluation Suite)
                 ================================================================= */}
              {activeView === 'judge-mode' && (
                <JudgeModeView
                  engineStatus={engineStatus}
                  engineLatency={engineLatency}
                  onOpenTelemetryDrawer={() => setIsJudgeDrawerOpen(true)}
                  activeExamImage={activeExamImage}
                  samSegments={samSegments}
                  samLoading={samLoading}
                  selectedSegmentId={selectedSegment?.id || null}
                  onSelectSegment={handleSelectSegment}
                  onLoadSampleSheet={handleLoadSampleSheet}
                  onOpenUploadDialog={() => fileInputRef.current?.click()}
                  onOpenCameraBridge={() => setIsCameraModalOpen(true)}
                  onTriggerMusePidginDemo={() => {
                    const targetEq = '3x^2 - 5x - 2 = 0';
                    setMuseTestEquation(targetEq);
                    runMultimodalSolve('mockBase64ImageData', targetEq, 'intermediate', 'pidgin');
                  }}
                  transcribeLoading={transcribeLoading}
                  aiSolutionCard={renderAiSolutionCard()}
                  telemetry={telemetry}
                  handwritingResult={handwritingResult}
                  handwritingLoading={handwritingLoading}
                  onLoadHandwritingSample={handleLoadHandwritingSample}
                  equationInput={equationInput}
                  onChangeEquationInput={setEquationInput}
                  solveResult={solveResult}
                  solveLoading={solveLoading}
                  solveLatency={solveLatency}
                  onSolveDeterministic={handleSolve}
                  onNavigateToPractice={(eq) => {
                    setOriginalProblem(eq);
                    setStudentSteps(['', '', '']);
                    setVerifyResult(null);
                    setActiveView('practice');
                  }}
                />
              )}

              {/* =================================================================
                  PAGE 4: SETTINGS (Appearance, Pedagogy, Dialect & Voice)
                 ================================================================= */}
              {activeView === 'settings' && (
                <div className="space-y-6 animate-fadeIn">
                  <section className="bg-gradient-to-b from-[#f8fafc] to-[#f0f7ff] dark:from-[#131c2e] dark:to-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[12px] p-6 sm:p-8 space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-xs font-semibold text-[#1e3a8a] dark:text-[#93c5fd]">
                          <Sliders className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
                          <span>Workspace Configuration</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-[#f8fafc] mt-2">
                          Appearance, Pedagogy &amp; Voice Settings
                        </h2>
                        <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] mt-1 leading-[1.6]">
                          Switch between Light and Dark themes, customize WAEC scaffolding depth, and configure voice narration.
                        </p>
                      </div>

                      {settingsSavedBanner && (
                        <div className="px-4 py-2 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-[#1e3a8a] dark:text-[#93c5fd] text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                          <Check className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa]" />
                          <span>Preferences Saved</span>
                        </div>
                      )}
                    </div>

                    {/* Appearance / Theme Mode Selector Card */}
                    <div className="p-5 rounded-[12px] bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]">
                        {resolvedDark ? (
                          <Moon className="w-4 h-4 text-[#60a5fa]" />
                        ) : (
                          <Sun className="w-4 h-4 text-[#2563eb]" />
                        )}
                        <span>Interface Theme &amp; Appearance</span>
                      </div>
                      <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-[1.6]">
                        Choose between our Corporate White &amp; Light Blue daylight studio or Midnight Obsidian dark mode for late-night exam prep.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        {(
                          [
                            {
                              id: 'light',
                              title: 'Light Mode',
                              desc: 'White & Light Blue corporate studio',
                              icon: Sun,
                            },
                            {
                              id: 'dark',
                              title: 'Dark Mode',
                              desc: 'Midnight Obsidian low-glare canvas',
                              icon: Moon,
                            },
                            {
                              id: 'system',
                              title: 'System Default',
                              desc: 'Automatically match device OS theme',
                              icon: Monitor,
                            },
                          ] as Array<{
                            id: ThemeMode;
                            title: string;
                            desc: string;
                            icon: React.ComponentType<{ className?: string }>;
                          }>
                        ).map((t) => {
                          const Icon = t.icon;
                          const isSelected = themeMode === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => handleSetSpecificTheme(t.id)}
                              className={`p-4 rounded-[8px] border text-left transition flex items-start justify-between gap-3 ${
                                isSelected
                                  ? 'bg-[#e0f0fe] dark:bg-[#1e293b] border-[#2563eb]/50 dark:border-[#3b82f6]/60'
                                  : 'bg-[#f8fafc] dark:bg-[#0b1120] hover:bg-[#f0f5fa] dark:hover:bg-[#1e293b]/50 border-[#e2e8f0] dark:border-[#1e293b]'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs font-bold text-[#0f172a] dark:text-[#f8fafc]">
                                  <Icon className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
                                  <span>{t.title}</span>
                                </div>
                                <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                                  {t.desc}
                                </div>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  isSelected
                                    ? 'bg-[#2563eb] text-white'
                                    : 'border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#0f172a]'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* 1. Pedagogical Scaffolding Level */}
                      <div className="p-5 rounded-[12px] bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] space-y-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]">
                          <Layers className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa]" />
                          <span>Default Pedagogical Scaffolding</span>
                        </div>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-[1.6]">
                          Choose how deeply SolvAm breaks down algebraic steps during exam prep.
                        </p>
                        <div className="space-y-2 pt-1">
                          {(
                            [
                              {
                                id: 'beginner',
                                title: 'Beginner (Foundation Mode)',
                                desc: 'Zero skipped arithmetic, everyday analogies & micro-steps.',
                              },
                              {
                                id: 'intermediate',
                                title: 'Intermediate (SSCE / WAEC Prep Mode)',
                                desc: 'Official WAEC Theory layout with explicit [M1] and [A1] rubric marks.',
                              },
                              {
                                id: 'expert',
                                title: 'Expert (Distinction / A1 Mode)',
                                desc: 'Concise Socratic hints for rapid exam revision.',
                              },
                            ] as Array<{ id: PedagogicalLevel; title: string; desc: string }>
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setPedagogicalLevel(opt.id);
                                savePreferences({ pedagogicalLevel: opt.id });
                              }}
                              className={`w-full text-left p-3.5 rounded-[8px] border transition flex items-start justify-between gap-3 ${
                                pedagogicalLevel === opt.id
                                  ? 'bg-[#e0f0fe] dark:bg-[#1e293b] border-[#2563eb]/40 dark:border-[#3b82f6]/50'
                                  : 'bg-[#f8fafc] dark:bg-[#0b1120] hover:bg-[#f0f5fa] dark:hover:bg-[#1e293b]/50 border-[#e2e8f0] dark:border-[#1e293b]'
                              }`}
                            >
                              <div>
                                <div className="text-xs font-bold text-[#0f172a] dark:text-[#f8fafc]">
                                  {opt.title}
                                </div>
                                <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-0.5 leading-[1.6]">
                                  {opt.desc}
                                </div>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  pedagogicalLevel === opt.id
                                    ? 'bg-[#2563eb] text-white'
                                    : 'border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#0f172a]'
                                }`}
                              >
                                {pedagogicalLevel === opt.id && <Check className="w-3 h-3" />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 2. Language & Voice Narration Settings */}
                      <div className="space-y-6">
                        <div className="p-5 rounded-[12px] bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] space-y-3">
                          <div className="flex items-center gap-2 text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]">
                            <Globe2 className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa]" />
                            <span>Explanation Language Mode</span>
                          </div>
                          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-[1.6]">
                            Switch between Standard WAEC English and relatable Nigerian Pidgin explanations.
                          </p>
                          <div className="grid grid-cols-2 gap-2.5 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setLanguageMode('standard');
                                savePreferences({ languageMode: 'standard' });
                              }}
                              className={`p-3.5 rounded-[8px] border text-left transition ${
                                languageMode === 'standard'
                                  ? 'bg-[#e0f0fe] dark:bg-[#1e293b] border-[#2563eb]/40 dark:border-[#3b82f6]/50'
                                  : 'bg-[#f8fafc] dark:bg-[#0b1120] hover:bg-[#f0f5fa] dark:hover:bg-[#1e293b]/50 border-[#e2e8f0] dark:border-[#1e293b]'
                              }`}
                            >
                              <div className="text-xs font-bold text-[#0f172a] dark:text-[#f8fafc]">
                                Standard English
                              </div>
                              <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                                Formal WAEC terminology
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setLanguageMode('pidgin');
                                savePreferences({ languageMode: 'pidgin' });
                              }}
                              className={`p-3.5 rounded-[8px] border text-left transition ${
                                languageMode === 'pidgin'
                                  ? 'bg-[#e0f0fe] dark:bg-[#1e293b] border-[#2563eb]/40 dark:border-[#3b82f6]/50'
                                  : 'bg-[#f8fafc] dark:bg-[#0b1120] hover:bg-[#f0f5fa] dark:hover:bg-[#1e293b]/50 border-[#e2e8f0] dark:border-[#1e293b]'
                              }`}
                            >
                              <div className="text-xs font-bold text-[#0f172a] dark:text-[#f8fafc]">
                                Nigerian Pidgin 🇳🇬
                              </div>
                              <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                                Relatable local analogies
                              </div>
                            </button>
                          </div>
                        </div>

                        <div className="p-5 rounded-[12px] bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]">
                              <Volume2 className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa]" />
                              <span>Voice Tutor Narration Speed</span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                speakStep(
                                  'Welcome to SolvAm. First, multiply the coefficient of x squared by the constant term.'
                                )
                              }
                              className="px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 hover:bg-[#bfdbfe] dark:hover:bg-[#1e3a8a]/60 text-[#1e3a8a] dark:text-[#93c5fd] text-[11px] font-semibold transition"
                            >
                              Test Voice
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: '0.8x (Slow)', rate: 0.8 },
                              { label: '0.95x (Natural)', rate: 0.95 },
                              { label: '1.15x (Fast)', rate: 1.15 },
                            ].map((sp) => (
                              <button
                                key={sp.rate}
                                type="button"
                                onClick={() => {
                                  setSpeechRate(sp.rate);
                                  savePreferences({ speechRate: sp.rate });
                                }}
                                className={`py-2 rounded-[8px] text-xs font-semibold border transition ${
                                  speechRate === sp.rate
                                    ? 'bg-[#2563eb] text-white border-[#2563eb]'
                                    : 'bg-[#f8fafc] dark:bg-[#0b1120] text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#1e293b] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
                                }`}
                              >
                                {sp.label}
                              </button>
                            ))}
                          </div>

                          <div className="pt-3 border-t border-[#e2e8f0] dark:border-[#1e293b] space-y-2.5">
                            <label className="flex items-center justify-between cursor-pointer">
                              <span className="text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                                Auto-Expand Judge Telemetry HUD on Solve
                              </span>
                              <input
                                type="checkbox"
                                checked={autoExpandTelemetry}
                                onChange={(e) => {
                                  setAutoExpandTelemetry(e.target.checked);
                                  savePreferences({ autoExpandTelemetry: e.target.checked });
                                }}
                                className="w-4 h-4 accent-[#2563eb] rounded"
                              />
                            </label>

                            <label className="flex items-center justify-between cursor-pointer">
                              <span className="text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                                Show WAEC Examiner&apos;s Notes
                              </span>
                              <input
                                type="checkbox"
                                checked={showExaminerWarnings}
                                onChange={(e) => {
                                  setShowExaminerWarnings(e.target.checked);
                                  savePreferences({ showExaminerWarnings: e.target.checked });
                                }}
                                className="w-4 h-4 accent-[#2563eb] rounded"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* System Diagnostics Row */}
                    <div className="p-5 rounded-[12px] bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 flex items-center justify-center text-[#2563eb] dark:text-[#60a5fa]">
                          <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#0f172a] dark:text-[#f8fafc]">
                            Deterministic Python SymPy Engine Status
                          </div>
                          <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-mono">
                            Status:{' '}
                            <strong className="text-[#1e3a8a] dark:text-[#93c5fd]">
                              {engineStatus.toUpperCase()}
                            </strong>{' '}
                            {engineLatency !== null && `• Ping: ${engineLatency}ms`}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={checkEngineHealth}
                        className="px-4 py-2 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 hover:bg-[#bfdbfe] dark:hover:bg-[#1e3a8a]/60 text-[#1e3a8a] dark:text-[#93c5fd] text-xs font-semibold transition flex items-center gap-2 self-start sm:self-center"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Ping Symbolic Service</span>
                      </button>
                    </div>
                  </section>
                </div>
              )}
            </div>

            {/* FOOTER AT THE BOTTOM OF MAIN CONTENT AREA */}
            <div className="max-w-5xl w-full mx-auto pt-10 mt-10 border-t border-[#e2e8f0] dark:border-[#1e293b] space-y-4">
              {activeView !== 'judge-mode' && (
                <TelemetryHud
                  telemetry={telemetry}
                  engineStatus={engineStatus}
                  engineLatency={engineLatency}
                  defaultExpanded={autoExpandTelemetry}
                />
              )}

              <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 text-xs text-[#64748b] dark:text-[#94a3b8]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                    SolvAm Copilot
                  </span>
                  <span>•</span>
                  <span>Meta SAM 3.1 + Muse Spark 1.3 + SymPy AST</span>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => navigateToView('learn')}
                    className="hover:text-[#2563eb] dark:hover:text-[#60a5fa] transition"
                  >
                    Learn
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToView('practice')}
                    className="hover:text-[#2563eb] dark:hover:text-[#60a5fa] transition"
                  >
                    Practice
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToView('judge-mode')}
                    className="hover:text-[#2563eb] dark:hover:text-[#60a5fa] transition"
                  >
                    Judge Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToView('settings')}
                    className="hover:text-[#2563eb] dark:hover:text-[#60a5fa] transition"
                  >
                    Settings
                  </button>
                </div>
              </footer>
            </div>
          </main>
        </div>
      </div>

      {/* QR Camera Bridge Modal */}
      <CameraBridgeModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onPhotoReceived={handlePhotoReceived}
      />

      {/* Equation Verification Modal */}
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

      {/* Student Auth & Profile Modal */}
      <AuthProfileModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        userProfile={userProfile}
        onProfileUpdated={(updated) => setUserProfile(updated)}
      />

      {/* Hackathon Judge Architecture & Telemetry Drawer */}
      <JudgeTelemetryDrawer
        isOpen={isJudgeDrawerOpen}
        onClose={() => setIsJudgeDrawerOpen(false)}
        engineStatus={engineStatus}
        engineLatency={engineLatency}
      />
    </div>
  );
}
