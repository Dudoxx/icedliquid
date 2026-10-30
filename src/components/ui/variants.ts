/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    ui
 * @topic     design-system
 * @purpose   Variant tables (cva) for the typography, surface, icon and switcher primitives.
 * @status    reusable
 *
 * Built on `cva` directly; prop names are `variant`, `mode`, `size`, `density`.
 * Every class is a semantic token utility from the `@theme inline` bridge — no hex,
 * no oklch literal, no arbitrary pixel or rem value class, no container border.
 */
import { cva, type VariantProps } from 'class-variance-authority';

/* ---------- Heading: Urbanist display face, two roles ---------- */

export const headingVariants = cva('font-display text-balance text-foreground', {
  variants: {
    variant: {
      /** Editorial / hero titles: the display scale, weight 700. */
      display: 'font-bold tracking-display',
      /** Page and section titles inside the shells: weight 600. */
      section: 'leading-tight font-semibold tracking-display',
    },
    size: {
      'display-xl': 'text-display-xl',
      'display-md': 'text-display-md',
      'display-sm': 'text-display-sm',
      '3xl': 'text-3xl',
      '2xl': 'text-2xl',
      xl: 'text-xl',
      lg: 'text-lg',
      base: 'text-base',
      sm: 'text-sm',
    },
  },
  defaultVariants: { variant: 'section', size: 'xl' },
});

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type HeadingVariant = NonNullable<VariantProps<typeof headingVariants>['variant']>;
export type HeadingSize = NonNullable<VariantProps<typeof headingVariants>['size']>;

/** Default size per role and level — a level picks the element, the size picks the step. */
export const HEADING_DEFAULT_SIZE: Record<HeadingVariant, Record<HeadingLevel, HeadingSize>> = {
  display: { 1: 'display-xl', 2: 'display-md', 3: 'display-sm', 4: '3xl', 5: '2xl', 6: 'xl' },
  section: { 1: '3xl', 2: '2xl', 3: 'xl', 4: 'lg', 5: 'base', 6: 'sm' },
};

/* ---------- Text: Inter UI/body roles ---------- */

/**
 * `variant` is the role preset (size + tone + line height in one word); `size` and `tone`
 * override one axis of it. Tones are semantic text colours only — `muted` is the
 * secondary ink, `subtle` the tertiary ink (never on a `bg-muted` fill: use `muted` there).
 */
export const textVariants = cva('font-sans text-pretty', {
  variants: {
    variant: {
      /** Running copy: follows the density line-height. */
      body: 'text-base leading-(--density-line-height) text-foreground',
      /** Control and chrome copy. */
      ui: 'text-sm leading-normal text-foreground',
      /** Secondary copy: descriptions, hints, metadata. */
      muted: 'text-sm leading-normal text-muted-foreground',
      /** Smallest step the scale ships (text-xs). */
      small: 'text-xs leading-normal text-muted-foreground',
    },
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
    },
    tone: {
      default: 'text-foreground',
      muted: 'text-muted-foreground',
      subtle: 'text-fg-tertiary',
      primary: 'text-link',
      success: 'text-success',
      warning: 'text-warning',
      destructive: 'text-destructive',
    },
    weight: {
      regular: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
    },
    /** Tabular figures for counts, amounts and durations set in Inter (not mono). */
    numeric: {
      true: 'lining-nums tabular-nums',
      false: '',
    },
  },
  defaultVariants: { variant: 'body', weight: 'regular', numeric: false },
});

export type TextVariant = NonNullable<VariantProps<typeof textVariants>['variant']>;
export type TextSize = NonNullable<VariantProps<typeof textVariants>['size']>;
export type TextTone = NonNullable<VariantProps<typeof textVariants>['tone']>;
export type TextWeight = NonNullable<VariantProps<typeof textVariants>['weight']>;

/* ---------- Label: form field label and eyebrow kicker ---------- */

export const labelVariants = cva('font-sans', {
  variants: {
    variant: {
      field: 'text-sm font-medium text-foreground',
      eyebrow: 'eyebrow',
    },
  },
  defaultVariants: { variant: 'field' },
});

