/**
 * Fails the build on colours written as literals.
 *
 * Every colour in this app is a CSS variable on <html> that a dark set
 * overrides, so `bg-surface` means one thing by day and another by night. A
 * hex typed into a component does not move when the ground does: it survives
 * typecheck, lint, every unit test and the smoke suite, and shows up only as
 * white text on a light button at midnight.
 *
 * That is not hypothetical — installing the v3 palette left four of them
 * behind (the manifest's theme colour, the sheet's scrim, the donut's slice
 * separator, the month chart's axis labels), and nothing but reading the
 * files found them.
 *
 * Also catches `text-white` on the accent, which is the same failure wearing
 * a utility class: --action lightens in the dark theme and white stops being
 * readable on it. --surface is the foreground that flips with it.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib"];

const BANNED = [
  {
    pattern: /#[0-9a-fA-F]{3,8}\b/g,
    hint: "use a token from @theme (bg-surface, text-ink, …)",
  },
  {
    pattern: /(?<![\w-])rgba?\(\s*\d/g,
    hint: "use a token, or black/white with an opacity suffix",
  },
  {
    pattern: /(?<![\w-])text-white(?![\w-])/g,
    hint: "on --action use text-surface, which flips with the theme",
  },
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
    else if (/\.(tsx?|mjs)$/.test(entry.name)) yield path;
  }
}

const findings = [];

for (const dir of SCAN_DIRS) {
  for await (const file of walk(join(ROOT, dir))) {
    const source = await readFile(file, "utf8");
    source.split(/\r?\n/).forEach((line, index) => {
      // The escape hatch, same as check-rtl's: a literal is occasionally the
      // only option — a <meta theme-color>, or a swatch that must show one
      // theme while you are looking at the other.
      if (line.includes("theme-ok")) return;
      for (const { pattern, hint } of BANNED) {
        for (const match of line.matchAll(pattern)) {
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
  console.error(`Theme check failed — ${findings.length} literal colour(s):\n`);
  for (const { file, line, token, hint } of findings) {
    console.error(`  ${file}:${line}  ${token}  →  ${hint}`);
  }
  console.error(
    "\nAdd a trailing `theme-ok` comment on the line if a literal is genuinely intended.",
  );
  process.exit(1);
}

console.log("Theme check passed — every colour comes from a token.");
