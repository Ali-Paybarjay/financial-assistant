"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

type ConfidenceValueProps = {
  children: React.ReactNode;
  /** True while the value is still the model's guess. */
  isGuess: boolean;
  /** Field label shown above the value, e.g. «دسته». */
  label?: string;
  /** Play the settle animation once, when a guess has just been accepted. */
  justConfirmed?: boolean;
  className?: string;
};

/**
 * The signature element. A 2px rule under any value the model produced:
 * dashed brass while it is a guess, solid ink once the user has confirmed it.
 *
 * Colour is never the only carrier — the word «حدس زدم» is always rendered
 * alongside and wired to the value through aria-describedby.
 */
export function ConfidenceValue({
  children,
  isGuess,
  label,
  justConfirmed = false,
  className,
}: ConfidenceValueProps) {
  const noteId = useId();

  return (
    <div className={cn("flex flex-col gap-[3px]", className)}>
      {label && (
        <span
          className={cn(
            "text-caption font-medium",
            isGuess ? "text-guess" : "text-ink-muted",
          )}
        >
          {label}
          {isGuess && <span className="mx-1">·</span>}
          {isGuess && <span id={noteId}>حدس زدم</span>}
        </span>
      )}
      <span
        aria-describedby={isGuess && label ? noteId : undefined}
        className={cn(
          "w-fit font-medium",
          isGuess ? "rule-guess text-guess-text" : "rule-settled text-ink",
          justConfirmed && !isGuess && "confidence-settle",
        )}
      >
        {children}
      </span>
    </div>
  );
}

/**
 * The same state as a standalone pill, for places with no room for a label
 * above the value (a transaction row, a dashboard total).
 */
export function GuessPill({ children = "حدس زدم" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full bg-guess-tint px-[9px] text-caption font-semibold text-guess">
      {children}
    </span>
  );
}
