/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     voice
 * @purpose   icedLiquid logo: an ice cube holding a liquid wave with a falling drop (a nod to Liquid AI), plus the optional "iced·Liquid" wordmark; colours are semantic tokens only.
 * @status    feature-local
 *
 * Inline SVG so it inherits the theme and palette: outline = currentColor, liquid and drop =
 * `fill-primary`, ice highlights = currentColor at reduced opacity. No hex enters the tree.
 */
import { cn } from '@/lib/utils';

export function IcedLiquidMark({
  label,
  wordmark,
  className,
}: {
  /** Translated accessible name; omit when a visible wordmark names it. */
  label?: string;
  /** The assistant name to show beside the mark ("icedLiquid"), split as iced + Liquid. */
  wordmark?: string;
  className?: string;
}): React.JSX.Element {
  const split = wordmark ? /^(iced)(.*)$/i.exec(wordmark) : null;
  return (
    <span className={cn('inline-flex items-center gap-sm text-foreground', className)}>
      <svg
        viewBox="0 0 48 48"
        className="size-10 shrink-0"
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        {/* ice cube */}
        <rect x="5" y="9" width="34" height="34" rx="10" className="fill-primary/10 stroke-current" strokeWidth="2.5" />
        {/* liquid inside the cube */}
        <path
          d="M7.5 27c5-3.6 9.6 3.4 15.6 0s9.4-3.6 13.4-.6V33a7.5 7.5 0 0 1-7.5 7.5h-14A7.5 7.5 0 0 1 7.5 33z"
          className="fill-primary"
        />
        {/* ice highlights */}
        <path d="M12 16.5h7M12 21h3.5" className="stroke-current" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
        {/* the drop */}
        <path d="M40.5 3.5s-5 5.6-5 8.8a5 5 0 0 0 10 0c0-3.2-5-8.8-5-8.8z" className="fill-primary" />
      </svg>
      {split ? (
        <span className="font-display text-xl leading-none tracking-tight">
          <span className="font-normal text-muted-foreground">{split[1]}</span>
          <span className="font-semibold text-primary">{split[2]}</span>
        </span>
      ) : null}
    </span>
  );
}
