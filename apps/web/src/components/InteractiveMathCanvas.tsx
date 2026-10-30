'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import MathDisplay from './MathDisplay';
import {
  Keyboard,
  PenTool,
  Columns,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Plus,
  Sparkles,
  Maximize2,
  CheckCircle2,
  Lightbulb,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  X,
} from 'lucide-react';

export type CanvasInputMode = 'keyboard' | 'pen' | 'split';

export interface StepHintData {
  stage: 'not_started' | 'on_track' | 'needs_correction' | 'completed';
  progressPercent: number;
  headline: string;
  hintText: string;
  nextActionPrompt: string;
  targetLineIndex: number | null;
  model?: string;
}

interface Point {
  x: number;
  y: number;
  pressure: number;
}

interface Stroke {
  points: Point[];
  color: string;
  size: number;
  isEraser: boolean;
}

interface InteractiveMathCanvasProps {
  originalProblem: string;
  studentSteps: string[];
  onChangeStudentSteps: (steps: string[]) => void;
  onCanvasImageChange?: (dataUrl: string | null, hasInk: boolean) => void;
  onInputModeChange?: (mode: CanvasInputMode) => void;
  onLoadSampleWorking?: () => void;
  onSimulateMistake?: () => void;
  onRequestHint?: () => void;
  hintLoading?: boolean;
  hintData?: StepHintData | null;
  onDismissHint?: () => void;
}

const MATH_TOOLBAR_ITEMS = [
  { label: 'x²', insert: '^2', title: 'Square power (^2)' },
  { label: 'xⁿ', insert: '^', title: 'Exponent (^)' },
  { label: '√', insert: '\\sqrt{}', title: 'Square root' },
  { label: 'a/b', insert: '\\frac{}{}', title: 'Fraction' },
  { label: '×', insert: ' * ', title: 'Multiply' },
  { label: '÷', insert: ' / ', title: 'Divide' },
  { label: '±', insert: ' \\pm ', title: 'Plus or minus' },
  { label: '⇒', insert: ' \\implies ', title: 'Implies arrow' },
  { label: 'Tₙ (AP)', insert: 'T_n = a + (n - 1)d', title: 'Arithmetic Progression n-th term formula' },
  { label: 'Sₙ (AP)', insert: 'S_n = \\frac{n}{2}(2a + (n - 1)d)', title: 'Arithmetic Progression sum formula' },
  { label: 'Tₙ (GP)', insert: 'T_n = a \\cdot r^{n-1}', title: 'Geometric Progression n-th term formula' },
  { label: 'I = PRT/100', insert: 'I = \\frac{P \\times R \\times T}{100}', title: 'Simple Interest formula' },
];

const PEN_COLORS = [
  { id: 'blue', label: 'WAEC Blue Ink', hex: '#1d4ed8' },
  { id: 'black', label: 'Dark Slate Ink', hex: '#0f172a' },
  { id: 'emerald', label: 'Emerald Check', hex: '#059669' },
  { id: 'crimson', label: 'Crimson Note', hex: '#e11d48' },
];

const PEN_SIZES = [
  { id: 'fine', label: 'Fine', size: 2.2 },
  { id: 'medium', label: 'Medium', size: 3.5 },
  { id: 'bold', label: 'Bold', size: 5.5 },
];

