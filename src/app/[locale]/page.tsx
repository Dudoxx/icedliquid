// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
// Locale home: the app has one screen, so it redirects to /<locale>/voice-agent.
import { hasLocale } from 'next-intl';

import { redirect } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export default async function LocaleHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<never> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return redirect({ href: '/voice-agent', locale });
}
