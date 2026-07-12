/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        archive: 'var(--color-deep-graphite)',
        parchment: 'var(--color-warm-ivory)',
        ember: 'var(--color-deep-crimson)',
        brass: 'var(--color-brass-gold)',
        walnut: 'var(--color-walnut)',
      },
      fontFamily: {
        display: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
