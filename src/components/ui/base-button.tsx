/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     design-system
 * @purpose   The ONE button style table (cva) behind every button and button-styled link.
 * @status    reusable
 *
 * Buttons: one radius (`rounded-control`), one height scale, one motion step:
 *   xs 24 px (dense row floor) · sm 32 px (toolbars, secondary actions) · default 40 px ·
 *   lg 44 px (the page CTA, touch-first) · icon twins of each.
 * Variants: default = logo-cobalt primary fill (the ONE CTA) · secondary = tonal ·
 * outline = control border · ghost = no fill until hover · destructive = danger fill ·
 * link = inline text link. Colours are semantic bridge tokens only (no `/80` opacity hovers:
 * hover states are the computed `*-hover` deltas from globals.css).
 */
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-control border border-transparent bg-clip-padding font-sans text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-fast ease-standard outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-raised hover:bg-primary-hover aria-expanded:bg-primary-hover',
        secondary:
          'bg-tonal text-tonal-foreground hover:bg-tonal-hover aria-expanded:bg-tonal-hover',
        outline:
          'border-foreground/25 bg-transparent text-foreground hover:bg-nav-hover hover:text-nav-hover-foreground aria-expanded:bg-nav-hover',
        ghost:
          'bg-transparent text-foreground hover:bg-nav-hover hover:text-nav-hover-foreground aria-expanded:bg-nav-hover',
        destructive:
          'bg-destructive text-destructive-foreground shadow-raised hover:bg-destructive-hover focus-visible:ring-destructive/40',
        link: 'bg-transparent text-link underline-offset-4 hover:underline',
      },
      size: {
        xs: "h-6 gap-xs px-sm text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-xs px-3 text-sm [&_svg:not([class*='size-'])]:size-4",
        default: 'h-10 gap-sm px-4 text-sm',
        lg: 'h-11 gap-sm px-5 text-base',
        'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        icon: 'size-10',
        'icon-lg': "size-11 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    compoundVariants: [
      /* A link reads as text: no control box, whatever size the caller passes. */
      { variant: 'link', class: 'h-auto px-0' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
// Base-ui Button has no `children` in its props; the ddx-ui-kit DDXButton declares its own.
export type ButtonProps = ComponentProps<typeof Button>;
