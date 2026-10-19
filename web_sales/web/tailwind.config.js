/** @type {import('tailwindcss').Config} */
// رموز التصميم (Design tokens) — المصدر الوحيد للألوان والخطوط والظلال في المنصة.
// استخدم هذه الأسماء (brand / ink / canvas / line / success ...) بدل ألوان Tailwind الخام.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'system-ui', '-apple-system', 'Segoe UI', 'Tahoma', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dae6ff',
          200: '#bdd3ff',
          300: '#90b6ff',
          400: '#5c8dfd',
          500: '#3767f6',
          600: '#2349ea',
          700: '#1d38c9',
          800: '#1e31a2',
          900: '#1e2f80',
          950: '#141c4d',
        },
        // ألوان النص والحدود والخلفيات المحايدة
        ink: {
          DEFAULT: '#0f172a',
          muted: '#475569',
          subtle: '#64748b',
          faint: '#94a3b8',
        },
        canvas: '#f5f7fb',
        surface: '#ffffff',
        line: {
          DEFAULT: '#e5e9f0',
          strong: '#d3d9e3',
        },
        nav: {
          DEFAULT: '#0b1530',
          hover: '#14214a',
          active: '#1b2b5e',
          text: '#a9b4d0',
        },
        success: { 50: '#ecfdf3', 100: '#d1fadf', 600: '#079455', 700: '#067647' },
        danger: { 50: '#fef3f2', 100: '#fee4e2', 600: '#d92d20', 700: '#b42318' },
        warning: { 50: '#fffaeb', 100: '#fef0c7', 600: '#dc6803', 700: '#b54708' },
        info: { 50: '#f0f9ff', 100: '#e0f2fe', 600: '#0284c7', 700: '#026aa2' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
        pop: '0 12px 32px -8px rgba(16, 24, 40, 0.18), 0 4px 8px -4px rgba(16, 24, 40, 0.08)',
      },
      borderRadius: {
        xl: '0.875rem',
      },
    },
  },
  plugins: [],
};
