// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
// cn(): merges class names with Tailwind conflict resolution.
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
