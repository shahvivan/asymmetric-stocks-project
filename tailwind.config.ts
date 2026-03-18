import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--c-base-rgb) / <alpha-value>)",
        surface: "rgb(var(--c-surface-rgb) / <alpha-value>)",
        "surface-2": "rgb(var(--c-raised-rgb) / <alpha-value>)",
        border: "var(--b-default)",
        buy: "rgb(var(--blue-rgb) / <alpha-value>)",
        sell: "rgb(var(--red-rgb) / <alpha-value>)",
        monitor: "rgb(var(--gold-rgb) / <alpha-value>)",
        profit: "rgb(var(--green-rgb) / <alpha-value>)",
        muted: "rgb(var(--t-low-rgb) / <alpha-value>)",
        "muted-2": "rgb(var(--t-mid-rgb) / <alpha-value>)",
      },
      borderColor: {
        DEFAULT: "var(--b-default)",
      },
      fontFamily: {
        mono: [
          "GeistMono",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
        sans: ["GeistSans", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in": "fade-in 0.2s ease-out",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-down": "slide-down 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
