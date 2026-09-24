/**
 * Fails the build on a form that would submit as a GET before hydration.
 *
 * A `<form onSubmit={…}>` with no `method` is a GET until React takes the page
 * over, so a click that lands early navigates with every field in the query
 * string. On 2026-09-24 that put a real password in an address bar, in browser
 * history, in the next request's Referer and in the access log — and it passed
 * typecheck, lint, every unit test and the whole e2e suite on the way there.
 *
 * Two rules, both narrow enough to have no false positives:
 *
 *   * a file that renders a password field must declare `method` or `action`
 *     on every form in it;
 *   * so must every form under app/onboarding, which asks for a name, an
 *     income and what is owed, on a server-rendered page.
 *
 * Forms inside a <BottomSheet> are deliberately not covered: the sheet is
 * opened by JavaScript, so by the time one exists the page is hydrated.
 * A form that is *meant* to be a GET passes by naming its own `action` — the
 * dashboard's search box points at /transactions on purpose.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components"];

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      yield* walk(full);
    } else if (entry.name.endsWith(".tsx")) {
      yield full;
    }
  }
}

const findings = [];

for (const file of SCAN_DIRS.map((dir) => join(ROOT, dir))) {
  for await (const path of walk(file)) {
    const source = await readFile(path, "utf8");
    const rel = relative(ROOT, path);

    const hasPassword = source.includes('type="password"');
    const isOnboarding = rel.split(sep).slice(0, 2).join("/") === "app/onboarding";
    if (!hasPassword && !isOnboarding) continue;

    const why = hasPassword ? "renders a password field" : "is an onboarding step";

    // The opening tag, up to the first `>` that is not inside braces. Good
    // enough: these files are ordinary JSX and the attributes we look for sit
    // on the first line or two.
    for (const match of source.matchAll(/<form\b([^]*?)>/g)) {
      const attrs = match[1];
      if (/\bmethod=/.test(attrs) || /\baction=/.test(attrs)) continue;

      const line = source.slice(0, match.index).split("\n").length;
      findings.push({ file: rel, line, why });
    }
  }
}

if (findings.length > 0) {
  console.error(`Form check failed — ${findings.length} form(s) that would GET before hydration:\n`);
  for (const { file, line, why } of findings) {
    console.error(`  ${file}:${line}  (${why})  →  add method="post"`);
  }
  console.error(
    '\nA form meant to submit as a GET names its own action, like the dashboard search box.',
  );
  process.exit(1);
}

console.log("Form check passed — no form can submit before hydration.");
