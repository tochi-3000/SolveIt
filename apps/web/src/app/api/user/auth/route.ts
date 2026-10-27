import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { getOrCreateUser, upsertAuthenticatedUser } from '@/lib/db';
import { isClerkConfigured } from '@/lib/auth';

const GUEST_COOKIE_NAME = 'solvam_guest_id';

const SignInSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name must be under 80 characters')
    .regex(/^[a-zA-Z0-9\s.'-]+$/, 'Name contains invalid characters'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address')
    .max(120, 'Email must be under 120 characters'),
});

/**
 * POST /api/user/auth
 * Authenticates a student session (upgrades guest session or signs in local user)
 * with strict Zod validation and input sanitization.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SignInSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Invalid credentials format';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { name, email } = parsed.data;
    const cookieStore = await cookies();
    const currentId = cookieStore.get(GUEST_COOKIE_NAME)?.value || `usr_${nanoid(10)}`;

    const user = await upsertAuthenticatedUser(currentId, name, email);

    const res = NextResponse.json({
      ...user,
      clerkEnabled: isClerkConfigured(),
    });

    res.cookies.set(GUEST_COOKIE_NAME, user.id, {
      path: '/',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
    });

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Authentication failed';
    console.error('[Auth API] Sign-in error:', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/user/auth
 * Signs out the current user and provisions a clean anonymous guest session.
 */
export async function DELETE() {
  try {
    const newGuestId = `guest_${nanoid(10)}`;
    const guestUser = await getOrCreateUser(newGuestId, true, 'Guest Student', undefined);

    const res = NextResponse.json({
      ...guestUser,
      clerkEnabled: isClerkConfigured(),
    });

    res.cookies.set(GUEST_COOKIE_NAME, newGuestId, {
      path: '/',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    });

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sign-out failed';
    console.error('[Auth API] Sign-out error:', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
