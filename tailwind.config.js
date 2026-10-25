/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  // The popup styles every transition by hand on the paper tokens, so the
  // utility is never used. It is also picked up from the content script's
  // inline `transition` style and would ship a `backdrop-filter` property name
  // in its transition list, which the paper system forbids on the page.
  corePlugins: {
    transitionProperty: false
  },
  plugins: []
};