export type LabelVariant = NonNullable<VariantProps<typeof labelVariants>['variant']>;

/* ---------- Code: JetBrains Mono, inline or block ---------- */

export const codeVariants = cva('font-mono text-foreground', {
  variants: {
    mode: {
      inline: 'rounded-inner bg-muted px-xs py-0.5 text-sm',
      block: 'block overflow-x-auto rounded-card bg-muted p-md text-sm leading-data',
    },
  },
  defaultVariants: { mode: 'inline' },
});

export type CodeMode = NonNullable<VariantProps<typeof codeVariants>['mode']>;

/* ---------- Mono: JetBrains Mono for machine strings ONLY ---------- */

/**
 * IDs, keys, codes, MIME types, event types, ISO timestamps, hashes. Never a person name,
 * a human date, a count or a KPI — those are Inter (`Text numeric` / `Numeric`).
 */
export const monoVariants = cva('font-mono break-all tabular-nums', {
  variants: {
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
    },
    tone: {
      default: 'text-foreground',
      muted: 'text-muted-foreground',
    },
  },
  defaultVariants: { size: 'xs', tone: 'default' },
});

export type MonoSize = NonNullable<VariantProps<typeof monoVariants>['size']>;
export type MonoTone = NonNullable<VariantProps<typeof monoVariants>['tone']>;

/* ---------- Numeric: tabular figures for data and KPIs ---------- */

export const numericVariants = cva('lining-nums tabular-nums', {
  variants: {
    variant: {
      /** Counts, amounts, durations in rows and cells: Inter with tabular figures. */
      data: 'font-sans leading-data text-foreground',
      /** Editorial big number (display face, tabular figures). */
      display: 'numeric-display text-foreground',
    },
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
      '2xl': 'text-2xl',
      'display-sm': 'text-display-sm',
      'display-md': 'text-display-md',
    },
  },
  defaultVariants: { variant: 'data', size: 'sm' },
});

export type NumericVariant = NonNullable<VariantProps<typeof numericVariants>['variant']>;
export type NumericSize = NonNullable<VariantProps<typeof numericVariants>['size']>;

/* ---------- Surface: elevation + tonal step, never a border ---------- */

export const surfaceVariants = cva('rounded-card border-0', {
  variants: {
    mode: {
      /** Sits in the page plane: tonal fill only, no shadow. */
      flat: 'shadow-none',
      /** Lifted card: elevation shadow on a card fill. */
      raised: '',
      /** Floating layer (popover, sheet body): popover fill + high elevation. */
      overlay: 'bg-popover text-popover-foreground',
    },
    tone: {
      base: 'bg-surface text-foreground',
      muted: 'bg-surface-muted text-foreground',
      elevated: 'bg-elevated text-card-foreground',
      /** A card ON the card-filled content panel: same as `elevated` in light, one step lighter in dark. */
      lifted: 'bg-lifted text-card-foreground',
    },
    elevation: {
      1: 'shadow-elev-1',
      2: 'shadow-elev-2',
      3: 'shadow-elev-3',
      4: 'shadow-elev-4',
    },
    /** Inner padding: `cosy` is the ONE card padding (`p-card`, 24 px). */
    density: {
      none: '',
      compact: 'p-md',
      cosy: 'p-card',
      large: 'p-card sm:p-xl',
    },
  },
  defaultVariants: { mode: 'raised', tone: 'elevated', density: 'cosy' },
});

export type SurfaceMode = NonNullable<VariantProps<typeof surfaceVariants>['mode']>;
export type SurfaceTone = NonNullable<VariantProps<typeof surfaceVariants>['tone']>;
export type SurfaceElevation = NonNullable<VariantProps<typeof surfaceVariants>['elevation']>;
export type SurfaceDensity = NonNullable<VariantProps<typeof surfaceVariants>['density']>;

/** Elevation a mode gets when the caller sets none; `flat` never takes a shadow. */
export const SURFACE_DEFAULT_ELEVATION: Record<SurfaceMode, SurfaceElevation | null> = {
  flat: null,
  raised: 1,
  overlay: 3,
};

