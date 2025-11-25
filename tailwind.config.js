/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: {
            primary: '#1a1b26',
            secondary: '#16161e',
            tertiary: '#24283b',
          },
          text: {
            primary: '#c0caf5',
            secondary: '#a9b1d6',
          },
          accent: {
            blue: '#7aa2f7',
            green: '#9ece6a',
            red: '#f7768e',
          },
          border: '#414868',
        },
      },
    },
  },
  plugins: [],
}
