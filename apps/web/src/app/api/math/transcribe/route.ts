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
      provider = 'meta'
    } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "imageBase64" in request body' },
        { status: 400 }
      );
    }

    // Deduct 1 credit for AI vision solve
    await deductCurrentCredits(1);

    const aiProvider = getAIProvider(provider);
    const result = await aiProvider.transcribeAndSolve(imageBase64, pedagogicalLevel, languageMode);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API /api/math/transcribe failed:', err);
    return NextResponse.json(
      { error: err.message || 'Multimodal transcription and reasoning failed' },
      { status: 500 }
    );
  }
}
