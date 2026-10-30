'use client';
/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    shell
 * @topic     app-shell
 * @purpose   Site header: Dudoxx logo + icedLiquid name (home link), the en/de/fr/es locale switch and the light/dark toggle.
 * @status    reusable
 *
 * Sticky, `--header-height` tall; the voice-agent stage subtracts that height. The locale switch
 * is one link per locale to the same path (no menu, no portal). The theme toggle reads the mode
 * from the `.dark` class through `dark:` variants, so the server render and the first client
 * render match before next-themes has resolved the stored mode.
 */
import { Moon, Sun } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { useTheme } from '@/components/icedliquid/ThemeMode';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Icon } from '@/components/ui/Icon';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';

function LocaleSwitch(): React.JSX.Element {
  const t = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <nav aria-label={t('header.locale.label')} className="flex items-center gap-xs">
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          aria-label={t(`header.locale.names.${l}`)}
          aria-current={l === locale ? 'true' : undefined}
          className={cn(
            'inline-flex h-(--control-md) min-w-(--control-md) items-center justify-center rounded-control px-xs font-mono text-xs font-medium uppercase transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            l === locale
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:bg-nav-hover hover:text-foreground',
          )}
        >
          {l}
        </Link>
      ))}
    </nav>
  );
}

function ThemeToggle(): React.JSX.Element {
  const t = useTranslations('common');
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      title={t('header.theme.label')}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="inline-flex size-(--control-md) items-center justify-center rounded-control text-muted-foreground transition-colors duration-fast hover:bg-nav-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Icon icon={Moon} size="sm" className="dark:hidden" />
      <Icon icon={Sun} size="sm" className="hidden dark:inline-flex" />
      <span className="sr-only dark:hidden">{t('header.theme.toDark')}</span>
      <span className="hidden dark:block dark:sr-only">{t('header.theme.toLight')}</span>
    </button>
  );
}

export function SiteHeader(): React.JSX.Element {
  const t = useTranslations('common');
  const tBrand = useTranslations('brand');
  return (
    <header className="sticky top-0 z-(--z-chrome) h-(--header-height) chrome-bar seam-x">
      <div className="flex h-full items-center justify-between gap-md px-(--shell-gutter)">
        <Link
          href="/voice-agent"
          aria-label={t('header.home')}
          className="inline-flex min-w-0 items-center gap-sm rounded-control focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <BrandLogo instantiation={{ name: tBrand('name') }} overrides={{ size: 'sm' }} />
          <span aria-hidden="true" className="truncate font-display text-base font-semibold text-foreground">
            {t('meta.name')}
          </span>
        </Link>
        <div className="flex items-center gap-sm">
          <LocaleSwitch />
          <span aria-hidden="true" className="h-6 w-px bg-border" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
