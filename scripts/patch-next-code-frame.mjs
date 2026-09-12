import fs from "node:fs";
import path from "node:path";

const targets = [
  path.resolve("node_modules/next/dist/shared/lib/errors/code-frame.js"),
  path.resolve("node_modules/next/dist/esm/shared/lib/errors/code-frame.js"),
];

for (const target of targets) {
  if (fs.existsSync(target)) {
    let content = fs.readFileSync(target, "utf8");
    if (!content.includes("maxWidth: 100000")) {
      const originalPattern = "options.maxWidth = process.stdout.columns;";
      if (content.includes(originalPattern)) {
        content = content.replace(
          originalPattern,
          "options.maxWidth = 100000; // Patched: avoid Rust UTF-8 mid-line slicing panic"
        );
        content = content.replace(
          /return (\(0, _swc\.getBindingsSync\)\(\)|getBindingsSync\(\))\.codeFrameColumns\((file, location, options)\);/,
          "options = { ...options, maxWidth: 100000 };\n    return $1.codeFrameColumns(file, location, options);"
        );
        fs.writeFileSync(target, content, "utf8");
        console.log(`Patched ${path.relative(process.cwd(), target)} to prevent Next.js code-frame UTF-8 panic.`);
      }
    }
  }
}

