/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        gray: {
          700: '#36393f',
          800: '#2f3136',
          900: '#202225',
        },
        indigo: {
          600: '#5865F2',
        },
      },
    },
  },
  plugins: [],
};
