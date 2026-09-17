/**
 * Renders the app icons from the design system's own tokens, so the home
 * screen icon cannot drift from the brand. Run after changing the mark:
 * `node scripts/make-icons.mjs`. Outputs are committed.
 */
import { chromium } from "@playwright/test";
import { join } from "node:path";

const OUT = join(process.cwd(), "public");
const LAPIS = "#23459b";

/** `pad` leaves room for the circular crop Android applies to maskable icons. */
function markup({ size, pad, radius, background }) {
  const glyph = Math.round(size * (1 - pad * 2));
  return `<!doctype html><meta charset="utf-8">
<body style="margin:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${background};border-radius:${radius}px">
  <svg width="${glyph}" height="${glyph}" viewBox="0 0 100 100" fill="none">
    <!-- The signature element: a value with a rule under it, dashed where the
         model guessed. At icon scale it reads as a ledger line. -->
    <rect x="16" y="20" width="68" height="11" rx="5.5" fill="#ffffff" opacity="0.95"/>
    <rect x="16" y="41" width="44" height="11" rx="5.5" fill="#ffffff" opacity="0.72"/>
    <rect x="16" y="68" width="68" height="6" rx="3" fill="#ffffff" opacity="0.35"/>
    <rect x="16" y="68" width="14" height="6" rx="3" fill="#ffffff"/>
    <rect x="36" y="68" width="14" height="6" rx="3" fill="#ffffff"/>
    <rect x="56" y="68" width="14" height="6" rx="3" fill="#ffffff"/>
  </svg>
</body>`;
}

const browser = await chromium.launch();

const targets = [
  { file: "icon-192.png", size: 192, pad: 0.14, radius: 40, background: LAPIS },
  { file: "icon-512.png", size: 512, pad: 0.14, radius: 108, background: LAPIS },
  // Maskable icons get cropped to a circle, so the glyph sits further in and
  // the background bleeds to the edges.
  { file: "icon-maskable.png", size: 512, pad: 0.26, radius: 0, background: LAPIS },
  { file: "apple-icon.png", size: 180, pad: 0.14, radius: 0, background: LAPIS },
];

for (const target of targets) {
  const page = await browser.newPage({
    viewport: { width: target.size, height: target.size },
    deviceScaleFactor: 1,
  });
  await page.setContent(markup(target));
  await page.screenshot({ path: join(OUT, target.file), omitBackground: false });
  await page.close();
  console.log(`wrote ${target.file}`);
}

await browser.close();
