import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "oklch(0.98 0.005 95)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "SF Pro Display",
          "SF Pro Text",
          "system-ui",
          "sans-serif",
        ],
        mono: ["SF Mono", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        glass:
          "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -8px rgba(0,0,0,0.08)",
        "glass-hover":
          "0 2px 4px rgba(0,0,0,0.05), 0 12px 32px -10px rgba(0,0,0,0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
