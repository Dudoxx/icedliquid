// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
// Locale-level 404: a short message and a link back to the voice assistant.
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

export default async function LocaleNotFound(): Promise<React.JSX.Element> {
  const t = await getTranslations('common');
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-stack px-(--shell-gutter) text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="font-display text-display-sm text-foreground">{t('notFound.title')}</h1>
      <p className="max-w-prose text-base text-muted-foreground">{t('notFound.body')}</p>
      <Link
        href="/voice-agent"
        className="inline-flex h-(--control-touch) items-center rounded-control bg-primary px-card text-base font-semibold text-primary-foreground shadow-raised transition-colors duration-fast hover:bg-primary-hover"
      >
        {t('notFound.back')}
      </Link>
    </main>
  );
}
