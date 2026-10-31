/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { ink: '#15253d', navy: '#0d1b2f', mist: '#f4f7fb', line: '#dfe7f0', accent: '#2161e8' },
      boxShadow: { card: '0 18px 45px rgba(20, 43, 76, 0.08)', soft: '0 8px 24px rgba(20, 43, 76, 0.06)' },
    },
  },
  plugins: [],
}