/* ---------- Icon: Lucide only, size + stroke steps ---------- */

export const iconVariants = cva(
  'inline-flex shrink-0 items-center justify-center [&>svg]:size-full',
  {
    variants: {
      size: {
        xs: 'size-3',
        sm: 'size-4',
        md: 'size-5',
        lg: 'size-6',
        xl: 'size-8',
      },
      variant: {
        /** Fine line for dense chrome. */
        thin: '[&>svg]:stroke-1',
        /** Lucide default stroke. */
        regular: '[&>svg]:stroke-2',
      },
    },
    defaultVariants: { size: 'sm', variant: 'regular' },
  },
);

export type IconSize = NonNullable<VariantProps<typeof iconVariants>['size']>;
export type IconStroke = NonNullable<VariantProps<typeof iconVariants>['variant']>;

/* ---------- Switchers: one segmented-choice look for theme / density / palette ---------- */

export const switcherGroupVariants = cva('inline-flex items-center rounded-control bg-muted', {
  variants: {
    size: {
      sm: 'gap-0.5 p-0.5',
      md: 'gap-xs p-xs',
    },
  },
  defaultVariants: { size: 'md' },
});

export const switcherOptionVariants = cva(
  [
    'inline-flex items-center justify-center gap-xs rounded-control font-sans font-medium',
    'transition-colors duration-fast ease-standard',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:text-disabled',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'min-h-6 px-sm text-xs',
        md: 'min-h-8 px-sm text-sm',
      },
      active: {
        true: 'bg-card text-foreground shadow-elev-1',
        false: 'text-muted-foreground hover:bg-nav-hover hover:text-nav-hover-foreground',
      },
    },
    defaultVariants: { size: 'md', active: false },
  },
);

export type SwitcherSize = NonNullable<VariantProps<typeof switcherGroupVariants>['size']>;

/* ---------- Button: the face of the shadcn/base-ui button ---------- */

/** Button variant → the wrapped `ui/base-button` variant. `primary` is the ONE logo-cobalt CTA fill. */
export const BUTTON_VARIANT_MAP = {
  primary: 'default',
  secondary: 'secondary',
  outline: 'outline',
  ghost: 'ghost',
  destructive: 'destructive',
  /** Legacy alias of `destructive`. */
  danger: 'destructive',
  link: 'link',
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANT_MAP;

export const BUTTON_VARIANTS: ReadonlyArray<ButtonVariant> = [
  'primary',
  'secondary',
  'outline',
  'ghost',
  'destructive',
  'link',
];

/** Button size → the wrapped `ui/base-button` size (no arbitrary-radius sizes exposed). */
export const BUTTON_SIZE_MAP = {
  /** 24 px — dense row inline action (target floor). */
  xs: 'xs',
  /** 32 px — toolbar and secondary actions. */
  sm: 'sm',
  /** 40 px — default control height. */
  md: 'default',
  /** 44 px — the page CTA and touch-first actions. */
  lg: 'lg',
  /** 40 px square icon button (16 px glyph). */
  icon: 'icon',
  /** 32 px square icon button for toolbars. */
  'icon-sm': 'icon-sm',
} as const;

export type ButtonSize = keyof typeof BUTTON_SIZE_MAP;

/** Layout layer over the wrapped button (motion lives in `ui/base-button`: duration-fast, ease-standard). */
export const buttonLayoutVariants = cva('min-w-0', {
  variants: {
    width: {
      auto: '',
      full: 'w-full',
    },
    align: {
      center: 'justify-center',
      start: 'justify-start text-start',
    },
    /** `tall` lets a multi-line content button (org choice) grow past the control height. */
    height: {
      control: '',
      tall: 'h-auto py-sm',
    },
  },
  defaultVariants: { width: 'auto', align: 'center', height: 'control' },
});

export type ButtonWidth = NonNullable<VariantProps<typeof buttonLayoutVariants>['width']>;
export type ButtonAlign = NonNullable<VariantProps<typeof buttonLayoutVariants>['align']>;
export type ButtonHeight = NonNullable<VariantProps<typeof buttonLayoutVariants>['height']>;
