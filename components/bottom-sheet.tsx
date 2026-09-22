"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/**
 * The sheet the design uses for every modal: it rises from the bottom on a
 * phone and centres on a wide screen. Not shadcn's Dialog shell, which centres
 * everywhere and puts its close button in a physical corner.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-[rgb(20_24_31/0.45)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-[20px] bg-surface p-4 pb-6 shadow-[0_-10px_30px_-18px_rgb(20_24_31/0.4)]",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-[220ms]",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
            "min-[960px]:inset-x-auto min-[960px]:bottom-auto min-[960px]:start-1/2 min-[960px]:top-1/2 min-[960px]:w-[440px] min-[960px]:-translate-x-1/2 min-[960px]:-translate-y-1/2 min-[960px]:rounded-card",
          )}
        >
          <div
            aria-hidden
            className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline-strong min-[960px]:hidden"
          />
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <DialogPrimitive.Title className="text-title font-semibold text-ink">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 text-caption text-ink-muted">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label="بستن"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-paper text-ink-muted hover:text-ink"
            >
              <X size={16} />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
