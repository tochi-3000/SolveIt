import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        waec: {
          green: "#059669",
          emerald: "#10b981",
          gold: "#f59e0b",
          red: "#ef4444",
          dark: "#064e3b"
        }
      },
    },
  },
  plugins: [],
};
export default config;
