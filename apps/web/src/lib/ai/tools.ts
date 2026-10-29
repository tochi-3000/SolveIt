/**
 * Neuro-Symbolic Tools for Meta Muse Spark 1.3
 * Exposes our deterministic Python SymPy engine as native function tools.
 */

import { solveSymbolicEquation, verifyStudentSteps, generateParametricTwin } from '@/lib/symbolicClient';
import { ToolCallTelemetry } from './types';

export const META_MUSE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'sympy_solve_equation',
      description: 'Deterministically solves a mathematical equation using Python SymPy. Calculates exact discriminant, roots, and factored forms without LLM hallucination.',
      parameters: {
        type: 'object',
        properties: {
          equation: {
            type: 'string',
            description: 'The mathematical equation to solve (e.g. "2*x**2 + 5*x - 3 = 0")',
          },
          solve_for: {
            type: 'string',
            description: 'The variable to solve for (defaults to "x")',
          },
        },
        required: ['equation'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sympy_verify_steps',
      description: 'Verifies sequential lines of student handwritten working using SymPy AST equivalence. Returns WAEC marks (M1, A1, M0) and pinpoints error line.',
      parameters: {
        type: 'object',
        properties: {
          original_problem: {
            type: 'string',
            description: 'The original equation being solved',
          },
          steps: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of consecutive mathematical steps written by the student',
          },
          solve_for: {
            type: 'string',
            description: 'Target variable (defaults to "x")',
          },
        },
        required: ['original_problem', 'steps'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sympy_generate_twin',
      description: 'Generates a mathematically verified twin practice problem with integer roots guaranteed.',
      parameters: {
        type: 'object',
        properties: {
          equation: {
            type: 'string',
            description: 'The reference equation to mirror',
          },
          topic: {
            type: 'string',
            description: 'Math topic name',
          },
        },
        required: ['equation'],
      },
    },
  },
];

export async function executeSymbolicTool(
  name: string,
  args: Record<string, any>
): Promise<{ result: any; telemetry: ToolCallTelemetry }> {
  const start = performance.now();
  let result: any;

  try {
    switch (name) {
      case 'sympy_solve_equation':
        result = await solveSymbolicEquation(args.equation, args.solve_for || 'x');
        break;

      case 'sympy_verify_steps':
        result = await verifyStudentSteps(args.original_problem, args.steps || [], args.solve_for || 'x');
        break;

      case 'sympy_generate_twin':
        result = await generateParametricTwin(args.equation, args.topic || 'Quadratic Equations');
        break;

      default:
        result = { error: `Unknown tool invocation: "${name}"` };
    }
  } catch (toolErr: any) {
    console.warn(`[Tool Resiliency] Tool ${name} caught non-fatal execution error:`, toolErr?.message);
    result = {
      success: false,
      error: toolErr?.message || 'Tool execution failed',
      note: 'This equation or word problem could not be parsed directly by SymPy CAS. Proceed to solve analytically using standard WAEC syllabus formulas and step-by-step arithmetic.',
    };
  }

  const durationMs = Math.round(performance.now() - start);

  return {
    result,
    telemetry: {
      toolName: name,
      arguments: args,
      result,
      durationMs,
    },
  };
}
