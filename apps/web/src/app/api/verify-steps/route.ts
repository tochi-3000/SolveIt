import { NextRequest, NextResponse } from 'next/server';
import { verifyStudentSteps } from '@/lib/symbolicClient';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { originalProblem, steps, solveFor = 'x' } = body;

    if (!originalProblem || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid parameters: requires "originalProblem" and non-empty "steps" array' },
        { status: 400 }
      );
    }

    const result = await verifyStudentSteps(originalProblem, steps, solveFor);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API /api/verify-steps error:', err);
    return NextResponse.json(
      { error: err.message || 'Step verification failed' },
      { status: 500 }
    );
  }
}
