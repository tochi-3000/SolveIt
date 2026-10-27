import { NextRequest, NextResponse } from 'next/server';
import { solveSymbolicEquation } from '@/lib/symbolicClient';

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
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API /api/solve error:', err);
    return NextResponse.json(
      { error: err.message || 'Symbolic solve computation failed' },
      { status: 500 }
    );
  }
}
