import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  /** Sits beside the label, for «حدس زدم» on a control we filled in ourselves. */
  note?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function Field({
  label,
  htmlFor,
  error,
  hint,
  note,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline gap-1.5">
        <label htmlFor={htmlFor} className="text-label font-medium text-ink-muted">
          {label}
        </label>
        {note && (
          <span className="text-caption font-medium text-guess">· {note}</span>
        )}
      </div>
      {children}
      {hint && !error && <p className="text-caption text-ink-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-caption font-medium text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

/** Form-level failure: what happened, and what the user should do about it. */
export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-control border border-negative/25 bg-negative-tint px-3 py-2.5 text-caption font-medium text-negative"
    >
      {children}
    </p>
  );
}
