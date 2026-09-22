import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

/**
 * Sizes follow the design system, not shadcn's defaults: 52px for a primary
 * action, 44px as the minimum touch target, 40px for a header icon button.
 *
 * A button should look like something you can press. The primary one has a
 * slight top-to-bottom gradient, a shadow in its own colour, and gives 2%
 * under the finger; the outline one fills on hover; a bare icon button gets a
 * paper disc so it is a target and not a floating glyph.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-button border border-transparent font-semibold whitespace-nowrap transition-[background-color,border-color,box-shadow,transform,color] duration-150 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-linear-to-b from-action to-action-pressed text-white shadow-button hover:shadow-button-hover active:from-action-pressed active:to-action-pressed active:shadow-button",
        outline:
          "border-hairline-strong bg-surface text-ink hover:border-action hover:bg-action-tint hover:text-action",
        ghost: "text-ink-muted hover:bg-action-tint hover:text-action",
        destructive:
          "bg-negative-tint text-negative hover:bg-negative hover:text-white",
        link: "text-action underline-offset-4 hover:underline",
      },
      size: {
        /** Primary call to action. */
        lg: "h-[52px] px-5 text-[15px]",
        /** Minimum comfortable touch target. */
        default: "h-11 px-4 text-[14px]",
        /** Chips and inline actions. */
        sm: "h-9 rounded-full px-3.5 text-[13px] font-medium",
        icon: "size-10 rounded-full",
        "icon-sm": "size-8 rounded-full",
      },
    },
    compoundVariants: [
      { variant: "ghost", size: "icon", class: "bg-paper" },
      { variant: "ghost", size: "icon-sm", class: "bg-paper" },
    ],
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
