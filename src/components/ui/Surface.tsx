/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     design-system
 * @purpose   Container surface built from a tonal fill step plus elevation shadow, never a border.
 * @status    reusable
 *
 * `mode` picks the plane (flat in-page, raised card, floating overlay) and a default
 * elevation; `elevation` overrides it (ignored for `flat`). Never nest a raised
 * Surface in another raised Surface — use `flat` + `tone="muted"` for inner zones.
 */
import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

import {
  SURFACE_DEFAULT_ELEVATION,
  surfaceVariants,
  type SurfaceDensity,
  type SurfaceElevation,
  type SurfaceMode,
  type SurfaceTone,
} from './variants';

type SurfaceElement = 'div' | 'section' | 'article' | 'aside' | 'nav';

export interface SurfaceProps extends ComponentPropsWithoutRef<'div'> {
  readonly mode?: SurfaceMode;
  readonly tone?: SurfaceTone;
  /** Shadow step 1–4 (`shadow-elev-N`); defaults from `mode`. */
  readonly elevation?: SurfaceElevation;
  /** Inner padding step; `none` when the child owns its padding. */
  readonly density?: SurfaceDensity;
  readonly as?: SurfaceElement;
}

export function Surface({
  mode = 'raised',
  tone = 'elevated',
  elevation,
  density = 'cosy',
  as: Tag = 'div',
  className,
  ...props
}: SurfaceProps): React.JSX.Element {
  const step = mode === 'flat' ? null : (elevation ?? SURFACE_DEFAULT_ELEVATION[mode]);
  return (
    <Tag
      data-surface={mode}
      className={cn(surfaceVariants({ mode, tone, density, elevation: step }), className)}
      {...props}
    />
  );
}
