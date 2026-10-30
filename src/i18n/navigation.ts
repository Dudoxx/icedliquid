// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
// Locale-aware Link, redirect, useRouter and usePathname.
import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
