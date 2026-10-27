/**
 * Type definitions for SolvAm AI Gateway & Provider Abstractions.
 * Strict typing for multimodal perception, neuro-symbolic tool calling, and telemetry.
 */

import { SolveResponse, GenerateTwinResponse, VerifyStepsResponse } from '@solvam/shared-types';

export type PedagogicalLevel = 'beginner' | 'intermediate' | 'expert';
export type LanguageMode = 'standard' | 'pidgin';

export interface ToolCallTelemetry {
  toolName: string;
  arguments: Record<string, any>;
  result: Record<string, any>;
  durationMs: number;
}

export interface TelemetryEvent {
  timestamp: number;
  model: string;
  operation: string;
  latencyMs: number;
  toolCalls: ToolCallTelemetry[];
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ScaffoldingStep {
  stepNumber: number;
  explanation: string;
  mathLatex: string;
  waecMark: 'M1' | 'A1' | 'B1' | 'M0';
  commonPitfall?: string;
  audioNarration?: string;
}

export interface PedagogicalSolution {
  topic: string;
  difficultyLevel: PedagogicalLevel;
  languageMode: LanguageMode;
  extractedLatex: string;
  confidence: number;
  discriminantSummary?: string;
  steps: ScaffoldingStep[];
  finalAnswerLatex: string;
  twinPracticeProblem?: GenerateTwinResponse;
  symbolicProof?: SolveResponse;
}

export interface TranscriptionAndSolveResult {
  success: boolean;
  solution: PedagogicalSolution;
  telemetry: TelemetryEvent;
  error?: string;
}

export interface IMathVisionProvider {
  name: string;
  transcribeAndSolve(
    imageBase64: string,
    level?: PedagogicalLevel,
    language?: LanguageMode
  ): Promise<TranscriptionAndSolveResult>;
}
