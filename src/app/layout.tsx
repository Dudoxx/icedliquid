// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
/**
 * Top-level layout: a pass-through. `src/app/[locale]/layout.tsx` owns `<html>` and `<body>`,
 * because only it knows the locale; the proxy sends every page URL to a locale prefix.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  return children;
}
