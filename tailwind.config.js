/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        copa: {
          dark: '#1a1a1a',
          card: '#FFFDF5',
          border: '#D9CBAD',
          gold: '#FFD100',
          canary: '#E5CE75',
          menta: '#00FEA8',
          teal: '#295A71',
          royal: '#274CA3',
          red: '#e63946',
          cream: '#F5EDD0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        caveat: ['Caveat', 'cursive'],
        cormorant: ['Cormorant Garamond', 'serif'],
      },
    },
  },
  plugins: [],
}
