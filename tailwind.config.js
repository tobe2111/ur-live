/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./public/**/*.{html,js}",
  ],
  theme: {
    extend: {
      colors: {
        'toss-blue': '#3182F6',
        'toss-gray': '#191F28',
        'toss-light-gray': '#F2F4F6',
      },
    },
  },
  plugins: [],
}
