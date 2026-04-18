/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./*.{ts,tsx,html}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Primary palette (new flat tokens → mockup CSS vars) ── */
        'kd-bg':           'var(--bg)',
        'kd-card':         'var(--card)',
        'kd-card-soft':    'var(--card-soft)',
        'kd-card-deep':    'var(--card-deep)',
        'kd-border':       'var(--border)',
        'kd-gold':         'var(--gold)',
        'kd-gold-soft':    'var(--gold-soft)',
        'kd-indigo':       'var(--indigo)',
        'kd-bull':         'var(--bull)',
        'kd-bear':         'var(--bear)',
        'kd-caution':      'var(--caution)',
        'kd-text-primary':   'var(--text-primary)',
        'kd-text-secondary': 'var(--text-secondary)',
        'kd-text-muted':     'var(--text-muted)',
        'kd-text-faint':     'var(--text-faint)',

        /* ── Legacy nested aliases (backward compat) ── */
        kd: {
          bg:             'var(--bg)',
          surface:        'var(--card)',
          card:           'var(--card)',
          elevated:       'var(--card-soft)',
          border:         'var(--border)',
          'border-active': 'var(--border-indigo)',
        },
        accent: {
          indigo:  'var(--indigo)',
          violet:  'var(--accent-violet)',
          cyan:    'var(--accent-cyan)',
          gold:    'var(--gold)',
        },
        risk: {
          green:  'var(--bull)',
          amber:  'var(--caution)',
          red:    'var(--bear)',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['Geist Mono', 'monospace'],
        display: ['Fraunces', 'Georgia', 'serif'],
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
