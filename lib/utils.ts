import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge does not know this project's type scale. `text-title` is not
 * a size it recognises, so it files it under `text-<colour>` — and the moment
 * a real colour follows it (`cn("text-title font-semibold text-ink")`), the
 * "earlier colour" is dropped and the heading falls back to body size. That
 * happened silently: typecheck, lint and every test stay green, and the page
 * only looks a little smaller than it should.
 *
 * Listing the scale here is what lets `text-caption text-ink-muted` keep both.
 * Every `--text-*` token in app/globals.css must appear in this list, or it
 * will be lost the first time it meets a colour inside cn().
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "figure-lg",
        "figure-md",
        "question",
        "title",
        "section",
        "body",
        "label",
        "caption",
        "micro",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
