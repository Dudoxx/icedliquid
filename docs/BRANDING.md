<!-- © 2026 Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com> -->
# Branding

icedLiquid is a Dudoxx product. It uses the Dudoxx visual system
**D-016 "Logo Signal"**: the colours come from the Dudoxx toucan logo.
This page explains the colours, fonts and logos the app uses, so that a
change keeps the same look.

## Colour roles

The colours are tokens in `src/styles/brands/dudoxx.css`. `src/app/globals.css`
maps them to Tailwind utilities. Components use only the utilities, never a
colour value.

One action colour, one decorative signal, three status colours.

| Role | Utilities | Use |
|---|---|---|
| Brand action (logo cobalt) | `bg-primary`, `text-primary-foreground` | The one main button of a view (for example **Start talking**). Not for navigation, badges or counts. |
| Interactive (deep cobalt) | `text-link`, `ring-ring`, `text-info` | Links, focus rings, selected items, icon chips. |
| Signal (logo orange) | `bg-signal`, `bg-signal-soft` | Decoration only: small dots, rules, marks. Never body text, never a fill, never a second button. |
| Success | `text-success`, `bg-success` | Finished, normal. |
| Warning | `text-warning`, `bg-warning` | Pending, needs attention. |
| Destructive | `text-destructive`, `bg-destructive` | Errors, irreversible actions. |
| Grounds | `bg-background`, `bg-card`, `bg-muted`, `bg-footer` | Cool porcelain (light), navy-cobalt night (dark). |
| Ink | `text-foreground`, `text-muted-foreground` | Body and secondary text. |

Rules:

- A status colour always comes with an icon or a text label, never colour
  alone.
- No gradients in the app UI. Flat fills only.
- Dark mode is the same cobalt family made lighter on a navy ground, not an
  inversion. In dark mode a raised surface is lighter than its base.
- Hover, active and disabled states are computed from the resting token
  (`color-mix()`), not picked by hand.
- Contrast meets WCAG AA (4.5:1 for text) with visible focus rings.

## Type

Three faces, loaded with `next/font` in `src/app/fonts.ts`:

| Role | Utility | Face | Use |
|---|---|---|---|
| Display | `font-display` | Urbanist 600 / 700 | Headings, titles |
| UI and body | `font-sans` | Inter | All body text and controls; `tabular-nums` for counts and durations |
| Machine | `font-mono` | JetBrains Mono | IDs, codes, timings, technical values |

Do not add another typeface.

## Logos

| Mark | File | Use |
|---|---|---|
| Dudoxx toucan | `public/logo.png`, `public/icon.svg`, `public/favicon.ico` | Site header, favicon, README. |
| icedLiquid product mark | `src/components/icedliquid/IcedLiquidMark.tsx` | The stage and the empty conversation. |

Logo rules:

- Do not recolour, rotate, stretch or add shadows or glows to a logo. The
  toucan keeps its cobalt body and orange beak.
- Keep clear space of at least half the mark height around it.
- Minimum width of the toucan: 56 px.
- Do not put a logo on a busy photo without a solid overlay.

## Liquid AI: credited, not co-branded

The model, LFM3-Omni, is made by [Liquid AI](https://www.liquid.ai).
icedLiquid credits Liquid AI **in text, with a link**:

- in the site footer (`src/components/site/SiteFooter.tsx`);
- in the stage tagline and the conversation footer;
- in the [README](../README.md) and [NOTICE](../NOTICE).

icedLiquid does **not** show the Liquid AI logo and does not present itself
as a Liquid AI product. Keep it that way: no Liquid AI logo, no shared lock-up,
no "official" wording. The model weights keep their own license (see NOTICE).

## Where the tokens come from

`src/styles/brands/dudoxx.css` is generated from the Dudoxx brand tokens and
copied into this repo as is. To change a colour, change the token file as a
whole (light and dark twins together), never patch a value in a component or
in `globals.css`.
