/**
 * Auth & Credit Management for SolvAm
 * Production Safeguards:
 * - Judge-Friendly: Defaults to Anonymous Guest Sessions with 50 free credits
 * - Non-blocking: If Clerk credentials are not set, falls back to Guest Mode gracefully
 * - Database synchronization with Turso (libSQL)
 */

import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';
import { getOrCreateUser, UserRecord, deductUserCredits } from '@/lib/db';

const GUEST_COOKIE_NAME = 'solvam_guest_id';

export async function getCurrentUserOrGuest(): Promise<UserRecord> {
  const cookieStore = await cookies();
  let guestId = cookieStore.get(GUEST_COOKIE_NAME)?.value;

  // Check if Clerk is configured and user is authenticated
  if (process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    try {
      const { auth, currentUser } = await import('@clerk/nextjs/server');
      const { userId } = await auth();

      if (userId) {
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        const name = user?.fullName || user?.firstName || 'Student';

        // Sync Clerk user with Turso DB
        return await getOrCreateUser(userId, false, name, email);
      }
    } catch (clerkErr) {
      console.warn('[Auth] Clerk session retrieval skipped/failed, using Guest Mode:', clerkErr);
    }
  }

  // Fallback: Anonymous Guest Session
  if (!guestId) {
    guestId = `guest_${nanoid(10)}`;
  }

  return await getOrCreateUser(guestId, true, 'Guest Student', undefined);
}

export async function deductCurrentCredits(amount: number = 1): Promise<number> {
  const user = await getCurrentUserOrGuest();
  return await deductUserCredits(user.id, amount);
}
