/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',  // If your components are under the src directory, this is good.
    './components/**/*.{js,jsx}',  // Correct for components folder.
    './pages/**/*.{js,jsx}',       // Correct for pages folder (important for Next.js).
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
