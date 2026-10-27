import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import "katex/dist/katex.min.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SolvAm — AI Copilot & WAEC Math Intelligence",
  description: "AI-powered camera math tutor, SAM 3.1 exam scanner & red-pen handwritten work grader tailored for SSCE/WAEC students.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563eb",
};

// Production Safeguard: Inline theme initialization script prevents Flash of Unstyled Content (FOUC)
const themeInitScript = `
(function() {
  try {
    var raw = localStorage.getItem('solvam_user_preferences_v1');
    var theme = 'light';
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.themeMode) {
        theme = parsed.themeMode;
      }
    }
    var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-[#f4f7fa] dark:bg-[#070b14] text-[#0f172a] dark:text-[#f8fafc] font-sans antialiased selection:bg-[#dbeafe] selection:text-[#1e3a8a] dark:selection:bg-[#1e3a8a] dark:selection:text-[#f8fafc]">
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
