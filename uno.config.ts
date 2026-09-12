import { createRequire } from "node:module";
import {
  defineConfig,
  presetUno,
  presetIcons,
  transformerVariantGroup,
} from "unocss";

const require = createRequire(import.meta.url);

export default defineConfig({
  content: {
    filesystem: [
      "./app/**/*.{html,js,ts,jsx,tsx,mdx}",
      "./components/**/*.{html,js,ts,jsx,tsx,mdx}",
      "./lib/**/*.{html,js,ts,jsx,tsx,mdx}",
    ],
  },
  presets: [
    presetUno(),
    presetIcons({
      scale: 1.2,
      collections: {
        "material-symbols": () => require("@iconify-json/material-symbols/icons.json"),
      },
      extraProperties: {
        display: "inline-block",
        "vertical-align": "middle",
      },
    }),
  ],
  transformers: [
    transformerVariantGroup(),
  ],
  rules: [
    ["animate-fade-in", { animation: "fadeIn 0.5s ease-out forwards" }],
    [/^bg-linear-to-([trbl]+)$/, ([, dir]) => {
      const dirMap: Record<string, string> = {
        t: "top",
        b: "bottom",
        l: "left",
        r: "right",
        tr: "top right",
        tl: "top left",
        br: "bottom right",
        bl: "bottom left",
      };
      return {
        "--un-gradient-shape": `to ${dirMap[dir] || dir}`,
        "--un-gradient": "var(--un-gradient-shape), var(--un-gradient-stops)",
        "background-image": "linear-gradient(var(--un-gradient))",
      };
    }],
  ],
  preflights: [
    {
      getCSS: () => `
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `,
    },
  ],
});
