import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

/**
 * Sizes follow the design system, not shadcn's defaults: 52px for a primary
 * action, 44px as the minimum touch target, 40px for a header icon button.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control border border-transparent font-medium whitespace-nowrap transition-colors outline-none select-none disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-lapis text-white hover:bg-lapis/90 active:bg-lapis-pressed",
        outline:
          "border-hairline-strong bg-surface text-ink hover:border-lapis hover:bg-lapis-tint hover:text-lapis",
        ghost: "text-ink-muted hover:bg-lapis-tint hover:text-lapis",
        destructive:
          "bg-negative-tint text-negative hover:bg-negative hover:text-white",
        link: "text-lapis underline-offset-4 hover:underline",
      },
      size: {
        /** Primary call to action. */
        lg: "h-[52px] px-5 text-[15px] font-semibold",
        /** Minimum comfortable touch target. */
        default: "h-11 px-4 text-[14px]",
        /** Chips and inline actions. */
        sm: "h-9 rounded-full px-3.5 text-[13px]",
        icon: "size-10 rounded-full",
        "icon-sm": "size-8 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
