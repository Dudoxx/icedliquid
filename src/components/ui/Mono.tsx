/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     typography
 * @purpose   JetBrains Mono span for machine strings: IDs, keys, codes, MIME types, ISO timestamps.
 * @status    reusable
 *
 * The ONE place mono type is chosen for a value. Person names, human dates, counts and KPI
 * values never use it — they are Inter (`Text numeric`, `Numeric`).
 */
import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

import { monoVariants, type MonoSize, type MonoTone } from './variants';

export interface MonoProps extends ComponentPropsWithoutRef<'span'> {
  readonly size?: MonoSize;
  readonly tone?: MonoTone;
}

export function Mono({
  size = 'xs',
  tone = 'default',
  className,
  ...props
}: MonoProps): React.JSX.Element {
  return (
    <span className={cn(monoVariants({ size, tone }), className)} {...props} />
  );
}
