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
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-[20px] bg-surface p-4 pb-6 shadow-lift",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-[220ms]",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
            // `start-1/2` is logical and `-translate-x-1/2` is physical, so in
            // an RTL document both pulled the same way: the right edge landed
            // on the centre line and the translate then pushed the sheet
            // *further left*, off the screen. A 440px sheet started at x=-148
            // on a 1024px viewport and at x=-180 on a 960px one, and at 1440px
            // it sat at x=60 where the centre is 500. The fix is the same one
            // components/ui/dialog.tsx already carries — flip the translate
            // with the direction. F07.
            "min-[960px]:inset-x-auto min-[960px]:bottom-auto min-[960px]:start-1/2 min-[960px]:top-1/2 min-[960px]:w-[440px] min-[960px]:-translate-x-1/2 min-[960px]:rtl:translate-x-1/2 min-[960px]:-translate-y-1/2 min-[960px]:rounded-card",
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
            {/* 32px of paint, 44px of target: the ring stays the size the
                design drew and `after` widens what a thumb has to hit. Growing
                the circle instead would have put a 44px grey disc beside a
                17px title. */}
            <DialogPrimitive.Close
              aria-label="بستن"
              className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-paper text-ink-muted after:absolute after:-inset-1.5 after:content-[''] hover:text-ink"
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
