module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5', // Indigo-600
        secondary: '#10B981', // Green-500
        danger: '#EF4444', // Red-500
        warning: '#F59E0B', // Yellow-500
        background: '#F9FAFB', // Gray-50
        surface: '#FFFFFF', // White
        text: '#1F2937', // Gray-800
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};