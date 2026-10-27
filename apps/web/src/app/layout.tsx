import type { Metadata, Viewport } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "SolvAm — Shazam for Math & WAEC Exam Intelligence",
  description: "AI-powered camera math tutor & red-pen handwritten work grader tailored for Nigerian SSCE/WAEC students.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#064e3b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );

  // Production Safeguard: Validate Clerk publishable key prefix before mounting ClerkProvider
  const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const isClerkConfigured = Boolean(
    clerkPubKey && (clerkPubKey.startsWith('pk_test_') || clerkPubKey.startsWith('pk_live_'))
  );

  if (isClerkConfigured) {
    return <ClerkProvider publishableKey={clerkPubKey}>{content}</ClerkProvider>;
  }

  return content;
}
