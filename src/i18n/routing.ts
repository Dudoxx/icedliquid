// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
// next-intl routing definition: locale list, default and prefix strategy (one source for proxy + navigation).
import { defineRouting } from 'next-intl/routing';

import { defaultLocale, locales } from './types';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
});
