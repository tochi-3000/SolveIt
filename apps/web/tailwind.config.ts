import type { Config } from "tailwindcss";

// Semantic colour helper: tokens are RGB channels in globals.css so alpha modifiers work.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

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
        shell: token("shell"),
        panel: token("panel"),
        surface: {
          DEFAULT: token("surface"),
          subtle: token("surface-subtle"),
          sunken: token("surface-sunken"),
        },
        sidebar: {
          DEFAULT: token("sidebar"),
          line: token("sidebar-line"),
        },
        line: {
          DEFAULT: token("line"),
          strong: token("line-strong"),
        },
        ink: {
          DEFAULT: token("ink"),
          soft: token("ink-soft"),
          muted: token("ink-muted"),
        },
        brand: {
          DEFAULT: token("brand"),
          hover: token("brand-hover"),
          fg: token("brand-fg"),
          tint: token("brand-tint"),
          ink: token("brand-ink"),
        },
      },
      boxShadow: {
        card: "var(--shadow-card)",
        float: "var(--shadow-float)",
        "app-shell": "var(--shadow-app-shell)",
      },
    },
  },
  plugins: [],
};
export default config;
