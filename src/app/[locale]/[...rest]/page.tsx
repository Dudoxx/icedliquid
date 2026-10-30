// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
// Catch-all under a locale: any unknown path renders the localized not-found inside <html>.
import { notFound } from 'next/navigation';

export default function UnknownPath(): never {
  notFound();
}
