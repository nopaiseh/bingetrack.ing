import fs from "node:fs";
import path from "node:path";

// 固定 Next.js 代码帧宽度，规避 Rust 在多字节 UTF-8 字符中间截断导致的 panic。
// 升级后若目标代码变化而无法打补丁，安装直接失败，避免补丁静默失效；上游修复后删除本脚本。
const targets = [
  path.resolve("node_modules/next/dist/shared/lib/errors/code-frame.js"),
  path.resolve("node_modules/next/dist/esm/shared/lib/errors/code-frame.js"),
];
const marker = "maxWidth: 100000";
const callPattern = /return (\(0, _swc\.getBindingsSync\)\(\)|getBindingsSync\(\))\.codeFrameColumns\((file, location, options)\);/;

for (const target of targets) {
  if (!fs.existsSync(target)) continue;
  const content = fs.readFileSync(target, "utf8");
  if (content.includes(marker)) continue;
  if (!callPattern.test(content)) {
    console.error(`[patch-next-code-frame] codeFrameColumns call not found in ${path.relative(process.cwd(), target)}; the Next.js build changed. Re-check whether this patch is still needed.`);
    process.exit(1);
  }
  const patched = content
    .replace("options.maxWidth = process.stdout.columns;", "options.maxWidth = 100000; // Patched: avoid Rust UTF-8 mid-line slicing panic")
    .replace(callPattern, `options = { ...options, ${marker} };\n    return $1.codeFrameColumns(file, location, options);`);
  fs.writeFileSync(target, patched, "utf8");
  console.log(`Patched ${path.relative(process.cwd(), target)} to prevent Next.js code-frame UTF-8 panic.`);
}
