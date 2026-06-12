/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        copa: {
          dark:   'rgb(var(--copa-dark)   / <alpha-value>)',
          card:   'rgb(var(--copa-card)   / <alpha-value>)',
          border: 'rgb(var(--copa-border) / <alpha-value>)',
          gold:   'rgb(var(--copa-gold)   / <alpha-value>)',
          canary: 'rgb(var(--copa-canary) / <alpha-value>)',
          menta:  'rgb(var(--copa-menta)  / <alpha-value>)',
          teal:   'rgb(var(--copa-teal)   / <alpha-value>)',
          royal:  'rgb(var(--copa-royal)  / <alpha-value>)',
          red:    'rgb(var(--copa-red)    / <alpha-value>)',
          cream:  'rgb(var(--copa-cream)  / <alpha-value>)',
        },
      },
      fontFamily: {
        sans:      ['Inter', 'system-ui', 'sans-serif'],
        acumin:    ['"Acumin Variable Concept"', '"Arial Narrow"', 'sans-serif'],
        caveat:    ['Caveat', 'cursive'],
        cormorant: ['Cormorant Garamond', 'serif'],
      },
    },
  },
  plugins: [],
}
