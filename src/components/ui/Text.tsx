/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     typography
 * @purpose   Inter body / UI / muted / small copy: role preset plus size, tone, weight and tabular-figure overrides.
 * @status    reusable
 */
import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

import {
  textVariants,
  type TextSize,
  type TextTone,
  type TextVariant,
  type TextWeight,
} from './variants';

type TextElement = 'p' | 'span' | 'div';

export interface TextProps extends ComponentPropsWithoutRef<'p'> {
  /** `body` running copy · `ui` controls/chrome · `muted` secondary · `small` metadata. */
  readonly variant?: TextVariant;
  /** Size override of the role preset: xs · sm · base · lg. */
  readonly size?: TextSize;
  /** Colour override: default · muted · subtle · primary · success · warning · destructive. */
  readonly tone?: TextTone;
  readonly weight?: TextWeight;
  /** Tabular figures (Inter) for counts, amounts and durations. */
  readonly numeric?: boolean;
  /** Element to render; `p` by default. Use `span` inside inline contexts. */
  readonly as?: TextElement;
}

export function Text({
  variant = 'body',
  size,
  tone,
  weight = 'regular',
  numeric = false,
  as: Tag = 'p',
  className,
  ...props
}: TextProps): React.JSX.Element {
  return (
    <Tag
      className={cn(textVariants({ variant, size, tone, weight, numeric }), className)}
      {...props}
    />
  );
}
