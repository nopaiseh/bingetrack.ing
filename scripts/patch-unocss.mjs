import fs from "node:fs";
import path from "node:path";

const target = path.resolve("node_modules/@unocss/postcss/dist/index.cjs");
if (fs.existsSync(target)) {
  const content = fs.readFileSync(target, "utf8");
  if (!content.includes("module.exports = unocss;")) {
    const patched = content.replace("exports.default = unocss;", "exports.default = unocss;\nmodule.exports = unocss;");
    fs.writeFileSync(target, patched, "utf8");
    console.log("Patched @unocss/postcss CJS export for Next.js compatibility.");
  }
}