export const InteractiveMathCanvas: React.FC<InteractiveMathCanvasProps> = ({
  originalProblem,
  studentSteps,
  onChangeStudentSteps,
  onCanvasImageChange,
  onInputModeChange,
  onLoadSampleWorking,
  onSimulateMistake,
  onRequestHint,
  hintLoading = false,
  hintData = null,
  onDismissHint,
}) => {
  const [inputMode, setInputMode] = useState<CanvasInputMode>('keyboard');
  const [activeLineIdx, setActiveLineIdx] = useState<number>(0);

  // Light-Pen / Stylus Canvas State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const currentStrokeRef = useRef<Stroke | null>(null);

  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0].hex);
  const [penSize, setPenSize] = useState<number>(PEN_SIZES[1].size);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [canvasHeight, setCanvasHeight] = useState<number>(420);
  const [pointerTypeLabel, setPointerTypeLabel] = useState<string>('Ready for Light Pen, Stylus, Mouse, or Touch');

  const lineInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const handleModeSwitch = (mode: CanvasInputMode) => {
    setInputMode(mode);
    onInputModeChange?.(mode);
  };

  /**
   * Renders the ruled notebook background and all vector ink strokes onto the HTML5 canvas.
   */
  const redrawCanvas = useCallback(
    (strokeList: Stroke[], activeStroke?: Stroke | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || 800;
      const height = canvasHeight;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Fill authentic examination paper background (always crisp light ivory/white for high-contrast OCR vision)
      ctx.fillStyle = '#fcfaf5';
      ctx.fillRect(0, 0, width, height);

      // 2. Draw horizontal ruled notebook lines every 42px
      ctx.strokeStyle = '#dbeafe';
      ctx.lineWidth = 1;
      for (let y = 42; y < height; y += 42) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 3. Draw vertical left examination margin line
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(54, 0);
      ctx.lineTo(54, height);
      ctx.stroke();

      // 4. Draw subtle line numbers in the left margin
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 11px monospace';
      let lineNum = 1;
      for (let y = 30; y < height - 10; y += 42) {
        ctx.fillText(String(lineNum).padStart(2, '0'), 18, y);
        lineNum++;
      }

      // 5. Helper to render a smooth quadratic B-spline stroke with pressure modulation
      const drawSingleStroke = (stroke: Stroke) => {
        if (stroke.points.length === 0) return;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = stroke.isEraser ? '#fcfaf5' : stroke.color;

        if (stroke.points.length === 1) {
          const p = stroke.points[0];
          const radius = (stroke.isEraser ? stroke.size * 4 : stroke.size * (0.7 + p.pressure * 0.6)) / 2;
          ctx.fillStyle = stroke.isEraser ? '#fcfaf5' : stroke.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return;
        }

        for (let i = 1; i < stroke.points.length; i++) {
          const p0 = stroke.points[i - 1];
          const p1 = stroke.points[i];
          const midX = (p0.x + p1.x) / 2;
          const midY = (p0.y + p1.y) / 2;

          const avgPressure = (p0.pressure + p1.pressure) / 2;
          ctx.lineWidth = stroke.isEraser
            ? stroke.size * 5
            : Math.max(1.2, stroke.size * (0.65 + avgPressure * 0.7));

          ctx.beginPath();
          if (i === 1) {
            ctx.moveTo(p0.x, p0.y);
          } else {
            const prevMidX = (stroke.points[i - 2].x + p0.x) / 2;
            const prevMidY = (stroke.points[i - 2].y + p0.y) / 2;
            ctx.moveTo(prevMidX, prevMidY);
          }
          ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
          ctx.stroke();
        }
        ctx.restore();
      };

      for (const s of strokeList) {
        drawSingleStroke(s);
      }
      if (activeStroke) {
        drawSingleStroke(activeStroke);
      }

      ctx.restore();
    },
    [canvasHeight]
  );

  // Redraw whenever strokes or canvas dimensions change
  useEffect(() => {
    if (inputMode === 'pen' || inputMode === 'split') {
      redrawCanvas(strokes, currentStrokeRef.current);
    }
  }, [strokes, inputMode, canvasHeight, redrawCanvas]);

  // Export canvas PNG to parent whenever strokes change
  useEffect(() => {
    if (!onCanvasImageChange) return;
    const hasActiveInk = strokes.some((s) => !s.isEraser && s.points.length > 0);
    if (!hasActiveInk || !canvasRef.current) {
      onCanvasImageChange(null, false);
      return;
    }
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      onCanvasImageChange(dataUrl, true);
    } catch {
      onCanvasImageChange(null, false);
    }
  }, [strokes, onCanvasImageChange]);

  // Handle window resize for responsive canvas scaling
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => redrawCanvas(strokes, currentStrokeRef.current);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [strokes, redrawCanvas]);

  // Pointer Events for Light Pen / Stylus / Touch / Mouse
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const pressure = e.pointerType === 'pen' ? Math.max(0.2, e.pressure || 0.5) : 0.5;
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    if (e.pointerType === 'pen') {
      setPointerTypeLabel(`Light Pen / Stylus Active (Pressure: ${Math.round((e.pressure || 0.5) * 100)}%)`);
    } else if (e.pointerType === 'touch') {
      setPointerTypeLabel('Touch Writing Active');
    } else {
      setPointerTypeLabel('Mouse / Trackpad Writing Active');
    }

    const pt = getCanvasPoint(e);
    const newStroke: Stroke = {
      points: [pt],
      color: penColor,
      size: penSize,
      isEraser,
    };
    currentStrokeRef.current = newStroke;
    setIsDrawing(true);
    redrawCanvas(strokes, newStroke);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStrokeRef.current) return;
    e.preventDefault();

    if (e.pointerType === 'pen' && e.pressure > 0) {
      setPointerTypeLabel(`Light Pen / Stylus Active (Pressure: ${Math.round(e.pressure * 100)}%)`);
    }

    const pt = getCanvasPoint(e);
    currentStrokeRef.current.points.push(pt);
    redrawCanvas(strokes, currentStrokeRef.current);
  };

  const finishStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStrokeRef.current) return;
    e.preventDefault();
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore release errors
    }

    const completed = currentStrokeRef.current;
    currentStrokeRef.current = null;
    setIsDrawing(false);
    setStrokes((prev) => [...prev, completed]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setStrokes((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, last]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setStrokes((prev) => [...prev, next]);
  };

  const handleClearCanvas = () => {
    setStrokes([]);
    setRedoStack([]);
    currentStrokeRef.current = null;
  };

  // Keyboard Math Pad Helpers
  const handleInsertSymbol = (snippet: string) => {
    const targetIdx = Math.min(activeLineIdx, Math.max(0, studentSteps.length - 1));
    const inputEl = lineInputRefs.current[targetIdx];
    const currentVal = studentSteps[targetIdx] || '';

    if (inputEl && typeof inputEl.selectionStart === 'number') {
      const start = inputEl.selectionStart;
      const end = inputEl.selectionEnd ?? start;
      const nextVal = currentVal.slice(0, start) + snippet + currentVal.slice(end);
      const updated = [...studentSteps];
      updated[targetIdx] = nextVal;
      onChangeStudentSteps(updated);

      setTimeout(() => {
        inputEl.focus();
        const cursorOffset = snippet.includes('{}') ? snippet.indexOf('{}') + 1 : snippet.length;
        inputEl.setSelectionRange(start + cursorOffset, start + cursorOffset);
      }, 0);
    } else {
      const updated = [...studentSteps];
      updated[targetIdx] = currentVal ? `${currentVal} ${snippet}` : snippet;
      onChangeStudentSteps(updated);
    }
  };

  const handleLineKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (studentSteps.length >= 12) return;
      const updated = [...studentSteps];
      updated.splice(idx + 1, 0, '');
      onChangeStudentSteps(updated);
      setActiveLineIdx(idx + 1);
      setTimeout(() => {
        lineInputRefs.current[idx + 1]?.focus();
      }, 10);
    } else if (e.key === 'Backspace' && !studentSteps[idx] && studentSteps.length > 1) {
      e.preventDefault();
      const updated = studentSteps.filter((_, i) => i !== idx);
      const nextFocus = Math.max(0, idx - 1);
      onChangeStudentSteps(updated);
      setActiveLineIdx(nextFocus);
      setTimeout(() => {
        lineInputRefs.current[nextFocus]?.focus();
      }, 10);
    } else if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault();
      setActiveLineIdx(idx - 1);
      lineInputRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowDown' && idx < studentSteps.length - 1) {
      e.preventDefault();
      setActiveLineIdx(idx + 1);
      lineInputRefs.current[idx + 1]?.focus();
    }
  };

  const handleAddLine = () => {
    if (studentSteps.length >= 12) return;
    const nextIdx = studentSteps.length;
    onChangeStudentSteps([...studentSteps, '']);
    setActiveLineIdx(nextIdx);
    setTimeout(() => {
      lineInputRefs.current[nextIdx]?.focus();
    }, 10);
  };

  const handleRemoveLine = (idx: number) => {
    if (studentSteps.length <= 1) {
      onChangeStudentSteps(['', '', '']);
      return;
    }
    onChangeStudentSteps(studentSteps.filter((_, i) => i !== idx));
  };

  const handleClearAllLines = () => {
    onChangeStudentSteps(['', '', '']);
    setActiveLineIdx(0);
  };

  const hasInkStrokes = strokes.some((s) => !s.isEraser && s.points.length > 0);
  const effectiveSteps = studentSteps && studentSteps.length > 0 ? studentSteps : ['', '', ''];

  return (
    <div className="space-y-4">
      {/* Top Canvas Control Bar: Mode Switcher + Sample Helpers */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-[#e2e8f0] dark:border-[#1e293b]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-[#0f172a] dark:text-[#f8fafc]">
              SolvAm Interactive Math Working Canvas
            </h3>
            {hasInkStrokes && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Handwritten Ink Ready
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-0.5">
            Attempt any equation, word problem, or sequence using your <strong>Keyboard</strong> or a <strong>Light Pen / Stylus</strong>.
          </p>
        </div>

        {/* Mode Selector Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#1e293b] rounded-[10px] shadow-sm">
            <button
              type="button"
              onClick={() => handleModeSwitch('keyboard')}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold transition flex items-center gap-1.5 ${
                inputMode === 'keyboard'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Keyboard Pad</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeSwitch('pen')}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold transition flex items-center gap-1.5 ${
                inputMode === 'pen'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Light Pen / Stylus</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeSwitch('split')}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold transition flex items-center gap-1.5 ${
                inputMode === 'split'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-[#f8fafc]'
              }`}
              title="Use Keyboard and Light Pen side-by-side"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Split Hybrid</span>
            </button>
          </div>

          {onLoadSampleWorking && (
            <button
              type="button"
              onClick={onLoadSampleWorking}
              className="px-3 py-1.5 text-xs font-semibold bg-[#dbeafe] dark:bg-[#1e3a8a]/40 hover:bg-[#bfdbfe] dark:hover:bg-[#1e3a8a]/60 text-[#1e3a8a] dark:text-[#93c5fd] rounded-[8px] transition flex items-center gap-1"
              title="Fill canvas with sample working for this problem"
            >
              <Sparkles className="w-3 h-3 text-[#2563eb] dark:text-[#60a5fa]" />
              <span>Load Sample Working</span>
            </button>
          )}

          {onSimulateMistake && (
            <button
              type="button"
              onClick={onSimulateMistake}
              className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-[#0f172a] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-[#e2e8f0] dark:border-[#1e293b] rounded-[8px] transition"
            >
              Simulate Mistake
            </button>
          )}

          {onRequestHint && (
            <button
              type="button"
              onClick={onRequestHint}
              disabled={hintLoading}
              className="px-3 py-1.5 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 rounded-[8px] transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              title="Get an adaptive Socratic hint tailored to your current working step"
            >
              {hintLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400" />
              ) : (
                <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              )}
              <span>{hintData ? 'Update Hint' : 'Need a Hint?'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Socratic Step Hint Banner */}
      {hintData && (
        <div
          className={`p-4 rounded-[12px] border transition-all animate-fadeIn shadow-sm ${
            hintData.stage === 'needs_correction'
              ? 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900/50 text-[#0f172a] dark:text-[#f8fafc]'
              : hintData.stage === 'completed'
              ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-900/50 text-[#0f172a] dark:text-[#f8fafc]'
              : hintData.stage === 'on_track'
              ? 'bg-[#f0f7ff] dark:bg-[#1e293b]/80 border-[#93c5fd] dark:border-[#1e3a8a] text-[#0f172a] dark:text-[#f8fafc]'
              : 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900/50 text-[#0f172a] dark:text-[#f8fafc]'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div
                className={`w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  hintData.stage === 'needs_correction'
                    ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
                    : hintData.stage === 'completed'
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                    : hintData.stage === 'on_track'
                    ? 'bg-[#dbeafe] dark:bg-[#1e3a8a]/60 text-[#2563eb] dark:text-[#60a5fa]'
                    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                }`}
              >
                {hintData.stage === 'needs_correction' ? (
                  <AlertCircle className="w-4 h-4" />
                ) : hintData.stage === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : hintData.stage === 'on_track' ? (
                  <Sparkles className="w-4 h-4" />
                ) : (
                  <Lightbulb className="w-4 h-4" />
                )}
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      hintData.stage === 'needs_correction'
                        ? 'bg-rose-200/70 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300'
                        : hintData.stage === 'completed'
                        ? 'bg-emerald-200/70 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                        : hintData.stage === 'on_track'
                        ? 'bg-[#bfdbfe] dark:bg-[#1e3a8a] text-[#1e3a8a] dark:text-[#bfdbfe]'
                        : 'bg-amber-200/70 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {hintData.stage === 'needs_correction'
                      ? `⚠️ Check Line ${(hintData.targetLineIndex ?? 0) + 1}`
                      : hintData.stage === 'completed'
                      ? '🎯 Solved!'
                      : hintData.stage === 'on_track'
                      ? `⚡ Step Progress • ${hintData.progressPercent}% Complete`
                      : '🚀 Getting Started'}
                  </span>

                  <h4 className="text-xs sm:text-sm font-bold text-[#0f172a] dark:text-[#f8fafc]">
                    {hintData.headline}
                  </h4>
                </div>

                {/* Progress Bar for on_track / completed */}
                {hintData.progressPercent > 0 && (
                  <div className="w-full max-w-md bg-white dark:bg-[#0b1120] rounded-full h-1.5 overflow-hidden border border-[#e2e8f0] dark:border-[#1e293b]">
                    <div
                      className={`h-full transition-all duration-500 ${
                        hintData.stage === 'completed'
                          ? 'bg-emerald-500'
                          : hintData.stage === 'needs_correction'
                          ? 'bg-amber-500'
                          : 'bg-[#2563eb]'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, hintData.progressPercent))}%` }}
                    />
                  </div>
                )}

                {/* Hint Text formatted with KaTeX */}
                <div className="text-xs sm:text-sm text-[#334155] dark:text-[#cbd5e1] leading-[1.6]">
                  <MathDisplay value={hintData.hintText} inline />
                </div>

                {/* Suggested Next Action */}
                {hintData.nextActionPrompt && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-white/80 dark:bg-[#0b1120]/80 border border-[#e2e8f0] dark:border-[#1e293b] text-[11px] font-medium text-[#1e293b] dark:text-[#e2e8f0]">
                    <ArrowRight className="w-3 h-3 text-[#2563eb] dark:text-[#60a5fa] flex-shrink-0" />
                    <span>Next Action:</span>
                    <strong className="font-semibold text-[#0f172a] dark:text-white">
                      <MathDisplay value={hintData.nextActionPrompt} inline />
                    </strong>
                  </div>
                )}
              </div>
            </div>

            {/* Dismiss Button */}
            {onDismissHint && (
              <button
                type="button"
                onClick={onDismissHint}
                className="p-1 rounded-[6px] hover:bg-black/5 dark:hover:bg-white/10 text-[#64748b] dark:text-[#94a3b8] transition flex-shrink-0"
                title="Dismiss hint"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Canvas Body */}
      <div
        className={`grid gap-6 ${
          inputMode === 'split' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {/* =====================================================================
            PANEL A: KEYBOARD MATH NOTEBOOK PAD
           ===================================================================== */}
        {(inputMode === 'keyboard' || inputMode === 'split') && (
          <div className="bg-white dark:bg-[#0f172a] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] overflow-hidden shadow-sm flex flex-col">
            {/* Quick Math Symbol & WAEC Formula Palette */}
            <div className="p-2.5 bg-[#f8fafc] dark:bg-[#0b1120] border-b border-[#e2e8f0] dark:border-[#1e293b] flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8] px-1.5">
                Math Keys:
              </span>
              {MATH_TOOLBAR_ITEMS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleInsertSymbol(item.insert)}
                  title={item.title}
                  className="px-2.5 py-1 rounded-[6px] bg-white dark:bg-[#0f172a] hover:bg-[#e0f0fe] dark:hover:bg-[#1e3a8a]/50 text-[#0f172a] dark:text-[#f8fafc] border border-[#cbd5e1] dark:border-[#334155] text-xs font-mono font-semibold transition shadow-2xs active:scale-95"
                >
                  {item.label}
                </button>
              ))}

              <button
                type="button"
                onClick={handleClearAllLines}
                className="ml-auto px-2.5 py-1 rounded-[6px] text-[11px] font-semibold text-[#64748b] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition flex items-center gap-1"
                title="Clear all typed lines"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Lines</span>
              </button>
            </div>

            {/* Ruled Notebook Lines */}
            <div className="divide-y divide-[#e2e8f0]/80 dark:divide-[#1e293b] bg-[#fcfaf5] dark:bg-[#0f172a]">
              {effectiveSteps.map((step, idx) => {
                const isFocused = activeLineIdx === idx;
                return (
                  <div
                    key={idx}
                    className={`flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2.5 transition ${
                      isFocused
                        ? 'bg-[#f0f7ff] dark:bg-[#1e293b]/60'
                        : 'hover:bg-[#f8fafc]/80 dark:hover:bg-[#1e293b]/30'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {/* Margin Line Number */}
                      <span
                        className={`w-7 h-7 rounded-[6px] font-mono text-xs flex items-center justify-center font-bold flex-shrink-0 border ${
                          isFocused
                            ? 'bg-[#2563eb] text-white border-[#2563eb]'
                            : 'bg-white dark:bg-[#0b1120] text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#1e293b]'
                        }`}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      {/* Freeform Math / Formula / Step Input */}
                      <input
                        ref={(el) => {
                          lineInputRefs.current[idx] = el;
                        }}
                        type="text"
                        value={step}
                        onFocus={() => setActiveLineIdx(idx)}
                        onKeyDown={(e) => handleLineKeyDown(e, idx)}
                        placeholder={
                          idx === 0
                            ? 'Line 1: Write parameters or formula (e.g. a = 9, d = 4, n = 10 or T_n = a + (n - 1)d)'
                            : idx === 1
                            ? 'Line 2: Substitute numbers & simplify (e.g. T_5 = 9 + (5 - 1)*4 = 25)'
                            : `Line ${idx + 1}: Next working step or final answer (Press Enter for new line)`
                        }
                        onChange={(e) => {
                          const updated = [...effectiveSteps];
                          updated[idx] = e.target.value;
                          onChangeStudentSteps(updated);
                        }}
                        className="flex-1 bg-transparent text-sm font-mono text-[#0f172a] dark:text-[#f8fafc] placeholder-[#94a3b8] dark:placeholder-[#64748b] focus:outline-none min-w-0"
                      />
                    </div>

                    {/* Live KaTeX Preview Pill + Line Delete */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 pl-9 sm:pl-0">
                      {step.trim() ? (
                        <div className="px-3 py-1 bg-white dark:bg-[#0b1120] rounded-[6px] border border-[#e2e8f0] dark:border-[#1e293b] text-xs text-[#0f172a] dark:text-[#f8fafc] max-w-[260px] overflow-x-auto">
                          <MathDisplay value={step} inline />
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#94a3b8] dark:text-[#64748b] italic hidden sm:inline">
                          Live math preview
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="p-1.5 rounded-[6px] text-[#94a3b8] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition flex-shrink-0"
                        title="Remove line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Notebook Footer */}
            <div className="px-4 py-2.5 bg-[#f8fafc] dark:bg-[#0b1120] border-t border-[#e2e8f0] dark:border-[#1e293b] flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleAddLine}
                className="px-3 py-1.5 rounded-[8px] bg-white dark:bg-[#0f172a] hover:bg-[#e0f0fe] dark:hover:bg-[#1e293b] text-[#2563eb] dark:text-[#60a5fa] border border-[#cbd5e1] dark:border-[#334155] text-xs font-semibold transition inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Step Line (or press Enter)</span>
              </button>

              <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                Tip: Write equations, formulas (<code className="font-mono">T_5 = 25</code>), or multi-part steps freely.
              </span>
            </div>
          </div>
        )}

        {/* =====================================================================
            PANEL B: LIGHT PEN / STYLUS INTERACTIVE INK CANVAS
           ===================================================================== */}
        {(inputMode === 'pen' || inputMode === 'split') && (
          <div className="bg-white dark:bg-[#0f172a] rounded-[12px] border border-[#e2e8f0] dark:border-[#1e293b] overflow-hidden shadow-sm flex flex-col">
            {/* Stylus / Light Pen Toolbar */}
            <div className="p-2.5 bg-[#f8fafc] dark:bg-[#0b1120] border-b border-[#e2e8f0] dark:border-[#1e293b] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {/* Pen Colors */}
                <div className="flex items-center gap-1.5 pr-2 border-r border-[#e2e8f0] dark:border-[#1e293b]">
                  {PEN_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setPenColor(c.hex);
                        setIsEraser(false);
                      }}
                      title={c.label}
                      className={`w-6 h-6 rounded-full transition flex items-center justify-center ${
                        !isEraser && penColor === c.hex
                          ? 'ring-2 ring-offset-2 ring-[#2563eb] scale-110'
                          : 'opacity-75 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>

                {/* Stroke Widths */}
                <div className="flex items-center gap-1 pr-2 border-r border-[#e2e8f0] dark:border-[#1e293b]">
                  {PEN_SIZES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setPenSize(s.size);
                        setIsEraser(false);
                      }}
                      className={`px-2 py-1 rounded-[6px] text-[11px] font-semibold transition ${
                        !isEraser && penSize === s.size
                          ? 'bg-[#dbeafe] dark:bg-[#1e3a8a]/60 text-[#1e3a8a] dark:text-[#93c5fd]'
                          : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-white dark:hover:bg-[#0f172a]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Eraser Toggle */}
                <button
                  type="button"
                  onClick={() => setIsEraser((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-[6px] text-xs font-semibold transition flex items-center gap-1 ${
                    isEraser
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'bg-white dark:bg-[#0f172a] text-[#64748b] dark:text-[#94a3b8] border border-[#cbd5e1] dark:border-[#334155]'
                  }`}
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Eraser</span>
                </button>
              </div>

              {/* Undo / Redo / Clear Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={strokes.length === 0}
                  className="p-1.5 rounded-[6px] bg-white dark:bg-[#0f172a] text-[#0f172a] dark:text-[#f8fafc] border border-[#cbd5e1] dark:border-[#334155] disabled:opacity-40 hover:bg-[#e0f0fe] transition"
                  title="Undo last stroke"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="p-1.5 rounded-[6px] bg-white dark:bg-[#0f172a] text-[#0f172a] dark:text-[#f8fafc] border border-[#cbd5e1] dark:border-[#334155] disabled:opacity-40 hover:bg-[#e0f0fe] transition"
                  title="Redo stroke"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleClearCanvas}
                  disabled={strokes.length === 0}
                  className="px-2.5 py-1 rounded-[6px] bg-white dark:bg-[#0f172a] hover:bg-rose-50 text-rose-600 border border-[#cbd5e1] dark:border-[#334155] disabled:opacity-40 text-xs font-semibold transition flex items-center gap-1"
                  title="Clear all ink from canvas"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Ink</span>
                </button>
              </div>
            </div>

            {/* Interactive PointerEvents HTML5 Canvas */}
            <div className="relative w-full overflow-hidden bg-[#fcfaf5]">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishStroke}
                onPointerCancel={finishStroke}
                style={{ height: `${canvasHeight}px`, touchAction: 'none' }}
                className="w-full block cursor-crosshair select-none"
              />

              {strokes.length === 0 && !isDrawing && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                  <div className="w-10 h-10 rounded-full bg-[#dbeafe]/80 flex items-center justify-center mb-2">
                    <PenTool className="w-5 h-5 text-[#2563eb]" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-[#475569]">
                    Write Your Math Steps Here with Light Pen, Stylus, or Mouse
                  </p>
                  <p className="text-[11px] text-[#64748b] max-w-md mt-0.5">
                    Write each step on a new ruled line just like your WAEC answer booklet. Click &ldquo;Grade My Working&rdquo; below when ready!
                  </p>
                </div>
              )}
            </div>

            {/* Canvas Footer: Telemetry & Expand Paper Height */}
            <div className="px-4 py-2 bg-[#f8fafc] dark:bg-[#0b1120] border-t border-[#e2e8f0] dark:border-[#1e293b] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748b] dark:text-[#94a3b8]">
              <span>{pointerTypeLabel}</span>
              <button
                type="button"
                onClick={() => setCanvasHeight((h) => Math.min(900, h + 168))}
                className="text-[#2563eb] dark:text-[#60a5fa] font-semibold hover:underline flex items-center gap-1"
              >
                <Maximize2 className="w-3 h-3" />
                <span>+ Expand Paper Space</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractiveMathCanvas;
