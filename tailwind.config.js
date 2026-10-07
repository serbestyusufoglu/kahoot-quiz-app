/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        quiz: {
          red: '#E21B3C',
          redHover: '#C81533',
          blue: '#1368CE',
          blueHover: '#0F56AC',
          yellow: '#D89E00',
          yellowHover: '#B88600',
          green: '#26890C',
          greenHover: '#1E6E09',
        }
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-short': 'bounce 0.6s ease-in-out 2',
      }
    },
  },
  plugins: [],
}
