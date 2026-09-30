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
      mono: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    },
    colors: {
      accent: {
        light: "var(--accent-light)",
      },
      // 深色背景上的文字层级；装饰性分隔符与占位图标仍直接用 text-white/N。
      fg: {
        DEFAULT: "rgb(255 255 255 / 0.9)", // 标题与正文
        secondary: "rgb(255 255 255 / 0.75)", // 次要文字与可点击控件
        muted: "rgb(255 255 255 / 0.6)", // 辅助说明
        subtle: "rgb(255 255 255 / 0.5)", // 元信息与弱提示；再低于 0.5 时小字达不到 WCAG AA 4.5:1
        faint: "rgb(255 255 255 / 0.3)", // 仅用于装饰性占位图标；对比度约 2.6:1，不可用于文字
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
