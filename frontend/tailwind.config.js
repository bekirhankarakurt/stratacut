/** CSS-variable colors must support Tailwind opacity (/90, /70, …). Plain `var(--x)` drops those utilities. */
function withAlpha(cssVar) {
  return ({ opacityValue }) => {
    if (opacityValue === undefined || opacityValue === null || opacityValue === '') {
      return `var(${cssVar})`;
    }
    const n = parseFloat(String(opacityValue));
    if (!Number.isFinite(n)) return `var(${cssVar})`;
    const pct = n <= 1 ? n * 100 : n;
    return `color-mix(in srgb, var(${cssVar}) ${pct}%, transparent)`;
  };
}

function cssScale(name, steps) {
  return Object.fromEntries(steps.map((step) => [step, withAlpha(`--c-${name}-${step}`)]));
}

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        pixel: ['"Press Start 2P"', '"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        white: withAlpha('--c-white'),
        accent: cssScale('accent', STEPS),
        slate: cssScale('slate', [...STEPS, 950]),
        rose: cssScale('rose', [...STEPS, 950]),
        amber: cssScale('amber', [...STEPS, 950]),
        violet: cssScale('violet', [...STEPS, 950]),
        sky: cssScale('sky', STEPS),
      },
      borderRadius: {
        none: '0px',
        sm: 'var(--r-sm)',
        DEFAULT: 'var(--r)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        '2xl': 'var(--r-2xl)',
        '3xl': 'var(--r-3xl)',
        full: '9999px',
      },
      boxShadow: {
        sm: 'var(--sh-sm)',
        DEFAULT: 'var(--sh)',
        md: 'var(--sh-md)',
        lg: 'var(--sh-lg)',
        xl: 'var(--sh-xl)',
        '2xl': 'var(--sh-2xl)',
        inner: 'var(--sh-inner)',
        none: 'none',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
      keyframes: {
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'mc-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'mc-wiggle': {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        'mc-pop': {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '60%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'mc-shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-3px)' },
          '40%': { transform: 'translateX(3px)' },
          '60%': { transform: 'translateX(-2px)' },
          '80%': { transform: 'translateX(2px)' },
        },
        'mc-xp-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(158,214,111,0.0)' },
          '50%': { boxShadow: '0 0 12px 2px rgba(158,214,111,0.55)' },
        },
        'mc-blink': {
          '0%, 45%': { opacity: '1' },
          '50%, 95%': { opacity: '0.35' },
        },
      },
      animation: {
        'toast-in': 'toast-in 150ms ease-out',
        'fade-in': 'fade-in 150ms ease-out',
        'mc-float': 'mc-float 3.2s ease-in-out infinite',
        'mc-wiggle': 'mc-wiggle 0.4s ease-in-out',
        'mc-pop': 'mc-pop 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'mc-shake': 'mc-shake 0.4s ease-in-out',
        'mc-xp-glow': 'mc-xp-glow 2s ease-in-out infinite',
        'mc-blink': 'mc-blink 1.1s steps(1) infinite',
      },
    },
  },
  plugins: [],
};
