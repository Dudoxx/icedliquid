/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     typography
 * @purpose   Semantic h1–h6 in the Urbanist display face with display / section roles.
 * @status    reusable
 *
 * `level` picks the element (document outline); `size` picks the visual step, so a
 * card title can be an h3 that looks like an h4 without skipping the outline.
 */
import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

import {
  HEADING_DEFAULT_SIZE,
  headingVariants,
  type HeadingLevel,
  type HeadingSize,
  type HeadingVariant,
} from './variants';

export interface HeadingProps extends ComponentPropsWithoutRef<'h2'> {
  /** Outline level: renders `<h{level}>`. */
  readonly level: HeadingLevel;
  /** `display` = editorial / hero, `section` = page and section titles. */
  readonly variant?: HeadingVariant;
  /** Visual step override; defaults from role + level. */
  readonly size?: HeadingSize;
}

export function Heading({
  level,
  variant = 'section',
  size,
  className,
  ...props
}: HeadingProps): React.JSX.Element {
  const Tag = `h${level}` as const;
  const step = size ?? HEADING_DEFAULT_SIZE[variant][level];
  return (
    <Tag
      className={cn(headingVariants({ variant, size: step }), className)}
      {...props}
    />
  );
}
