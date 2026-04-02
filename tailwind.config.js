/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#06B6D4',
        'brand-success': '#10B981',
        'brand-midnight': '#020617',
        'brand-light': '#F8FAFC',
        'brand-white': '#FFFFFF',
        'brand-slate': '#64748B',
        'brand-border': '#E2E8F0',
        'brand-alert': '#EF4444',
        'brand-warning': '#FACC15',
      },
      fontFamily: {
        'brand-primary': ['Inter', 'sans-serif'],
        'brand-secondary': ['Roboto', 'sans-serif'],
      },
      borderRadius: {
        'brand': '8px',
      },
      boxShadow: {
        'brand': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [],
}
