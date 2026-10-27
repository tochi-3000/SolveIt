import { NextRequest, NextResponse } from 'next/server';
import { solveSymbolicEquation } from '@/lib/symbolicClient';
import { deductCurrentCredits } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { equation, solveFor = 'x' } = body;

    if (!equation || typeof equation !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "equation" parameter' },
        { status: 400 }
      );
    }

    const result = await solveSymbolicEquation(equation, solveFor);

    // Production Safeguard: Persist credit deduction in Turso/libSQL only after a successful solve
    const remainingCredits = await deductCurrentCredits(1).catch((creditErr) => {
      console.warn('[Credits] Non-fatal error deducting credits:', creditErr);
      return undefined;
    });

    return NextResponse.json({
      ...result,
      remainingCredits,
    });
  } catch (err: any) {
    console.error('API /api/solve error:', err);
    return NextResponse.json(
      { error: err.message || 'Symbolic solve computation failed' },
      { status: 500 }
    );
  }
}
