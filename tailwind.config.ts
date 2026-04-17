import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        midnight: "#07070F",
        surface: {
          1: "rgba(255,255,255,0.04)",
          2: "rgba(255,255,255,0.07)",
          3: "rgba(255,255,255,0.10)",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      boxShadow: {
        "glow-violet": "0 0 30px rgba(124,58,237,0.25)",
        "glow-cyan": "0 0 30px rgba(6,182,212,0.20)",
        "glow-emerald": "0 0 20px rgba(16,185,129,0.25)",
        "glow-orange": "0 0 25px rgba(249,115,22,0.30)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
