// 扫描范围由 uno.config.ts 的 content.filesystem 决定，@unocss/postcss 不读取这里的 content 选项。
const config = {
  plugins: {
    "@unocss/postcss": {},
  },
};

export default config;
