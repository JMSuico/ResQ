/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "command-dark": "#0a0f1d",
        "surface-dark": "#0f172a",
        "surface-card": "#1e293b",
        "surface-border": "#334155",
        "primary": "#0284c7",
        "status-danger": "#ef4444",
        "status-pending": "#f59e0b",
        "action-green": "#10b981",
        "action-green-hover": "#059669",
        "soft-blue": "#0284c71a",
        "surface-container-lowest": "#0a0f1d",
        "surface-container-low": "#0f172a",
        "surface-container": "#1e293b",
        "surface-container-high": "#334155",
        "surface-container-highest": "#475569",
        "outline-variant": "#475569",
        "text-primary": "#f8fafc",
        "text-secondary": "#94a3b8",
        "on-primary": "#ffffff",
        "rhu": "#0284c7",
        "fire": "#ea580c",
        "pnp": "#3b82f6",
        "ldrrmo": "#dc2626",
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleUp: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        scaleUp: 'scaleUp 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
    },
  },
  plugins: [],
}
