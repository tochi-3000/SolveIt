import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-jakarta)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        canvas: "var(--bg-canvas)",
        sidebar: "var(--bg-sidebar)",
        activeNav: "var(--bg-active-nav)",
        corporate: {
          primary: "#2563eb",
          primaryHover: "#1d4ed8",
          secondary: "var(--bg-secondary-pill)",
          navy: "var(--text-accent-navy)",
          deepNavy: "var(--text-primary)",
          muted: "var(--text-muted)",
          border: "var(--border-hairline)",
        },
      },
      boxShadow: {
        'app-shell': 'var(--shadow-app-shell)',
        'card-subtle': '0 4px 16px rgba(148, 163, 184, 0.06)',
      },
    },
  },
  plugins: [],
};
export default config;
