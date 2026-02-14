/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./*.{ts,tsx,html}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kd: {
          bg:        'var(--kd-bg)',
          card:      'var(--kd-card)',
          elevated:  'var(--kd-elevated)',
          border:    'var(--kd-border)',
          'border-active': 'var(--kd-border-active)',
        },
        accent: {
          indigo:  'var(--accent-indigo)',
          violet:  'var(--accent-violet)',
          cyan:    'var(--accent-cyan)',
          gold:    'var(--accent-gold)',
        },
        risk: {
          green:  'var(--risk-green)',
          amber:  'var(--risk-amber)',
          red:    'var(--risk-red)',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-live': 'pulse-live 2s infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
      },
      keyframes: {
        'pulse-live': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.5', transform: 'scale(1.2)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
}
