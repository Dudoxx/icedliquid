'use client';
// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
/**
 * @ddx       hook
 * @domain    ui
 * @purpose   Typed adapter over next-themes `useTheme` (light | dark | system).
 * @status    foundation
 *
 * The provider is next-themes in AppProviders (light default); there is no in-house theme engine.
 */
import { useTheme as useNextTheme } from 'next-themes';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeModeValue {
  readonly theme: ThemeChoice;
  readonly resolvedTheme: ResolvedTheme;
  readonly setTheme: (next: ThemeChoice) => void;
}

function isChoice(value: string | undefined): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function useTheme(): ThemeModeValue {
  const { theme, resolvedTheme, setTheme } = useNextTheme();
  return {
    theme: isChoice(theme) ? theme : 'system',
    resolvedTheme: resolvedTheme === 'dark' ? 'dark' : 'light',
    setTheme,
  };
}
