// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
// Client providers for the whole app: next-themes with light as the default and dark as the only other mode.
'use client';

import { ThemeProvider } from 'next-themes';

export function AppProviders({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      themes={['light', 'dark']}
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
