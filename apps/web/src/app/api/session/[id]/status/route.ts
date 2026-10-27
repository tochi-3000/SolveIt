import { NextRequest, NextResponse } from 'next/server';
import { getCameraSession } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getCameraSession(id);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: session.id,
      status: session.status,
      hasImage: Boolean(session.image_data),
      imageData: session.image_data,
    });
  } catch (err: any) {
    console.error('Session status check error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
