import { statusLabel, statusTone, type Tone } from "@/lib/admin/status";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-positive-tint text-positive",
  bad: "bg-negative-tint text-negative",
  wait: "bg-guess-tint text-guess-text",
  mute: "bg-paper text-ink-muted",
  accent: "bg-action-tint text-action",
};

/**
 * A status, said in Persian and coloured by what it means.
 *
 * The dot is not decoration: colour alone must not be the carrier, and in a
 * table of pills the shape is what the eye picks up before the hue. The word
 * beside it is the real signal — see lib/admin/status.ts for the vocabulary,
 * which is shared so that `rejected` cannot read as a failure on one page and
 * as a safeguard on another.
 */
export function StatusPill({
  status,
  label,
  tone,
  className,
}: {
  status: string | null | undefined;
  /** Overrides the shared Persian label, for a state with local meaning. */
  label?: string;
  /** Overrides the shared tone. Use sparingly; the point is one vocabulary. */
  tone?: Tone;
  className?: string;
}) {
  const resolved = tone ?? statusTone(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-micro font-semibold whitespace-nowrap",
        TONE_CLASS[resolved],
        className,
      )}
    >
      <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-current" />
      {label ?? statusLabel(status)}
    </span>
  );
}
