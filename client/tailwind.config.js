/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'var(--bg)',
          surface: 'var(--surface)',
          'surface-2': 'var(--surface-2)',
          border: 'var(--border)',
          text: 'var(--text)',
          'text-muted': 'var(--text-muted)',
          accent: 'var(--accent)',
          'accent-contrast': 'var(--accent-contrast)',
          success: 'var(--success)',
          danger: 'var(--danger)',
          warning: 'var(--warning)',
        },
        editor: {
          bg: 'var(--bg)',
          sidebar: 'var(--surface)',
          header: 'var(--surface-2)',
          border: 'var(--border)',
          text: 'var(--text)',
        }
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'sans-serif'],
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
