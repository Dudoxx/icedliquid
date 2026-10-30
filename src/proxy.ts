// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
/**
 * Next 16 proxy: next-intl locale routing for en/de/fr/es, nothing else.
 * Node runtime only (never export `runtime`). API routes and static files skip it.
 */
import createIntlMiddleware from 'next-intl/middleware';

import { routing } from '@/i18n/routing';

export const proxy = createIntlMiddleware(routing);

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
