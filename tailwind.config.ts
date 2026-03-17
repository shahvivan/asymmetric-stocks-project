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
    },
  },
  plugins: [],
};
export default config;
