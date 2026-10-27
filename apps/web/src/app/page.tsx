'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import MathDisplay from '@/components/MathDisplay';
import CameraBridgeModal from '@/components/CameraBridgeModal';
import TelemetryHud from '@/components/TelemetryHud';
import SamSegmentationCanvas from '@/components/SamSegmentationCanvas';
import EquationVerificationModal from '@/components/EquationVerificationModal';
import ScaffoldingSolutionView from '@/components/ScaffoldingSolutionView';
import AuthProfileModal, { UserProfileData } from '@/components/AuthProfileModal';
import { cropImageRegion } from '@/lib/image/crop';
import { optimizeImage } from '@/lib/image/optimizer';
import { playSpokenMath } from '@/lib/audio/mathSpeechNormalizer';
import { getSampleWaecExamSheet } from '@/lib/fixtures/waecExamSheet';
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { SolveResponse, VerifyStepsResponse, SAMSegment } from '@solvam/shared-types';
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
  ChevronRight,
  Sliders,
  Check,
  Info,
  Plus,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';

type ActiveWorkspaceView = 'scanner' | 'solver' | 'muse-spark' | 'settings';
type SolverSubTab = 'equation-solver' | 'red-pen-verifier';
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
  const [activeView, setActiveView] = useState<ActiveWorkspaceView>('scanner');
  const [solverSubTab, setSolverSubTab] = useState<SolverSubTab>('equation-solver');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Engine Health & Latency
  const [engineStatus, setEngineStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [engineLatency, setEngineLatency] = useState<number | null>(null);

  // User Profile & Auth Modal State
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // QR Camera Bridge State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);

  // Phase 3: Meta SAM 3.1 Page Segmentation State
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

  // Multimodal Vision + Tool-Calling State
  const [aiSolution, setAiSolution] = useState<PedagogicalSolution | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryEvent | null>(null);
  const [transcribeLoading, setTranscribeLoading] = useState<boolean>(false);
  const [museTestEquation, setMuseTestEquation] = useState<string>('3x^2 - 5x - 2 = 0');

  // Deterministic Solver State
  const [equationInput, setEquationInput] = useState<string>('3x^2 - 5x - 2 = 0');
  const [solveResult, setSolveResult] = useState<SolveResponse | null>(null);
  const [solveLoading, setSolveLoading] = useState<boolean>(false);
  const [solveLatency, setSolveLatency] = useState<number | null>(null);

  // Step Verifier State
  const [originalProblem, setOriginalProblem] = useState<string>('3x^2 - 5x - 2 = 0');
  const [studentSteps, setStudentSteps] = useState<string[]>([
    '3x^2 - 6x + x - 2 = 0',
    '3x(x - 2) + 1(x - 2) = 0',
    '(3x + 1)(x - 2) = 0',
  ]);
  const [verifyResult, setVerifyResult] = useState<VerifyStepsResponse | null>(null);
  const [verifyLoading, setVerifyLoading] = useState<boolean>(false);

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
    setActiveView('scanner');
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
    setActiveView('scanner');
    segmentExamImage(fixture.svgDataUri, 'waec-2024-paper-2');
  };

  const handlePhotoReceived = async (base64Image: string) => {
    setActiveView('scanner');
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
    setActiveView('scanner');
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
          steps: studentSteps,
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

  const getInitials = (name?: string) => {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Sidebar Navigation Configuration (Items A, B, C, D)
  const navItems: Array<{
    id: ActiveWorkspaceView;
    label: string;
    headerTitle: string;
    badge?: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }> = [
    {
      id: 'scanner',
      label: 'Shazam for Math',
      headerTitle: 'Shazam for Math Exam Page Scanner',
      badge: 'SAM 3.1',
      icon: Scan,
      description: 'Multi-equation WAEC exam page segmentation & visual capture',
    },
    {
      id: 'solver',
      label: 'Deterministic Solver',
      headerTitle: 'Deterministic Symbolic Solver & Step Verifier',
      badge: 'SymPy',
      icon: Calculator,
      description: 'Zero-hallucination symbolic equation solver & Red-Pen step verifier',
    },
    {
      id: 'muse-spark',
      label: 'Muse Spark Tool-Loop',
      headerTitle: 'Meta Muse Spark Tool-Loop Test',
      badge: 'AI Loop',
      icon: Sparkles,
      description: 'Multimodal perception, native tool-calling & WAEC M1/A1 scaffolding',
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
  // SIDEBAR CONTENT (Light Blue Brand Edition + Midnight Obsidian Dark Mode)
  // ===========================================================================
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Top Section: Brand + Navigation + Quick Exam Presets */}
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

        {/* Quick Exam Presets Section */}
        <div className="pt-4 border-t border-[#e2e8f0] dark:border-[#1e293b] space-y-1.5">
          <div className="flex items-center justify-between px-3.5 pb-1">
            <span className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8]">
              WAEC Quick Sheets
            </span>
            <button
              type="button"
              onClick={handleLoadSampleSheet}
              className="text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#60a5fa] transition"
              title="Load 2024 WAEC Exam Paper"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleLoadSampleSheet}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-[8px] text-xs font-medium text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#60a5fa] hover:bg-[#e0f0fe]/50 dark:hover:bg-[#1e293b]/60 transition text-left"
          >
            <span className="w-2 h-2 rounded-full bg-[#2563eb] flex-shrink-0" />
            <span className="truncate">WASSCE 2024 Paper 2</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEquationInput('3x^2 - 5x - 2 = 0');
              setSolverSubTab('equation-solver');
              navigateToView('solver');
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-[8px] text-xs font-medium text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#60a5fa] hover:bg-[#e0f0fe]/50 dark:hover:bg-[#1e293b]/60 transition text-left"
          >
            <span className="w-2 h-2 rounded-full bg-[#3b82f6] flex-shrink-0" />
            <span className="truncate">Quadratic Factorisation</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSolverSubTab('red-pen-verifier');
              navigateToView('solver');
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-[8px] text-xs font-medium text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] dark:hover:text-[#60a5fa] hover:bg-[#e0f0fe]/50 dark:hover:bg-[#1e293b]/60 transition text-left"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="truncate">Red-Pen Rubric Grader</span>
          </button>
        </div>
      </div>

      {/* Bottom Section: Compact Pedagogy Status Card + Isolated Bottom Profile/Sign-In */}
      <div className="space-y-3 pt-4 mt-6">
        {/* Compact Status Card */}
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
  // SINGLE FRAMED INNER CARD FOR AI MATH SOLVER OUTPUT
  // ===========================================================================
  // PHASE 4: Meta Muse Spark 1.3 Adaptive Pedagogy & Scaffolding View
  // ===========================================================================
  const renderAiSolutionCard = () => {
    if (!aiSolution) return null;
    return (
      <ScaffoldingSolutionView
        solution={aiSolution}
        pedagogicalLevel={pedagogicalLevel}
        onChangePedagogicalLevel={(lvl) => {
          setPedagogicalLevel(lvl);
          runMultimodalSolve(aiSolution.extractedLatex, aiSolution.extractedLatex, lvl, languageMode);
        }}
        languageMode={languageMode}
        onChangeLanguageMode={(lang) => {
          setLanguageMode(lang);
          runMultimodalSolve(aiSolution.extractedLatex, aiSolution.extractedLatex, pedagogicalLevel, lang);
        }}
        speechRate={speechRate}
        showExaminerWarnings={showExaminerWarnings}
        onSolveTwin={(twinEq) => {
          setEquationInput(twinEq);
          setActiveView('solver');
          setSolverSubTab('equation-solver');
        }}
      />
    );
  };

  return (
    /* Outermost Canvas (#f4f7fa in Light Mode / #070b14 in Dark Mode) + Centered 1440px Floating App Container */
    <div className="min-h-screen bg-[#f4f7fa] dark:bg-[#070b14] p-2 sm:p-5 lg:p-7 transition-colors">
      {/* Hidden Global File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* APP CONTAINER: max-w-[1440px], rounded-[16px], 1px border, soft drop-shadow */}
      <div className="max-w-[1440px] mx-auto bg-white dark:bg-[#0f172a] rounded-[16px] border border-[#e2e8f0] dark:border-[#1e293b] shadow-app-shell overflow-hidden min-h-[calc(100vh-3.5rem)] flex flex-col transition-colors">
        {/* TOP WINDOW / APPLICATION HEADER BAR */}
        <header className="bg-white dark:bg-[#0f172a] border-b border-[#e2e8f0] dark:border-[#1e293b] px-5 sm:px-8 py-3.5 flex items-center justify-between gap-4 transition-colors">
          {/* Left: Window Dots (Desktop) / Hamburger (Mobile) + Active View Breadcrumb */}
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

          {/* Right: Theme Switcher + Desktop Top-Right Upload & Scan Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            {/* 1-Click Light / Dark Mode Switcher */}
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
              onClick={handleLoadSampleSheet}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 hover:bg-[#bfdbfe] dark:hover:bg-[#1e3a8a]/60 text-[#1e3a8a] dark:text-[#93c5fd] text-xs font-semibold transition"
              title="Load Official WAEC 2024 Exam Sheet"
            >
              <FileText className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
              <span>Sample WAEC Paper</span>
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

        {/* BODY SPLIT: Left Sidebar (#f0f5fa / #0b1120) + Right Main Content Panel (#ffffff / #0f172a) */}
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
          <main className="flex-1 bg-[#ffffff] dark:bg-[#0f172a] p-8 lg:p-10 flex flex-col justify-between min-w-0 transition-colors">
            {/* Primary Workspace Content */}
            <div className="max-w-5xl w-full mx-auto space-y-8">
              {/* =================================================================
                  VIEW A: SHAZAM FOR MATH EXAM PAGE SCANNER
                 ================================================================= */}
              {activeView === 'scanner' && (
                <div className="space-y-8 animate-fadeIn">
                  {/* Top Prompt Bubble Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-end gap-3">
                    <div className="bg-[#f0f5fa] dark:bg-[#0b1120] border border-transparent dark:border-[#1e293b] rounded-[12px] px-5 py-3.5 max-w-md text-xs text-[#0f172a] dark:text-[#f8fafc] leading-[1.6]">
                      Can you segment a multi-problem WAEC mathematics exam paper with Meta SAM 3.1 and verify the step-by-step solution using SymPy?
                    </div>
                    <button
                      type="button"
                      onClick={handleLoadSampleSheet}
                      className="self-end sm:self-center px-3.5 py-2 rounded-[8px] bg-white dark:bg-[#0b1120] hover:bg-[#dbeafe] dark:hover:bg-[#1e293b] text-[#1e3a8a] dark:text-[#93c5fd] border border-[#e2e8f0] dark:border-[#1e293b] text-xs font-semibold transition flex items-center gap-1.5 flex-shrink-0"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
                      <span>Load 2024 WAEC Sheet</span>
                    </button>
                  </div>

                  {/* Editorial Intro & Vertical Numbered Steps */}
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <p className="text-sm text-[#0f172a] dark:text-[#f8fafc] font-medium leading-[1.6]">
                        I can isolate every equation on your exam sheet using <strong>Meta SAM 3.1</strong>, verify exact algebraic roots via our deterministic <strong>Python SymPy AST engine</strong>, and grade each line against official <strong>WAEC M1/A1 marking rubrics</strong>.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="text-xs font-bold text-[#0f172a] dark:text-[#f8fafc] uppercase tracking-wider">
                        Steps:
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-start sm:items-center gap-3.5">
                          <span className="px-2 py-0.5 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/50 text-[#1e3a8a] dark:text-[#93c5fd] font-mono text-xs font-semibold flex-shrink-0">
                            01
                          </span>
                          <span className="text-xs sm:text-sm text-[#0f172a] dark:text-[#e2e8f0] leading-[1.6]">
                            Upload an exam page photo, scan via QR Phone Lens, or load the 1-Click WASSCE 2024 Theory Sheet (auto-compressed &lt;150KB).
                          </span>
                        </div>

                        <div className="flex items-start sm:items-center gap-3.5">
                          <span className="px-2 py-0.5 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/50 text-[#1e3a8a] dark:text-[#93c5fd] font-mono text-xs font-semibold flex-shrink-0">
                            02
                          </span>
                          <span className="text-xs sm:text-sm text-[#0f172a] dark:text-[#e2e8f0] leading-[1.6]">
                            Tap any highlighted SAM 3.1 equation mask on the canvas (or drag a custom region) to confirm the KaTeX formula.
                          </span>
                        </div>

                        <div className="flex items-start sm:items-center gap-3.5">
                          <span className="px-2 py-0.5 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/50 text-[#1e3a8a] dark:text-[#93c5fd] font-mono text-xs font-semibold flex-shrink-0">
                            03
                          </span>
                          <span className="text-xs sm:text-sm text-[#0f172a] dark:text-[#e2e8f0] leading-[1.6]">
                            Review the zero-hallucination WAEC M1/A1 breakdown, listen to voice narration, and generate a parametric Twin Question.
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Inline Metadata Tags */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
                      <span>Active configuration:</span>
                      <span className="px-2.5 py-0.5 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/50 text-[#1e3a8a] dark:text-[#93c5fd] font-semibold capitalize">
                        {pedagogicalLevel} Scaffolding
                      </span>
                      <span className="px-2.5 py-0.5 rounded-[8px] bg-[#f0f5fa] dark:bg-[#1e293b] text-[#0f172a] dark:text-[#f8fafc] font-semibold">
                        {languageMode === 'pidgin' ? 'Nigerian Pidgin 🇳🇬' : 'Standard English'}
                      </span>
                      <span>for WAEC Theory grading.</span>
                    </div>
                  </div>

                  {/* Interactive SAM 3.1 Canvas OR Framed Dropzone Card */}
                  {activeExamImage ? (
                    <SamSegmentationCanvas
                      imageUrl={activeExamImage}
                      segments={samSegments}
                      selectedSegmentId={selectedSegment?.id || null}
                      onSelectSegment={handleSelectSegment}
                      isLoading={samLoading}
                    />
                  ) : (
                    <div className="bg-gradient-to-b from-[#f8fafc] to-[#f0f7ff] dark:from-[#131c2e] dark:to-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[12px] p-8 sm:p-10 text-center space-y-5">
                      <div className="w-14 h-14 mx-auto rounded-[12px] bg-[#dbeafe] dark:bg-[#1e3a8a]/50 text-[#2563eb] dark:text-[#60a5fa] flex items-center justify-center">
                        <Scan className="w-7 h-7" />
                      </div>
                      <div className="space-y-1.5 max-w-lg mx-auto">
                        <h2 className="text-lg font-bold text-[#0f172a] dark:text-[#f8fafc]">
                          Ready to Segment Your WAEC Mathematics Sheet
                        </h2>
                        <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] leading-[1.6]">
                          Load our pre-calibrated WASSCE 2024 Mathematics Theory Paper 2 below to test multi-equation SAM 3.1 segmentation in one click, or upload your own photo.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={handleLoadSampleSheet}
                          className="px-5 py-2.5 rounded-[8px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold transition flex items-center gap-2 shadow-sm"
                        >
                          <FileText className="w-4 h-4" />
                          <span>1-Click WAEC 2024 Exam Sheet</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2.5 rounded-[8px] bg-white dark:bg-[#0f172a] hover:bg-[#dbeafe] dark:hover:bg-[#1e293b] text-[#1e3a8a] dark:text-[#93c5fd] border border-[#e2e8f0] dark:border-[#1e293b] text-xs font-semibold transition flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa]" />
                          <span>Upload Exam Image</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsCameraModalOpen(true)}
                          className="px-4 py-2.5 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/50 hover:bg-[#bfdbfe] dark:hover:bg-[#1e3a8a]/70 text-[#1e3a8a] dark:text-[#93c5fd] text-xs font-semibold transition flex items-center gap-2"
                        >
                          <Scan className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa]" />
                          <span>Pair Phone Camera (QR)</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Single Framed AI Math Solver Output Card */}
                  {renderAiSolutionCard()}
                </div>
              )}

              {/* =================================================================
                  VIEW B: DETERMINISTIC SOLVER (Equation Solver + Red-Pen Verifier)
                 ================================================================= */}
              {activeView === 'solver' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Top Sub-Navigation Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                    <div className="flex items-center gap-1.5 p-1 bg-[#f0f5fa] dark:bg-[#0b1120] rounded-[8px]">
                      <button
                        type="button"
                        onClick={() => setSolverSubTab('equation-solver')}
                        className={`px-4 py-2 rounded-[8px] text-xs font-semibold transition flex items-center gap-2 ${
                          solverSubTab === 'equation-solver'
                            ? 'bg-[#2563eb] text-white shadow-sm'
                            : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
                        }`}
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        <span>Symbolic Equation Solver</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSolverSubTab('red-pen-verifier')}
                        className={`px-4 py-2 rounded-[8px] text-xs font-semibold transition flex items-center gap-2 ${
                          solverSubTab === 'red-pen-verifier'
                            ? 'bg-[#2563eb] text-white shadow-sm'
                            : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
                        }`}
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>&ldquo;Red-Pen&rdquo; Step Verifier (WAEC Rubric)</span>
                      </button>
                    </div>

                    <div className="px-3 py-1.5 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-[#1e3a8a] dark:text-[#93c5fd] text-xs font-mono font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa]" />
                      <span>Zero-Hallucination SymPy AST</span>
                    </div>
                  </div>

                  {solverSubTab === 'equation-solver' ? (
                    /* SUB-TAB 1: SYMBOLIC EQUATION SOLVER */
                    <section className="bg-gradient-to-b from-[#f8fafc] to-[#f0f7ff] dark:from-[#131c2e] dark:to-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[12px] p-6 sm:p-8 space-y-6">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-xs font-semibold text-[#1e3a8a] dark:text-[#93c5fd]">
                          <Calculator className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
                          <span>Deterministic Symbolic Engine</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-[#f8fafc] mt-2">
                          Exact Algebraic Root &amp; Discriminant Solver
                        </h2>
                        <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] mt-1 leading-[1.6]">
                          Enter any WAEC equation. Python SymPy computes exact roots, discriminants ($\Delta = b^2 - 4ac$), and algebraic milestones with 0% LLM arithmetic hallucination.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-7 space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] mb-1.5">
                              Mathematical Equation (LaTeX or Standard Notation)
                            </label>
                            <input
                              type="text"
                              value={equationInput}
                              onChange={(e) => setEquationInput(e.target.value)}
                              placeholder="e.g. 3x^2 - 5x - 2 = 0"
                              className="w-full bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[8px] px-4 py-3 text-sm font-mono text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                            />
                          </div>

                          <div className="py-5 px-6 bg-white dark:bg-[#0f172a] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] text-center min-h-[84px] flex flex-col items-center justify-center">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] mb-1">
                              Live KaTeX Preview
                            </span>
                            <MathDisplay
                              value={equationInput}
                              displayMode
                              className="text-[#0f172a] dark:text-[#f8fafc] font-bold text-lg"
                            />
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8]">
                              WAEC Presets:
                            </span>
                            {[
                              { label: 'Quadratic (3x² - 5x - 2 = 0)', eq: '3x^2 - 5x - 2 = 0' },
                              { label: 'Diff of Squares (x² - 16 = 0)', eq: 'x^2 - 16 = 0' },
                              { label: 'Linear (3x - 12 = 0)', eq: '3x - 12 = 0' },
                              { label: 'Perfect Square (x² - 6x + 9 = 0)', eq: 'x^2 - 6x + 9 = 0' },
                            ].map((preset) => (
                              <button
                                key={preset.eq}
                                type="button"
                                onClick={() => setEquationInput(preset.eq)}
                                className="px-3 py-1.5 bg-[#dbeafe] dark:bg-[#1e3a8a]/40 hover:bg-[#bfdbfe] dark:hover:bg-[#1e3a8a]/60 text-[#1e3a8a] dark:text-[#93c5fd] rounded-[8px] text-xs font-semibold transition"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={handleSolve}
                            disabled={solveLoading}
                            className="w-full py-3 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-xs sm:text-sm rounded-[8px] transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                          >
                            {solveLoading ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <span>Solve Deterministically with SymPy</span>
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </div>

                        <div className="lg:col-span-5">
                          {solveResult ? (
                            <div className="h-full p-6 bg-white dark:bg-[#0f172a] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] space-y-4 flex flex-col justify-between animate-fadeIn">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-xs font-semibold text-[#1e3a8a] dark:text-[#93c5fd]">
                                    {solveResult.topic_label}
                                  </span>
                                  {solveLatency !== null && (
                                    <span className="text-xs font-mono text-[#64748b] dark:text-[#94a3b8]">
                                      {solveLatency}ms
                                    </span>
                                  )}
                                </div>

                                <div className="p-5 bg-[#f8fafc] dark:bg-[#0b1120] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] text-center">
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] mb-1">
                                    Verified Exact Roots
                                  </div>
                                  <MathDisplay
                                    value={solveResult.solution_latex}
                                    displayMode
                                    className="text-[#1e3a8a] dark:text-[#93c5fd] font-bold text-xl"
                                  />
                                </div>

                                {solveResult.discriminant !== null &&
                                  solveResult.discriminant !== undefined && (
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                      <div className="p-3 bg-[#f8fafc] dark:bg-[#0b1120] rounded-[8px] border border-[#e2e8f0] dark:border-[#1e293b]">
                                        <span className="text-[#64748b] dark:text-[#94a3b8] block text-[10px] uppercase font-semibold">
                                          Discriminant (Δ)
                                        </span>
                                        <span className="font-mono font-bold text-base text-[#0f172a] dark:text-[#f8fafc]">
                                          {solveResult.discriminant}
                                        </span>
                                      </div>
                                      <div className="p-3 bg-[#f8fafc] dark:bg-[#0b1120] rounded-[8px] border border-[#e2e8f0] dark:border-[#1e293b]">
                                        <span className="text-[#64748b] dark:text-[#94a3b8] block text-[10px] uppercase font-semibold">
                                          Nature of Roots
                                        </span>
                                        <span className="font-semibold text-[#0f172a] dark:text-[#f8fafc] block mt-0.5">
                                          {solveResult.milestones.nature_of_roots}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                              </div>

                              <div className="pt-3 border-t border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between text-xs text-[#64748b] dark:text-[#94a3b8]">
                                <span>AST Guard: Verified</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMuseTestEquation(equationInput);
                                    setActiveView('muse-spark');
                                  }}
                                  className="font-semibold text-[#2563eb] dark:text-[#60a5fa] hover:underline flex items-center gap-1"
                                >
                                  <span>Generate Step Breakdown</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="h-full min-h-[240px] p-6 bg-white dark:bg-[#0f172a] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] flex flex-col items-center justify-center text-center">
                              <Calculator className="w-8 h-8 text-[#2563eb] dark:text-[#60a5fa] mb-2" />
                              <h3 className="text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]">
                                Ready for Symbolic Computation
                              </h3>
                              <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1 max-w-xs leading-[1.6]">
                                Click &ldquo;Solve Deterministically with SymPy&rdquo; to compute exact roots and discriminants.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  ) : (
                    /* SUB-TAB 2: RED-PEN STEP VERIFIER */
                    <section className="bg-gradient-to-b from-[#f8fafc] to-[#f0f7ff] dark:from-[#131c2e] dark:to-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[12px] p-6 sm:p-8 space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-xs font-semibold text-[#1e3a8a] dark:text-[#93c5fd]">
                            <Award className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
                            <span>WAEC Theory Marking Rubric (M1 / A1)</span>
                          </div>
                          <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-[#f8fafc] mt-2">
                            &ldquo;Red-Pen&rdquo; Step Verifier &amp; Mistake Pinpointer
                          </h2>
                          <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] mt-1 leading-[1.6]">
                            Verifies line-by-line algebraic equivalence using SymPy AST subtraction. Pinpoints the exact line where equivalence breaks while awarding partial Method Marks (`M1`).
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={resetCorrectSteps}
                            className="px-3.5 py-2 text-xs font-semibold bg-[#dbeafe] dark:bg-[#1e3a8a]/40 hover:bg-[#bfdbfe] dark:hover:bg-[#1e3a8a]/60 text-[#1e3a8a] dark:text-[#93c5fd] rounded-[8px] transition"
                          >
                            Load 100% Correct Steps
                          </button>
                          <button
                            type="button"
                            onClick={injectMistake}
                            className="px-3.5 py-2 text-xs font-semibold bg-white dark:bg-[#0f172a] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-[#e2e8f0] dark:border-[#1e293b] rounded-[8px] transition"
                          >
                            Inject Sign Mistake (Line 2)
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] mb-1.5">
                          Original Exam Question:
                        </label>
                        <input
                          type="text"
                          value={originalProblem}
                          onChange={(e) => setOriginalProblem(e.target.value)}
                          className="w-full sm:w-96 bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[8px] px-4 py-2.5 text-sm font-mono text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                          Student&apos;s Sequential Handwritten Working Lines:
                        </div>
                        {studentSteps.map((step, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="w-9 h-9 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-[#1e3a8a] dark:text-[#93c5fd] font-mono text-xs flex items-center justify-center font-semibold flex-shrink-0">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <input
                              type="text"
                              value={step}
                              onChange={(e) => {
                                const updated = [...studentSteps];
                                updated[idx] = e.target.value;
                                setStudentSteps(updated);
                              }}
                              className="flex-1 bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[8px] px-4 py-2.5 text-sm font-mono text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
                            />
                            <div className="w-52 hidden sm:block p-2.5 bg-white dark:bg-[#0f172a] rounded-[8px] text-xs text-[#0f172a] dark:text-[#f8fafc] text-center border border-[#e2e8f0] dark:border-[#1e293b]">
                              <MathDisplay value={step} />
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleVerify}
                        disabled={verifyLoading}
                        className="w-full py-3 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-xs sm:text-sm rounded-[8px] transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                      >
                        {verifyLoading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>Run Line-by-Line WAEC Diagnostic Verification</span>
                          </>
                        )}
                      </button>

                      {verifyResult && (
                        <div className="p-6 bg-white dark:bg-[#0f172a] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] space-y-4 animate-fadeIn">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                            <div>
                              <div className="text-sm font-bold flex items-center gap-2">
                                {verifyResult.is_fully_correct ? (
                                  <span className="flex items-center gap-1.5 text-[#1e3a8a] dark:text-[#93c5fd]">
                                    <CheckCircle2 className="w-5 h-5 text-[#2563eb] dark:text-[#60a5fa]" />
                                    100% Mathematically Rigorous Working
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                                    <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                                    Step-Level Equivalence Break Detected
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1 leading-[1.6]">
                                {verifyResult.pedagogical_summary}
                              </p>
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
                                  <span className="font-mono text-sm text-[#0f172a] dark:text-[#f8fafc] font-semibold">
                                    {sa.raw_text}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-[1.6]">
                                    {sa.feedback}
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
                  )}
                </div>
              )}

              {/* =================================================================
                  VIEW C: META MUSE SPARK TOOL-LOOP TEST
                 ================================================================= */}
              {activeView === 'muse-spark' && (
                <div className="space-y-8 animate-fadeIn">
                  <section className="bg-gradient-to-b from-[#f8fafc] to-[#f0f7ff] dark:from-[#131c2e] dark:to-[#0b1120] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[12px] p-6 sm:p-8 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-xs font-semibold text-[#1e3a8a] dark:text-[#93c5fd]">
                          <Sparkles className="w-3.5 h-3.5 text-[#2563eb] dark:text-[#60a5fa]" />
                          <span>Agentic Orchestration • Meta Muse Spark 1.3</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] dark:text-[#f8fafc] mt-2">
                          Meta Muse Spark Tool-Loop Test Lab
                        </h2>
                        <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] mt-1 max-w-2xl leading-[1.6]">
                          Execute the full Neuro-Symbolic loop: Multimodal Vision transcription &rarr; Native Tool Call (`solve_equation_deterministically` &amp; `generate_parametric_twin_question`) &rarr; WAEC M1/A1 Scaffolding.
                        </p>
                      </div>

                      <span className="px-3 py-1.5 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 text-[#1e3a8a] dark:text-[#93c5fd] text-xs font-mono font-semibold self-start sm:self-center">
                        Native Tool-Call Loop
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-7 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] mb-1.5">
                            Target WAEC Formula for Tool-Loop Execution
                          </label>
                          <input
                            type="text"
                            value={museTestEquation}
                            onChange={(e) => setMuseTestEquation(e.target.value)}
                            placeholder="e.g. 3x^2 - 5x - 2 = 0"
                            className="w-full bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[8px] px-4 py-3 text-sm font-mono text-[#0f172a] dark:text-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb]"
                          />
                        </div>

                        <div className="py-5 px-6 bg-white dark:bg-[#0f172a] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] text-center">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] block mb-1">
                            Rendered Target Equation
                          </span>
                          <MathDisplay
                            value={museTestEquation}
                            displayMode
                            className="text-[#0f172a] dark:text-[#f8fafc] font-bold text-lg"
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {[
                            { label: 'WAEC 2024 Q1(a): 3x² - 5x - 2 = 0', eq: '3x^2 - 5x - 2 = 0' },
                            { label: 'Quadratic: 2x² + 5x - 3 = 0', eq: '2x^2 + 5x - 3 = 0' },
                            { label: 'Factorisation: x² - 7x + 10 = 0', eq: 'x^2 - 7x + 10 = 0' },
                          ].map((sample) => (
                            <button
                              key={sample.eq}
                              type="button"
                              onClick={() => setMuseTestEquation(sample.eq)}
                              className="px-3 py-1.5 rounded-[8px] bg-[#dbeafe] dark:bg-[#1e3a8a]/40 hover:bg-[#bfdbfe] dark:hover:bg-[#1e3a8a]/60 text-[#1e3a8a] dark:text-[#93c5fd] text-xs font-semibold transition"
                            >
                              {sample.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="lg:col-span-5 p-5 bg-white dark:bg-[#0f172a] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] flex flex-col justify-between space-y-4">
                        <div className="space-y-4">
                          <div>
                            <span className="text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] flex items-center gap-1.5 mb-2">
                              <Layers className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa]" />
                              <span>Scaffolding Depth:</span>
                            </span>
                            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#f0f5fa] dark:bg-[#0b1120] rounded-[8px]">
                              {(['beginner', 'intermediate', 'expert'] as PedagogicalLevel[]).map(
                                (lvl) => (
                                  <button
                                    key={lvl}
                                    type="button"
                                    onClick={() => setPedagogicalLevel(lvl)}
                                    className={`py-1.5 rounded-[8px] text-xs font-semibold capitalize transition ${
                                      pedagogicalLevel === lvl
                                        ? 'bg-[#2563eb] text-white shadow-sm'
                                        : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
                                    }`}
                                  >
                                    {lvl}
                                  </button>
                                )
                              )}
                            </div>
                          </div>

                          <div>
                            <span className="text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc] flex items-center gap-1.5 mb-2">
                              <Globe2 className="w-4 h-4 text-[#2563eb] dark:text-[#60a5fa]" />
                              <span>Language Mode:</span>
                            </span>
                            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#f0f5fa] dark:bg-[#0b1120] rounded-[8px]">
                              <button
                                type="button"
                                onClick={() => setLanguageMode('standard')}
                                className={`py-1.5 rounded-[8px] text-xs font-semibold transition ${
                                  languageMode === 'standard'
                                    ? 'bg-[#2563eb] text-white shadow-sm'
                                    : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
                                }`}
                              >
                                Standard English
                              </button>
                              <button
                                type="button"
                                onClick={() => setLanguageMode('pidgin')}
                                className={`py-1.5 rounded-[8px] text-xs font-semibold transition ${
                                  languageMode === 'pidgin'
                                    ? 'bg-[#2563eb] text-white shadow-sm'
                                    : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
                                }`}
                              >
                                Nigerian Pidgin 🇳🇬
                              </button>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            runMultimodalSolve('mockBase64ImageData', museTestEquation)
                          }
                          disabled={transcribeLoading}
                          className="w-full py-3 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-xs sm:text-sm rounded-[8px] transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                        >
                          {transcribeLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Running Tool-Call Loop...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              <span>Trigger Meta Muse Spark Pipeline</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </section>

                  {aiSolution && renderAiSolutionCard()}
                </div>
              )}

              {/* =================================================================
                  VIEW D: SETTINGS PAGE (Including Light / Dark / System Theme Selector)
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

            {/* ISOLATED COLLAPSIBLE TELEMETRY HUD & FOOTER AT THE BOTTOM OF MAIN CONTENT AREA */}
            <div className="max-w-5xl w-full mx-auto pt-10 mt-10 border-t border-[#e2e8f0] dark:border-[#1e293b] space-y-4">
              {/* Collapsible Judge Telemetry HUD & Native Tool Invocations */}
              <TelemetryHud
                telemetry={telemetry}
                engineStatus={engineStatus}
                engineLatency={engineLatency}
                defaultExpanded={autoExpandTelemetry}
              />

              {/* Clean Minimal Workspace Footer */}
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
                    onClick={() => navigateToView('scanner')}
                    className="hover:text-[#2563eb] dark:hover:text-[#60a5fa] transition"
                  >
                    Scanner
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToView('solver')}
                    className="hover:text-[#2563eb] dark:hover:text-[#60a5fa] transition"
                  >
                    Solver
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToView('muse-spark')}
                    className="hover:text-[#2563eb] dark:hover:text-[#60a5fa] transition"
                  >
                    Tool-Loop
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
    </div>
  );
}
