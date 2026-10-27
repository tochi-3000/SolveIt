import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';

const hasValidClerkKeys = (): boolean => {
  const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const secKey = process.env.CLERK_SECRET_KEY?.trim();
  return Boolean(
    pubKey &&
      secKey &&
      (pubKey.startsWith('pk_test_') || pubKey.startsWith('pk_live_')) &&
      (secKey.startsWith('sk_test_') || secKey.startsWith('sk_live_'))
  );
};

const clerkHandler = clerkMiddleware();

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // Production Safeguard: Only invoke Clerk Edge Middleware when valid keys are configured.
  // Prevents runtime crashes in Guest/Judge fallback mode while properly forwarding NextFetchEvent.
  if (hasValidClerkKeys()) {
    return clerkHandler(req, event);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
