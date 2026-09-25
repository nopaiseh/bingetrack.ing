import fs from "node:fs";
import path from "node:path";

// 为 @unocss/postcss 的 CJS 构建补充 module.exports，使 Next.js 的 PostCSS 加载器能直接取到插件。
// 升级后若目标代码变化而无法打补丁，安装直接失败，避免补丁静默失效；上游修复后删除本脚本。
const target = path.resolve("node_modules/@unocss/postcss/dist/index.cjs");
if (fs.existsSync(target)) {
  const content = fs.readFileSync(target, "utf8");
  if (!content.includes("module.exports = unocss;")) {
    const anchor = "exports.default = unocss;";
    if (!content.includes(anchor)) {
      console.error(`[patch-unocss] ${anchor} not found in ${target}; the @unocss/postcss build changed. Re-check whether this patch is still needed.`);
      process.exit(1);
    }
    fs.writeFileSync(target, content.replace(anchor, `${anchor}\nmodule.exports = unocss;`), "utf8");
    console.log("Patched @unocss/postcss CJS export for Next.js compatibility.");
  }
}
