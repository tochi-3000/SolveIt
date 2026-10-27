/**
 * Client for SolvAm Deterministic Symbolic Engine (Python FastAPI).
 * Production Safeguard: Structured error handling, timeout guards, and type validation.
 */

import {
  SolveRequest,
  SolveResponse,
  VerifyStepsRequest,
  VerifyStepsResponse,
  GenerateTwinRequest,
  GenerateTwinResponse
} from '@solvam/shared-types';

const SYMBOLIC_ENGINE_URL = process.env.SYMBOLIC_ENGINE_URL || 'http://localhost:8000';

export async function solveSymbolicEquation(
  equation: string,
  solveFor: string = 'x'
): Promise<SolveResponse> {
  const payload: SolveRequest = {
    equation,
    solve_for: solveFor,
    operation: 'solve'
  };

  try {
    const res = await fetch(`${SYMBOLIC_ENGINE_URL}/symbolic/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000), // 6s timeout guard
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(errData.detail || `Symbolic engine returned ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.error("Symbolic solve failed:", err);
    throw new Error(`Symbolic engine unreachable or failed: ${err.message}`);
  }
}

export async function verifyStudentSteps(
  originalProblem: string,
  steps: string[],
  solveFor: string = 'x'
): Promise<VerifyStepsResponse> {
  const payload: VerifyStepsRequest = {
    original_problem: originalProblem,
    steps,
    solve_for: solveFor
  };

  try {
    const res = await fetch(`${SYMBOLIC_ENGINE_URL}/symbolic/verify-steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(errData.detail || `Step verification returned ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.error("Step verification failed:", err);
    throw new Error(`Step verification service failed: ${err.message}`);
  }
}

export async function generateParametricTwin(
  equation: string,
  topic: string = 'Quadratic Equations'
): Promise<GenerateTwinResponse> {
  const payload: GenerateTwinRequest = {
    equation,
    topic,
    constraints: {
      integer_roots_only: true,
      real_roots_only: true
    }
  };

  try {
    const res = await fetch(`${SYMBOLIC_ENGINE_URL}/symbolic/generate-twin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(errData.detail || `Twin generation returned ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.error("Twin generation failed:", err);
    throw new Error(`Twin generation service failed: ${err.message}`);
  }
}
