'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import MathDisplay from '@/components/MathDisplay';
import CameraBridgeModal from '@/components/CameraBridgeModal';
import TelemetryHud from '@/components/TelemetryHud';
import SamSegmentationCanvas from '@/components/SamSegmentationCanvas';
import EquationVerificationModal from '@/components/EquationVerificationModal';
import ScaffoldingSolutionView from '@/components/ScaffoldingSolutionView';
import PracticeWorkspaceView from '@/components/PracticeWorkspaceView';
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
  Check,
  Sun,
  Moon,
  Monitor,
  BookOpen,
  ArrowRight,
} from 'lucide-react';

type ActiveWorkspaceView = 'learn' | 'practice' | 'settings';
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

  // Practice Page (Step Verifier & Handwritten Grader) State
  const [originalProblem, setOriginalProblem] = useState<string>('3x^2 - 5x - 2 = 0');
  const [studentSteps, setStudentSteps] = useState<string[]>(['', '', '']);
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
    setActiveView('learn');
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
    if (activeView === 'practice') {
      setHandwritingLoading(true);
      try {
        const res = await fetch('/api/math/grade-handwriting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64Image,
            originalProblem,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setHandwritingResult(data);
        }
      } catch (err) {
        console.error('Camera bridge practice grading error:', err);
      } finally {
        setHandwritingLoading(false);
      }
      return;
    }

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

  const handleVerify = async (
    canvasImageBase64?: string | null,
    inputMode: 'keyboard' | 'pen' | 'split' = 'keyboard'
  ) => {
    const trimmedSteps = studentSteps.filter((s) => s.trim().length > 0);
    const hasCanvasInk = Boolean(canvasImageBase64 && canvasImageBase64.startsWith('data:image/'));

    if (trimmedSteps.length === 0 && !hasCanvasInk) {
      setVerifyResult({
        success: false,
        is_fully_correct: false,
        total_steps: 0,
        valid_step_count: 0,
        first_error_index: null,
        step_analyses: [],
        waec_score_earned: 0,
        waec_score_total: 10,
        pedagogical_summary:
          'Your canvas is currently empty. Please write your working steps on the lines above, draw your solution with the Light Pen / Stylus, or click "Load Sample Working" to see how this problem is solved.',
      });
      return;
    }

    setVerifyLoading(true);
    try {
      const res = await fetch('/api/verify-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalProblem,
          steps: trimmedSteps,
          solveFor: 'x',
          canvasImageBase64,
          inputMode,
        }),
      });
      const data = await res.json();
      if (data && !data.error) {
        setVerifyResult(data);
      }
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
    badge?: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }> = [
    {
      id: 'learn',
      label: 'Learn',
      badge: 'AI Tutor',
      icon: BookOpen,
      description: 'Step-by-step adaptive WAEC math breakdowns, voice tutor & concept diagrams',
    },
    {
      id: 'practice',
      label: 'Practice',
      badge: 'Drills',
      icon: Award,
      description: 'Practice twin problems and verify your steps line-by-line with SymPy',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      description: 'Configure appearance, pedagogy level, Nigerian Pidgin mode & voice',
    },
  ];

  const isUserLoggedIn = Boolean(userProfile && !userProfile.is_guest);

  // ===========================================================================
  // SIDEBAR CONTENT
  // ===========================================================================
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between gap-6 select-none overflow-y-auto">
      {/* Top Section: Primary Navigation */}
      <div className="space-y-3">
        {/* Mobile Menu Close Button */}
        <div className="flex items-center justify-end lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-[10px] text-ink-muted hover:text-ink hover:bg-white/70 dark:hover:bg-surface transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Subtle Section Eyebrow */}
        <div className="px-3 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-brand-ink/60">
          Workspace
        </div>

        {/* Primary Workspaces Navigation */}
        <nav aria-label="Primary" className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateToView(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`group w-full flex items-center justify-between gap-2 h-10 px-3 rounded-[11px] text-left text-[13.5px] transition-all ${
                  isActive
                    ? 'bg-white dark:bg-surface text-ink font-semibold shadow-[0_2px_6px_-1px_rgba(11,26,51,0.08),0_0_0_1px_rgba(37,99,235,0.12)] dark:shadow-[0_0_0_1px_rgb(var(--sidebar-line))]'
                    : 'text-ink-soft font-medium hover:bg-white/60 dark:hover:bg-surface/60 hover:text-ink'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${
                      isActive ? 'text-brand-fg' : 'text-ink-muted group-hover:text-brand-fg'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>

                {item.badge && (
                  <span
                    className={`px-2 py-0.5 text-[10.5px] font-medium rounded-md flex-shrink-0 transition-colors ${
                      isActive
                        ? 'bg-brand-tint text-brand-ink'
                        : 'bg-white/75 dark:bg-surface-sunken text-ink-soft ring-1 ring-inset ring-sidebar-line/70'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Compact Pedagogy Status Card + Profile/Sign-In */}
      <div className="space-y-3">
        <div className="p-3.5 rounded-[16px] bg-white/90 dark:bg-surface/95 backdrop-blur-sm border border-white dark:border-sidebar-line shadow-[0_2px_10px_-3px_rgba(11,26,51,0.06)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] font-semibold text-ink">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              <span>Active Tutor Mode</span>
            </span>
            <button
              type="button"
              onClick={() => navigateToView('settings')}
              className="text-[11.5px] font-medium text-brand-fg hover:underline underline-offset-2"
            >
              Configure
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-brand-tint text-[11px] font-medium text-brand-ink capitalize">
              {pedagogicalLevel}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-surface-sunken text-[11px] font-medium text-ink-soft">
              {languageMode === 'pidgin' ? 'Pidgin 🇳🇬' : 'Standard EN'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[12px] text-ink-muted pt-2.5 border-t border-line">
            <span className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-brand-fg" />
              <span>Credits</span>
            </span>
            <span className="font-semibold tabular-nums text-ink">
              {userProfile ? userProfile.credits : 50}
            </span>
          </div>
        </div>

        {/* Isolated Bottom Profile / Sign-In Control */}
        <div className="pt-3 border-t border-sidebar-line">
          {isUserLoggedIn && userProfile ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setIsAuthModalOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsAuthModalOpen(true);
                }
              }}
              className="cursor-pointer group p-2 -mx-1 rounded-[12px] hover:bg-white/60 dark:hover:bg-surface/60 transition-colors flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-white dark:bg-surface ring-1 ring-sidebar-line text-brand-ink font-semibold text-[12px] flex items-center justify-center flex-shrink-0 shadow-card">
                  {getInitials(userProfile.name)}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-ink truncate">{userProfile.name}</div>
                  <div className="text-[11.5px] text-ink-muted truncate">
                    {userProfile.email || 'candidate@waec.ng'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="px-2 py-0.5 text-[10.5px] font-medium bg-white dark:bg-surface text-brand-ink ring-1 ring-sidebar-line rounded-md">
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
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-white dark:bg-surface ring-1 ring-sidebar-line text-brand-ink font-semibold text-[12px] flex items-center justify-center flex-shrink-0 shadow-card">
                    GS
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-ink truncate">Guest Student</div>
                    <div className="text-[11.5px] text-ink-muted truncate">Unauthenticated</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-surface ring-1 ring-sidebar-line text-brand-ink text-[10.5px] font-medium">
                  Free
                </span>
              </div>

              {userProfile?.clerkEnabled ? (
                <SignedOut>
                  <SignInButton mode="modal">
                    <button
                      type="button"
                      className="w-full h-9 px-3 bg-ink hover:bg-ink/90 dark:bg-brand dark:hover:bg-brand-hover text-white text-[13px] font-medium rounded-[10px] transition-colors flex items-center justify-center gap-2 shadow-card"
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
                  className="w-full h-9 px-3 bg-ink hover:bg-ink/90 dark:bg-brand dark:hover:bg-brand-hover text-white text-[13px] font-medium rounded-[10px] transition-colors flex items-center justify-center gap-2 shadow-card"
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
        originalProblemText={museTestEquation}
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
    <div className="min-h-screen bg-shell transition-colors">
      {/* Hidden Global File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* APP CONTAINER */}
      <div className="max-w-[1680px] mx-auto min-h-screen flex flex-col">
        {/* TOP APPLICATION HEADER BAR */}
        <header className="sticky top-0 z-30 h-16 flex-shrink-0 bg-shell/90 backdrop-blur-md border-b border-line flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-6 transition-colors">
          {/* Left cell shares the sidebar's width so the wordmark aligns with the nav icons below it */}
          <div className="flex items-center gap-2 min-w-0 lg:w-64">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-[10px] text-ink-soft hover:text-ink hover:bg-surface-sunken transition-colors flex-shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-[18px] h-[18px]" />
            </button>

            <span className="font-display text-[19px] font-bold tracking-tight text-ink lg:pl-3">
              SolvAm
            </span>
          </div>

          {/* Right: Theme Switcher + Upload & Scan Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleToggleTheme}
              className="h-9 px-3 rounded-[10px] bg-surface hover:bg-surface-subtle text-ink-soft hover:text-ink border border-line hover:border-line-strong shadow-card text-[13px] font-medium transition-colors flex items-center gap-1.5"
              title={resolvedDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={resolvedDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {resolvedDark ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-brand-fg" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 px-3.5 rounded-[10px] bg-surface hover:bg-surface-subtle text-ink border border-line hover:border-line-strong shadow-card text-[13px] font-medium transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4 text-brand-fg" />
              <span>Upload</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCameraModalOpen(true)}
              className="h-9 px-4 rounded-[10px] bg-brand hover:bg-brand-hover text-white text-[13px] font-medium transition-colors flex items-center gap-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(37_99_235/0.35)]"
            >
              <Scan className="w-4 h-4" />
              <span>Scan</span>
            </button>
          </div>
        </header>

        {/* BODY SPLIT: Floating Light-Blue Sidebar + White Main Content Panel */}
        <div className="flex-1 flex flex-col lg:flex-row lg:gap-4 lg:p-3.5">
          {/* DESKTOP LEFT SIDEBAR */}
          <aside className="hidden lg:flex lg:w-[264px] lg:flex-shrink-0 lg:sticky lg:top-[4.875rem] lg:self-start lg:h-[calc(100vh-5.75rem)] flex-col rounded-[20px] bg-sidebar border border-sidebar-line/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_2px_10px_-4px_rgba(30,64,175,0.06)] p-3.5 transition-colors">
            {renderSidebarContent()}
          </aside>

          {/* MOBILE HAMBURGER DRAWER */}
          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 z-50 lg:hidden flex"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              <div
                className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm animate-fadeIn"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <div className="relative z-10 w-72 max-w-[85vw] m-2 h-[calc(100%-1rem)] rounded-[20px] bg-sidebar border border-sidebar-line/80 p-3.5 shadow-float flex flex-col animate-fadeIn">
                {renderSidebarContent()}
              </div>
            </div>
          )}

          {/* MAIN WORKSPACE CONTENT PANEL */}
          <main className="flex-1 min-w-0 bg-panel px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-8 flex flex-col justify-between transition-colors">
            <div className="max-w-5xl w-full mx-auto space-y-8">
              {/* =================================================================
                  PAGE 1: LEARN (Standalone Adaptive AI Tutor Page)
                 ================================================================= */}
              {activeView === 'learn' && (
                <div className="space-y-8 animate-fadeIn">
                  {/* If user scanned or uploaded an exam sheet via the top header, display SAM 3.1 segmentation here */}
                  {activeExamImage && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-brand-tint/70 rounded-[12px] border border-brand/20">
                        <span className="text-xs font-medium text-brand-ink flex items-center gap-2">
                          <Scan className="w-4 h-4 text-brand-fg" />
                          <span>Scanned Exam Sheet Active — Tap any highlighted equation to learn its step-by-step solution</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveExamImage(null)}
                          className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline"
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

                  <section className="space-y-7">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 pb-6 border-b border-line">
                      <div className="space-y-1.5">
                        <h2 className="text-[24px] sm:text-[26px] leading-tight font-semibold text-ink">
                          Learn Any Math Problem Step-by-Step
                        </h2>
                        <p className="text-sm text-ink-muted max-w-2xl leading-relaxed">
                          Enter an equation below (or scan your paper using the top-right <strong className="font-medium text-ink-soft">Scan</strong> button) to get a crystal-clear, zero-hallucination breakdown tailored to your learning level and dialect.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigateToView('practice')}
                        className="h-9 px-3.5 rounded-[10px] bg-surface hover:bg-surface-subtle text-ink border border-line hover:border-line-strong shadow-card text-[13px] font-medium transition-colors flex items-center gap-2 self-start flex-shrink-0"
                      >
                        <Award className="w-4 h-4 text-brand-fg" />
                        <span>Go to Practice</span>
                        <ArrowRight className="w-3.5 h-3.5 text-ink-muted" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Left Column: Sculpted Double-Well Equation Composer Card */}
                      <div className="lg:col-span-7 p-1.5 rounded-[20px] bg-surface-subtle border border-line/80 shadow-[0_2px_12px_-4px_rgba(11,26,51,0.05)]">
                        <div className="p-5 bg-surface rounded-[15px] border border-line/90 shadow-card space-y-4">
                          <div className="space-y-2">
                            <label htmlFor="learn-equation-input" className="block text-[13px] font-medium text-ink">
                              Enter or Select a Math Equation to Learn
                            </label>
                            <input
                              id="learn-equation-input"
                              type="text"
                              value={museTestEquation}
                              onChange={(e) => setMuseTestEquation(e.target.value)}
                              placeholder="e.g. 3x^2 - 5x - 2 = 0"
                              className="w-full h-11 bg-surface-subtle/60 focus:bg-surface border border-line hover:border-line-strong rounded-[10px] px-3.5 text-sm font-mono text-ink placeholder:text-ink-muted/70 transition-all focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
                            />
                          </div>

                          <div className="py-5 px-6 bg-surface-subtle/80 rounded-[12px] border border-line/80 text-center overflow-hidden min-h-[132px] flex flex-col items-center justify-center">
                            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted block mb-1.5">
                              Equation Preview
                            </span>
                            <div className="w-full text-center py-1 px-1 min-h-[46px] flex items-center justify-center overflow-x-auto overflow-y-hidden max-w-full">
                              <MathDisplay
                                value={museTestEquation || '3x^2 - 5x - 2 = 0'}
                                displayMode
                                className="text-ink font-medium text-base max-w-full break-words"
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
                            className="w-full h-11 bg-brand hover:bg-brand-hover text-white font-medium text-[13.5px] rounded-[11px] transition-all flex items-center justify-center gap-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_2px_4px_rgb(37_99_235/0.25)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.995]"
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
                      </div>

                      {/* Right Column: Sculpted Examples Card with Numbered Step Badges */}
                      <div className="lg:col-span-5 p-1.5 rounded-[20px] bg-surface-subtle border border-line/80 shadow-[0_2px_12px_-4px_rgba(11,26,51,0.05)]">
                        <div className="p-5 bg-surface rounded-[15px] border border-line/90 shadow-card">
                          <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                            <BookOpen className="w-4 h-4 text-brand-fg" />
                            <span>Examples</span>
                          </div>
                          <p className="text-[12.5px] text-ink-muted mt-1 mb-3.5 leading-relaxed">
                            Select an example problem below to load it into the solver:
                          </p>
                          <div className="space-y-1.5">
                            {[
                              { label: 'Simple Factoring: x² + 5x + 6 = 0', eq: 'x^2 + 5x + 6 = 0' },
                              { label: 'WAEC 2024 Q1(a): 3x² - 5x - 2 = 0', eq: '3x^2 - 5x - 2 = 0' },
                              { label: 'Quadratic: 2x² + 5x - 3 = 0', eq: '2x^2 + 5x - 3 = 0' },
                              { label: 'Factorisation: x² - 7x + 10 = 0', eq: 'x^2 - 7x + 10 = 0' },
                            ].map((sample, idx) => {
                              const isSelected = museTestEquation === sample.eq;
                              return (
                                <button
                                  key={sample.eq}
                                  type="button"
                                  onClick={() => setMuseTestEquation(sample.eq)}
                                  aria-pressed={isSelected}
                                  className={`group w-full h-10 px-2.5 rounded-[10px] text-left text-[13px] font-medium transition-all flex items-center justify-between gap-2.5 ${
                                    isSelected
                                      ? 'bg-brand-tint text-brand-ink ring-1 ring-inset ring-brand/25 shadow-[0_1px_2px_rgba(37,99,235,0.06)]'
                                      : 'text-ink hover:bg-surface-subtle border border-transparent hover:border-line'
                                  }`}
                                >
                                  <span className="flex items-center gap-2.5 min-w-0">
                                    <span
                                      className={`w-6 h-6 rounded-[6px] font-mono text-[11px] font-semibold flex items-center justify-center flex-shrink-0 transition-colors ${
                                        isSelected
                                          ? 'bg-brand text-white'
                                          : 'bg-brand-tint/80 text-brand-ink group-hover:bg-brand-tint'
                                      }`}
                                    >
                                      {String(idx + 1).padStart(2, '0')}
                                    </span>
                                    <span className="truncate">{sample.label}</span>
                                  </span>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-brand-fg flex-shrink-0" />}
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
                  onChangeOriginalProblem={(nextProb) => {
                    setOriginalProblem(nextProb);
                    setVerifyResult(null);
                    setStudentSteps(['', '', '']);
                  }}
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
                  onOpenCameraBridge={() => setIsCameraModalOpen(true)}
                />
              )}

              {/* =================================================================
                  PAGE 3: SETTINGS (Appearance, Pedagogy, Dialect & Voice)
                 ================================================================= */}
              {activeView === 'settings' && (
                <div className="space-y-6 animate-fadeIn">
                  <section className="space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-2">
                        <h2 className="text-[26px] sm:text-[28px] leading-tight font-semibold text-ink">
                          Appearance, Pedagogy &amp; Voice Settings
                        </h2>
                        <p className="text-sm text-ink-muted max-w-2xl leading-relaxed">
                          Switch between Light and Dark themes, customize WAEC scaffolding depth, and configure voice narration.
                        </p>
                      </div>

                      {settingsSavedBanner && (
                        <div className="px-4 py-2 rounded-[8px] bg-brand-tint text-brand-ink text-xs font-medium flex items-center gap-2 animate-fadeIn">
                          <Check className="w-4 h-4 text-brand-fg" />
                          <span>Preferences Saved</span>
                        </div>
                      )}
                    </div>

                    {/* Appearance / Theme Mode Selector Card */}
                    <div className="p-5 rounded-2xl bg-surface border border-line shadow-card space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                        {resolvedDark ? (
                          <Moon className="w-4 h-4 text-[#60a5fa]" />
                        ) : (
                          <Sun className="w-4 h-4 text-brand-fg" />
                        )}
                        <span>Interface Theme &amp; Appearance</span>
                      </div>
                      <p className="text-xs text-ink-muted leading-[1.6]">
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
                                  ? 'bg-brand-tint border-brand/40'
                                  : 'bg-surface-subtle hover:bg-surface-sunken/50 border-line'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                                  <Icon className="w-3.5 h-3.5 text-brand-fg" />
                                  <span>{t.title}</span>
                                </div>
                                <div className="text-[11px] text-ink-muted">
                                  {t.desc}
                                </div>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  isSelected
                                    ? 'bg-brand text-white'
                                    : 'border border-line-strong bg-surface'
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
                      <div className="p-5 rounded-2xl bg-surface border border-line shadow-card space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                          <Layers className="w-4 h-4 text-brand-fg" />
                          <span>Default Pedagogical Scaffolding</span>
                        </div>
                        <p className="text-xs text-ink-muted leading-[1.6]">
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
                                  ? 'bg-brand-tint border-brand/40'
                                  : 'bg-surface-subtle hover:bg-surface-sunken/50 border-line'
                              }`}
                            >
                              <div>
                                <div className="text-xs font-semibold text-ink">
                                  {opt.title}
                                </div>
                                <div className="text-[11px] text-ink-muted mt-0.5 leading-[1.6]">
                                  {opt.desc}
                                </div>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  pedagogicalLevel === opt.id
                                    ? 'bg-brand text-white'
                                    : 'border border-line-strong bg-surface'
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
                        <div className="p-5 rounded-2xl bg-surface border border-line shadow-card space-y-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <Globe2 className="w-4 h-4 text-brand-fg" />
                            <span>Explanation Language Mode</span>
                          </div>
                          <p className="text-xs text-ink-muted leading-[1.6]">
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
                                  ? 'bg-brand-tint border-brand/40'
                                  : 'bg-surface-subtle hover:bg-surface-sunken/50 border-line'
                              }`}
                            >
                              <div className="text-xs font-semibold text-ink">
                                Standard English
                              </div>
                              <div className="text-[11px] text-ink-muted mt-0.5">
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
                                  ? 'bg-brand-tint border-brand/40'
                                  : 'bg-surface-subtle hover:bg-surface-sunken/50 border-line'
                              }`}
                            >
                              <div className="text-xs font-semibold text-ink">
                                Nigerian Pidgin 🇳🇬
                              </div>
                              <div className="text-[11px] text-ink-muted mt-0.5">
                                Relatable local analogies
                              </div>
                            </button>
                          </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-surface border border-line shadow-card space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                              <Volume2 className="w-4 h-4 text-brand-fg" />
                              <span>Voice Tutor Narration Speed</span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                speakStep(
                                  'Welcome to SolvAm. First, multiply the coefficient of x squared by the constant term.'
                                )
                              }
                              className="px-2.5 py-1 rounded-[8px] bg-brand-tint hover:bg-brand/15 text-brand-ink text-[11px] font-semibold transition"
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
                                className={`py-2 rounded-[8px] text-xs font-medium border transition ${
                                  speechRate === sp.rate
                                    ? 'bg-brand text-white border-brand'
                                    : 'bg-surface-subtle text-ink-muted border-line hover:text-ink'
                                }`}
                              >
                                {sp.label}
                              </button>
                            ))}
                          </div>

                          <div className="pt-3 border-t border-line space-y-2.5">
                            <label className="flex items-center justify-between cursor-pointer">
                              <span className="text-xs font-medium text-ink">
                                Auto-Expand Telemetry HUD on Solve
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
                              <span className="text-xs font-medium text-ink">
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
                    <div className="p-5 rounded-2xl bg-surface border border-line shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[10px] bg-brand-tint flex items-center justify-center text-brand-fg">
                          <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[13px] font-medium text-ink">
                            Deterministic Python SymPy Engine Status
                          </div>
                          <div className="text-xs text-ink-muted tabular-nums mt-0.5">
                            Status:{' '}
                            <strong className="font-medium text-brand-ink">
                              {engineStatus.toUpperCase()}
                            </strong>{' '}
                            {engineLatency !== null && `• Ping: ${engineLatency}ms`}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={checkEngineHealth}
                        className="h-9 px-4 rounded-[10px] bg-brand-tint hover:bg-brand/15 text-brand-ink text-[13px] font-medium transition-colors flex items-center gap-2 self-start sm:self-center"
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
            <div className="max-w-5xl w-full mx-auto pt-14 space-y-5">
              <TelemetryHud
                telemetry={telemetry}
                engineStatus={engineStatus}
                engineLatency={engineLatency}
                defaultExpanded={autoExpandTelemetry}
              />

              <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-5 border-t border-line text-xs text-ink-muted">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">SolvAm Copilot</span>
                  <span aria-hidden="true">•</span>
                  <span>Meta SAM 3.1 + Muse Spark 1.3 + SymPy AST</span>
                </div>

                <nav aria-label="Footer" className="flex flex-wrap items-center gap-5">
                  <button
                    type="button"
                    onClick={() => navigateToView('learn')}
                    className="font-medium hover:text-ink transition-colors"
                  >
                    Learn
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToView('practice')}
                    className="font-medium hover:text-ink transition-colors"
                  >
                    Practice
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToView('settings')}
                    className="font-medium hover:text-ink transition-colors"
                  >
                    Settings
                  </button>
                </nav>
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
    </div>
  );
}
