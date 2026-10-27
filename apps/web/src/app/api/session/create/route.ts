import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createCameraSession } from '@/lib/db';

export async function POST() {
  try {
    const sessionId = nanoid(8);
    await createCameraSession(sessionId);

    return NextResponse.json({
      success: true,
      sessionId,
      capturePath: `/capture?session=${sessionId}`,
    });
  } catch (err: any) {
    console.error('Failed to create camera session:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to initialize session' },
      { status: 500 }
    );
  }
}
