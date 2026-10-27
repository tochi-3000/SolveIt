import { NextRequest, NextResponse } from 'next/server';
import { updateCameraSessionStatus, getCameraSession } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { imageData, status = 'completed' } = body;

    const session = await getCameraSession(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
    }

    if (status === 'connected') {
      await updateCameraSessionStatus(id, 'connected');
      return NextResponse.json({ success: true, status: 'connected' });
    }

    if (!imageData || typeof imageData !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid "imageData"' }, { status: 400 });
    }

    await updateCameraSessionStatus(id, 'completed', imageData);

    return NextResponse.json({
      success: true,
      sessionId: id,
      message: 'Photo uploaded and paired successfully',
    });
  } catch (err: any) {
    console.error('Session upload error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to upload photo to session' },
      { status: 500 }
    );
  }
}
