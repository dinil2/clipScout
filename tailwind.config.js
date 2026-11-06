/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#0B0C10',
        surface: '#12141B',
        'surface-2': '#191C25',
        border: '#262A36',
        text: '#F4F5F7',
        muted: '#A1A7B5',
        accent: {
          DEFAULT: '#FFB020',
          hover: '#E59D17',
          active: '#CC8A10',
          ink: '#1A1203'
        },
        success: '#34D399',
        danger: '#F87171'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        control: '10px'
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.45)',
        accent: '0 0 20px -3px rgba(255, 176, 32, 0.25)'
      },
      maxWidth: {
        container: '1360px'
      },
      transitionDuration: {
        DEFAULT: '150ms'
      }
    },
  },
  plugins: [],
}
