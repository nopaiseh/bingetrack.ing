const config = {
  plugins: {
    "@unocss/postcss": {
      content: [
        "./app/**/*.{html,js,ts,jsx,tsx,mdx}",
        "./components/**/*.{html,js,ts,jsx,tsx,mdx}",
        "./lib/**/*.{html,js,ts,jsx,tsx,mdx}",
      ],
    },
  },
};

export default config;
