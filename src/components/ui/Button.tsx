/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     design-system
 * @purpose   Button: wraps the shadcn/base-ui button on the ONE `{ instantiation, overrides }` shape.
 * @status    reusable
 *
 * `instantiation` says what the button IS (translated content, submit/click/href, pending);
 * `overrides` say how it looks (variant, size, width, align, height) — values from the
 * semantic token tables in `./variants` only. With `href` it renders a locale-aware link
 * styled as a button (navigation stays a link, never `onClick` + router).
 * `pending` disables the control, sets `aria-busy` and shows a reduced-motion-safe spinner.
 * Scale: primary · secondary · outline · ghost · destructive · link ×
 * xs 24 · sm 32 · md 40 · lg 44 px · icon 40 · icon-sm 32. ONE `primary` per view.
 */
import { Loader2, type LucideIcon } from 'lucide-react';
import type { ComponentProps as ReactComponentProps, ReactNode } from 'react';

import { Button as UiButton, buttonVariants } from '@/components/ui/base-button';
import { Link } from '@/i18n/navigation';
import type { ComponentProps } from './types';
import { cn } from '@/lib/utils';

import { Icon } from './Icon';
import {
  BUTTON_SIZE_MAP,
  BUTTON_VARIANT_MAP,
  buttonLayoutVariants,
  type ButtonAlign,
  type ButtonHeight,
  type ButtonSize,
  type ButtonVariant,
  type ButtonWidth,
} from './variants';

export interface ButtonInstantiation {
  /** Already-translated label, or composed content (icon + text + trailing badge). */
  readonly content: ReactNode;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly onClick?: () => void;
  /** Navigation target: renders a locale-aware link styled as this button. */
  readonly href?: ReactComponentProps<typeof Link>['href'];
  /** Leading decorative lucide glyph. */
  readonly icon?: LucideIcon;
  /** Trailing decorative lucide glyph (chevron, external-link). */
  readonly iconEnd?: LucideIcon;
  /** Translated accessible name — required when `content` is not readable text (icon-only). */
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  /** Request in flight: disabled + `aria-busy` + spinner. */
  readonly pending?: boolean;
}

export interface ButtonOverrides {
  variant: ButtonVariant;
  size: ButtonSize;
  width: ButtonWidth;
  align: ButtonAlign;
  height: ButtonHeight;
}

export type ButtonProps = ComponentProps<ButtonInstantiation, ButtonOverrides>;

export function Button({ instantiation, overrides }: ButtonProps): React.JSX.Element {
  const {
    content,
    type = 'button',
    onClick,
    href,
    icon,
    iconEnd,
    ariaLabel,
    disabled = false,
    pending = false,
  } = instantiation;
  const variant = BUTTON_VARIANT_MAP[overrides?.variant ?? 'primary'];
  const size = BUTTON_SIZE_MAP[overrides?.size ?? 'md'];
  const layout = buttonLayoutVariants({
    width: overrides?.width ?? 'auto',
    align: overrides?.align ?? 'center',
    height: overrides?.height ?? 'control',
  });

  const body = (
    <>
      {pending ? (
        <Icon icon={Loader2} size="sm" className="animate-spin motion-reduce:animate-none" />
      ) : icon ? (
        <Icon icon={icon} size="sm" />
      ) : null}
      {content}
      {iconEnd ? <Icon icon={iconEnd} size="sm" /> : null}
    </>
  );

  if (href !== undefined) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        className={cn(buttonVariants({ variant, size }), layout)}
      >
        {body}
      </Link>
    );
  }

  return (
    <UiButton
      type={type}
      variant={variant}
      size={size}
      className={layout}
      aria-label={ariaLabel}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      onClick={onClick}
    >
      {body}
    </UiButton>
  );
}
