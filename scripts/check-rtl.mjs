/**
 * Fails the build on physical-direction Tailwind utilities.
 *
 * In an RTL app, `ml-4` is a bug that only shows up visually — it survives
 * typecheck, lint and tests. The logical equivalents (ms/me/ps/pe, start/end)
 * flip with the document direction; the physical ones do not.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib"];

// class="ml-4" but not "small-4"; the leading boundary keeps it honest.
const BANNED = [
  { pattern: /(?<![\w-])-?(ml|mr|pl|pr)-[\w.[\]/-]+/g, hint: "use ms-/me-/ps-/pe-" },
  { pattern: /(?<![\w-])(left|right)-[\w.[\]/-]+/g, hint: "use start-/end-" },
  { pattern: /(?<![\w-])(border-l|border-r)(?![\w-])/g, hint: "use border-s/border-e" },
  { pattern: /(?<![\w-])text-(left|right)(?![\w-])/g, hint: "use text-start/text-end" },
  { pattern: /(?<![\w-])(rounded-[tb]?[lr])(?![\w-])/g, hint: "use the logical corner (rounded-s/e)" },
];

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(tsx|ts|css)$/.test(entry.name)) yield path;
  }
}

const findings = [];

for (const dir of SCAN_DIRS) {
  for await (const file of walk(join(ROOT, dir))) {
    const source = await readFile(file, "utf8");
    const lines = source.split("\n");

    lines.forEach((line, index) => {
      if (line.includes("rtl-ok")) return;
      for (const { pattern, hint } of BANNED) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(line)) !== null) {
          findings.push({
            file: relative(ROOT, file),
            line: index + 1,
            token: match[0],
            hint,
          });
        }
      }
    });
  }
}

if (findings.length > 0) {
  console.error(`RTL check failed — ${findings.length} physical-direction utility(ies):\n`);
  for (const { file, line, token, hint } of findings) {
    console.error(`  ${file}:${line}  ${token}  →  ${hint}`);
  }
  console.error("\nAdd a trailing `rtl-ok` comment on the line if a physical value is genuinely intended.");
  process.exit(1);
}

console.log("RTL check passed — no physical-direction utilities.");
