import { NextRequest, NextResponse } from 'next/server';
import { generateParametricTwin } from '@/lib/symbolicClient';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { equation, topic = 'Quadratic Equations' } = body;

    if (!equation || typeof equation !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "equation" parameter' },
        { status: 400 }
      );
    }

    const result = await generateParametricTwin(equation, topic);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API /api/generate-twin error:', err);
    return NextResponse.json(
      { error: err.message || 'Twin generation failed' },
      { status: 500 }
    );
  }
}
