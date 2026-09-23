import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows Tailwind's own font sizes. This project's scale is
 * custom — `text-caption`, `text-micro`, `text-title` and the rest come from
 * the `@theme` block in app/globals.css — so tailwind-merge files them under
 * `text-<colour>` instead. The moment a real colour follows one inside `cn()`,
 * the "earlier colour" wins and the size is dropped:
 *
 *     cn("text-caption font-medium", isGuess ? "text-guess" : "text-ink-muted")
 *     -> "font-medium text-ink-muted"        // 12px silently became 15px
 *
 * That is not theoretical: the meta line under every transaction row was
 * rendering at the inherited body size. Nothing catches it — typecheck, lint,
 * check:rtl, the unit tests and the e2e suite all stay green, because no gate
 * measures a font size.
 *
 * Listing the scale here is what lets both classes survive. Every `--text-*`
 * token in app/globals.css must appear below, or it will be lost the first
 * time it meets a colour inside `cn()`.
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
