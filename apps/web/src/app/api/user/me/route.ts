import { NextResponse } from 'next/server';
import { getCurrentUserOrGuest, isClerkConfigured } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUserOrGuest();
    const res = NextResponse.json({
      ...user,
      clerkEnabled: isClerkConfigured(),
    });

    // If guest, set cookie on response
    if (user.is_guest) {
      res.cookies.set('solvam_guest_id', user.id, {
        path: '/',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: 'lax',
      });
    }

    return res;
  } catch (err: any) {
    console.error('Failed to fetch user:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
