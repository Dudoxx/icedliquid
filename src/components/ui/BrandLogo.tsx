/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     branding
 * @purpose   The Dudoxx D-016 logo: the platform mark `/logo.png` with an optional visible name.
 * @status    reusable
 *
 * One static brand: the mark carries the accessible name; a visible name next to it is hidden
 * from assistive tech. `name` is a proper noun, never an i18n key.
 */
import { useTranslations } from 'next-intl';
import Image from 'next/image';

import { cn } from '@/lib/utils';

import type { ComponentProps } from './types';

export type BrandLogoSize = 'sm' | 'md' | 'lg';

export interface BrandLogoInstantiation {
  /** Display name of the brand (a proper noun). */
  name: string;
}

export interface BrandLogoOverrides {
  size: BrandLogoSize;
  /** Show the name beside the mark. */
  withName: boolean;
  className: string;
}

/** Mark box per size: the control-sm / size-8 / size-12 token steps. */
const MARK_CLASS: Readonly<Record<BrandLogoSize, string>> = {
  sm: 'size-(--control-sm)',
  md: 'size-8',
  lg: 'size-12',
};

/** next/image intrinsic size per step (layout comes from MARK_CLASS). */
const IMAGE_SIZE: Readonly<Record<BrandLogoSize, number>> = { sm: 28, md: 32, lg: 48 };

const NAME_CLASS: Readonly<Record<BrandLogoSize, string>> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export function BrandLogo({
  instantiation,
  overrides,
}: ComponentProps<BrandLogoInstantiation, BrandLogoOverrides>): React.JSX.Element {
  const t = useTranslations('brand');
  const { name } = instantiation;
  const size = overrides?.size ?? 'md';
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-sm', overrides?.className)}>
      <Image
        src="/logo.png"
        alt={t('logo.alt', { name })}
        width={IMAGE_SIZE[size]}
        height={IMAGE_SIZE[size]}
        className={cn(MARK_CLASS[size], 'shrink-0 object-contain')}
      />
      {overrides?.withName === true ? (
        <span
          aria-hidden="true"
          className={cn('truncate font-display font-semibold text-foreground', NAME_CLASS[size])}
        >
          {name}
        </span>
      ) : null}
    </span>
  );
}
