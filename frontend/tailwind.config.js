/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // High-contrast, purpose-built palette. No decorative gradients.
        danger: {
          DEFAULT: '#e11d2a',
          dark: '#b31018',
        },
        safe: '#16a34a',
        ink: '#0b0b0f',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
