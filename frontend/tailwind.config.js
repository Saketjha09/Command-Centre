export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0d1117',
          900: '#0d1117',
          850: '#0d1117',
          800: '#161b22',
          700: '#1c2128',
          600: '#1c2128',
          500: '#484f58',
        },
        linear: {
          bg: '#0d1117',
          sidebar: '#0d1117',
          card: '#161b22',
          cardHover: '#1c2128',
          textMuted: '#484f58',
          textSecondary: '#7d8590',
          textPrimary: '#e6edf3',
          border: 'rgba(255,255,255,0.08)',
          accent: '#6366f1',
          success: '#3fb950',
          warning: '#d29922',
          danger: '#f85149',
          blue: '#58a6ff'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
        'pop': '0 20px 50px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
