import { createRequire } from "node:module";
import {
  defineConfig,
  presetWind3,
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
  theme: {
    fontFamily: {
      sans: 'var(--font-geist), "Noto Sans SC", "Noto Sans CJK SC", "Source Han Sans SC", "Source Han Sans", ui-sans-serif, system-ui, sans-serif',
      mono: 'var(--font-geist-mono), "Noto Sans Mono CJK SC", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },
    fontSize: {
      // 正文下限 14px。说明、徽标、表头沿用 text-xs，不能再是 12px。
      xs: ["0.875rem", "1.25rem"],
    },
    colors: {
      // 实色文字，不跟背景透明度复合。fg-3 在 surface 上约 6.3:1。
      fg: {
        DEFAULT: "#f5f2f7",
        secondary: "#c9c0d1",
        muted: "#a197ab",
        subtle: "#a197ab",
        faint: "rgb(255 255 255 / 0.3)", // 仅装饰性占位图标，不可用于文字
      },
    },
  },
  presets: [
    presetWind3(),
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
