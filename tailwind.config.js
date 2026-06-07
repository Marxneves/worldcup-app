/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        copa: {
          dark: '#0a0e1a',
          card: '#111827',
          border: '#1e2d40',
          gold: '#f5c518',
          green: '#00a651',
          red: '#e63946',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
