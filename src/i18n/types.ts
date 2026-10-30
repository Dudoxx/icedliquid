// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
// Locale and message-namespace registry.
export const locales = ['en', 'de', 'fr', 'es'] as const; // every locale here needs a full messages/<code>/ tree
export type Locale = (typeof locales)[number];

/** One entry per file in messages/<locale>/; the loader (./request.ts) imports each one. */
export const namespaces = ['common', 'voice', 'brand', 'realtime'] as const;
export type Namespace = (typeof namespaces)[number];

export const defaultLocale: Locale = 'en';

export function isValidLocale(locale: string): locale is Locale {
  return (locales as readonly string[]).includes(locale);
}

/**
 * Narrow a route-param / form-field locale (`string`) to `Locale`.
 * The `[locale]` layout already 404s unknown locales; this guards values read in the browser.
 */
export function toLocale(value: string): Locale {
  return isValidLocale(value) ? value : defaultLocale;
}
