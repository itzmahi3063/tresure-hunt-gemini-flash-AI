/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        heading: ['"Russo One"', 'sans-serif'],
        gaming: ['"Russo One"', 'sans-serif'],
        cyber: ['"Orbitron"', 'sans-serif'],
        numbers: ['"Chakra Petch"', 'sans-serif'],
        mono: ['"Chakra Petch"', 'monospace'],
      },
      colors: {
        treasure: {
          bg: '#0A0A0E',
          card: '#14141B',
          cardLight: '#1C1C26',
          gold: '#F5A623',
          goldLight: '#FFD700',
          cyan: '#00E5FF',
          cyanDark: '#00A3B8',
          border: '#2A2A38',
          textMuted: '#9E9EB2'
        }
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #FFD700 0%, #F5A623 100%)',
        'cyan-gradient': 'linear-gradient(135deg, #00E5FF 0%, #0088A3 100%)',
        'card-gradient': 'linear-gradient(180deg, #1C1C26 0%, #121218 100%)',
        'button-gradient': 'linear-gradient(180deg, #FFD700 0%, #E69500 100%)',
      },
      boxShadow: {
        'gold-glow': '0 0 25px rgba(245, 166, 35, 0.45)',
        'cyan-glow': '0 0 25px rgba(0, 229, 255, 0.45)',
        'box-glow': '0 0 40px rgba(255, 215, 0, 0.35)',
      }
    },
  },
  plugins: [],
}
