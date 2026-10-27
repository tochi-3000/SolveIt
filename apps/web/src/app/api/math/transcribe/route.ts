import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/gateway';
import { deductCurrentCredits } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      imageBase64, 
      pedagogicalLevel = 'intermediate', 
      languageMode = 'standard',
      provider = 'meta',
      verifiedEquation
    } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "imageBase64" in request body' },
        { status: 400 }
      );
    }

    const aiProvider = getAIProvider(provider);
    const result = await aiProvider.transcribeAndSolve(
      imageBase64, 
      pedagogicalLevel, 
      languageMode,
      verifiedEquation
    );

    // Production Safeguard: Deduct 1 credit only after AI vision solve succeeds
    const remainingCredits = await deductCurrentCredits(1).catch((creditErr) => {
      console.warn('[Credits] Non-fatal error deducting credits:', creditErr);
      return undefined;
    });

    return NextResponse.json({
      ...result,
      remainingCredits,
    });
  } catch (err: any) {
    console.error('API /api/math/transcribe failed:', err);
    return NextResponse.json(
      { error: err.message || 'Multimodal transcription and reasoning failed' },
      { status: 500 }
    );
  }
}
