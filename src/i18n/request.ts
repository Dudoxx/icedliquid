// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
/**
 * next-intl request config: one message namespace per `messages/<locale>/<ns>.json`.
 *
 * - Locale source: the explicit `locale` override (Route Handlers), else the `[locale]` segment
 *   that the layout passes through `setRequestLocale`, else the proxy's locale header.
 * - Messages: every namespace in `namespaces` (./types) is imported and merged under its name.
 *   A missing or malformed file throws; it never renders an empty tree.
 * - Missing keys render `namespace.key` and are reported once per process.
 */
import { hasLocale, type IntlError } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';
import { namespaces, type Locale } from './types';

type MessageTree = Record<string, Record<string, unknown>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function loadMessages(locale: Locale): Promise<MessageTree> {
  const entries = await Promise.all(
    namespaces.map(async (ns) => {
      const mod: unknown = await import(`../../messages/${locale}/${ns}.json`);
      const messages = isRecord(mod) ? mod['default'] : undefined;
      if (!isRecord(messages))
        throw new Error(`[i18n] messages/${locale}/${ns}.json has no object default export`);
      return [ns, messages] as const;
    }),
  );
  return Object.fromEntries(entries);
}

const reported = new Set<string>();

function reportIntlError(locale: Locale, error: IntlError): void {
  const message = error.originalMessage ?? error.message;
  const id = `${locale}|${error.code}|${message}`;
  if (reported.has(id)) return;
  reported.add(id);
  console.error(`[i18n] ${error.code} (${locale}): ${message}`);
}

export default getRequestConfig(async ({ locale: override, requestLocale }) => {
  const candidate = override ?? (await requestLocale);
  const locale: Locale = hasLocale(routing.locales, candidate) ? candidate : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: 'Europe/Berlin',
    onError(error: IntlError): void {
      reportIntlError(locale, error);
    },
    getMessageFallback({ namespace, key }: { namespace?: string; key: string }): string {
      return namespace ? `${namespace}.${key}` : key;
    },
  };
});
