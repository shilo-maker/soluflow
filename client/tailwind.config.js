/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf2f0',
          100: '#fce4df',
          200: '#f9c4b8',
          300: '#f5a08a',
          400: '#F9A470',
          500: '#BC556F',
          600: '#a3485e',
          700: '#8f3d50',
          800: '#7a3345',
          900: '#66293a',
          950: '#4d1f2c',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'gradient-shift': 'gradientShift 10s ease infinite',
      },
    },
  },
  plugins: [],
};
