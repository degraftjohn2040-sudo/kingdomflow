import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f6f9", 100: "#eaeaf1", 200: "#d2d2e0", 300: "#a9a9c4",
          400: "#7b7ba4", 500: "#5b5b86", 600: "#47476c", 700: "#3a3a58",
          800: "#2a2a40", 900: "#1b1b2b", 950: "#101019",
        },
        royal: {
          50: "#eef1ff", 100: "#e0e5ff", 200: "#c6ceff", 300: "#a3adfd",
          400: "#8085f8", 500: "#6c6cf1", 600: "#5a4ce0", 700: "#4c3ec5",
          800: "#3f35a0", 900: "#36307f", 950: "#221d4c",
        },
        gold: { 300: "#f5d489", 400: "#eec25f", 500: "#dfa733", 600: "#c0871f" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,16,25,.06), 0 8px 24px -12px rgba(16,16,25,.18)",
      },
    },
  },
  plugins: [],
} satisfies Config;
