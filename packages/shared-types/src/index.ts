/**
 * Shared Type Definitions for SolvAm
 * Neuro-Symbolic Math Tutor & WAEC Rubric Grader
 */

export type PedagogicalLevel = 'beginner' | 'intermediate' | 'expert';
export type LanguageMode = 'standard' | 'pidgin';
export type WAECMark = 'M1' | 'A1' | 'B1' | 'M0';

export interface BoundingBox {
  yMin: number;
  xMin: number;
  yMax: number;
  xMax: number;
}

export interface SAMSegment {
  id: string;
  label: string;
  boundingBox: BoundingBox;
  confidence: number;
  latexPreview?: string;
}

export interface SolveRequest {
  equation: string;
  solve_for?: string;
  operation?: 'solve' | 'simplify' | 'differentiate' | 'integrate' | 'evaluate';
  extra_args?: Record<string, any>;
}

export interface SolveResponse {
  success: boolean;
  equation: string;
  latex_equation: string;
  solution_latex: string;
  numerical_roots: number[];
  discriminant?: number | null;
  factored_latex?: string | null;
  milestones: Record<string, any>;
  operation: string;
  topic_label: string;
  error?: string | null;
}

export interface VerifyStepItem {
  step_index: number;
  raw_text: string;
  latex: string;
  is_mathematically_valid: boolean;
  waec_mark: WAECMark;
  feedback?: string | null;
}

export interface HandwrittenGradedLine {
  lineIndex: number;
  boundingBox: BoundingBox;
  rawText: string;
  latex: string;
  isMathematicallyValid: boolean;
  waecMark: WAECMark;
  feedback?: string | null;
  errorType?: 'sign_error' | 'expansion_error' | 'arithmetic_slip' | 'root_inversion' | 'unknown' | null;
}

export interface GradeHandwritingResponse {
  success: boolean;
  model: string;
  isFullyCorrect: boolean;
  totalLines: number;
  validLineCount: number;
  firstErrorIndex?: number | null;
  waecScoreEarned: number;
  waecScoreTotal: number;
  lines: HandwrittenGradedLine[];
  pedagogicalSummary: string;
  durationMs: number;
  imageUrl?: string;
  error?: string | null;
}

export interface VerifyStepsRequest {
  original_problem: string;
  steps: string[];
  solve_for?: string;
}

export interface VerifyStepsResponse {
  success: boolean;
  is_fully_correct: boolean;
  total_steps: number;
  valid_step_count: number;
  first_error_index?: number | null;
  step_analyses: VerifyStepItem[];
  waec_score_earned: number;
  waec_score_total: number;
  pedagogical_summary: string;
  error?: string | null;
}

export interface GenerateTwinRequest {
  equation: string;
  topic?: string;
  constraints?: {
    integer_roots_only?: boolean;
    real_roots_only?: boolean;
  };
}

export interface GenerateTwinResponse {
  success: boolean;
  original_equation: string;
  twin_equation: string;
  twin_equation_latex: string;
  correct_answer_latex: string;
  solution_steps: string[];
  parameters: Record<string, any>;
  error?: string | null;
}

export interface PedagogicalStep {
  stepNumber: number;
  explanation: string;
  mathLatex: string;
  waecMarkLabel: WAECMark;
  audioNarrationText: string;
  commonPitfall?: string;
}

export interface AdaptiveSolution {
  originalImageBase64?: string;
  extractedLatex: string;
  topic: string;
  difficultyLevel: PedagogicalLevel;
  languageMode: LanguageMode;
  discriminantSummary?: string;
  steps: PedagogicalStep[];
  finalAnswerLatex: string;
  twinPracticeProblem?: GenerateTwinResponse;
  diagramImageUrl?: string;
}

export interface TelemetryEvent {
  timestamp: number;
  model: 'SAM 3.1' | 'Muse Spark 1.3' | 'Muse Voice' | 'Muse Image' | 'Deterministic SymPy';
  operation: string;
  latencyMs: number;
  details?: Record<string, any>;
}
