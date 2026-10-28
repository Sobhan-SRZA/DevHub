/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./frontend/views/**/*.ejs",
    "./frontend/public/js/**/*.js",
  ],
  // Theme toggled via data-mode on <html> (see themes.css / theme.js)
  darkMode: ["selector", '[data-mode="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Vazirmatn", "Tahoma", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "var(--bg)",
          elevated: "var(--bg-elevated)",
          1: "var(--bg-surface)",
          2: "var(--bg-surface-2)",
          hover: "var(--bg-hover)",
          muted: "var(--bg-muted)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
          focus: "var(--border-focus)",
        },
        content: {
          DEFAULT: "var(--text)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          inverse: "var(--text-inverse)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
          muted: "var(--accent-muted)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        lg: "var(--shadow-lg)",
        glow: "var(--shadow-glow)",
      },
      maxWidth: {
        page: "var(--page-max)",
      },
      spacing: {
        header: "var(--header-h)",
        gutter: "var(--page-gutter)",
      },
      transitionTimingFunction: {
        brand: "var(--ease)",
      },
      transitionDuration: {
        brand: "var(--duration)",
        "brand-slow": "var(--duration-slow)",
      },
    },
  },
  plugins: [],
  // Keep generated file smaller when scanning many EJS templates
  safelist: [
    // dynamic role / accent classes used from JS
    { pattern: /^(bg|text|border)-accent(\/\d+)?$/ },
    { pattern: /^(bg|text|border)-(success|warning|danger|info)(\/\d+)?$/ },
  ],
};
