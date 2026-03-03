/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#4ABA6E',
        secondary: '#38BDF8',
        'bg-base': '#ECEEF0',
        'bg-card': '#FFFFFF',
        'checker-teal': '#4ABA6E',
        'checker-blue': '#38BDF8',
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
