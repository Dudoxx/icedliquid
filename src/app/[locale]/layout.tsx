// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
/**
 * Locale layout: owns `<html lang data-brand>` and `<body>`, mounts the theme provider (light
 * default) and the next-intl client provider. It reads no cookies, so it renders statically per locale.
 */
import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import '../globals.css';
import { fontVariables } from '@/app/fonts';
import { AppProviders } from '@/components/providers/AppProviders';
import { routing } from '@/i18n/routing';
import { brand, tokens } from '@/styles/brand-tokens';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'common' });
  const name = t('meta.name');
  return {
    title: { default: name, template: `%s | ${name}` },
    description: t('meta.description'),
    icons: { icon: '/favicon.ico' },
  };
}

// Browser chrome colour cannot read CSS variables, so it takes the brand contract's hex values.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: tokens.color.bg.hex },
    { media: '(prefers-color-scheme: dark)', color: tokens.color.dark.bg.hex },
  ],
};

export function generateStaticParams(): Array<{ locale: string }> {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}): Promise<React.JSX.Element> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} data-brand={brand} suppressHydrationWarning className={fontVariables}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <AppProviders>
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </AppProviders>
      </body>
    </html>
  );
}
