/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // TdF Yellow theme
        'tdf-primary': '#ca8a04',     // yellow-600 - main headers
        'tdf-accent': '#eab308',      // yellow-500 - active buttons
        'tdf-score': '#ca8a04',       // yellow-600 - score numbers
        
        // Grays for backgrounds and text
        'tdf-bg': '#f9fafb',          // gray-50 - page background
        'tdf-card': '#ffffff',        // white - card background
        'tdf-card-hover': '#f3f4f6',  // gray-100 - hover state
        'tdf-expanded': '#f9fafb',    // gray-50 - expanded sections
        
        // Table rows
        'tdf-row-even': '#ffffff',    // white
        'tdf-row-odd': '#f9fafb',     // gray-50
        
        // Text colors
        'tdf-text-primary': '#111827',    // gray-900
        'tdf-text-secondary': '#6b7280',  // gray-500
        'tdf-text-muted': '#9ca3af',      // gray-400
        
        // Button states
        'tdf-button-inactive': '#e5e7eb', // gray-200
        'tdf-button-text': '#374151',     // gray-700
        
        // Status colors
        'tdf-green': '#16a34a',       // green-600 - rank up
        'tdf-red': '#dc2626',         // red-600 - rank down
      },
    },
  },
  plugins: [],
}