import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#bae0fd",
          300: "#7cc8fc",
          400: "#36aaf8",
          500: "#0c90e9",
          600: "#0072c7",
          700: "#015aa2",
          800: "#064d85",
          900: "#0b416e",
        },
        vital: {
          blue: "#0066CC",
          green: "#00A651",
          orange: "#FF6B00",
        },
      },
    },
  },
  plugins: [],
};

export default config;
