// © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
/**
 * The one next/font loader for the Dudoxx D-016 three-face stack: Urbanist = display (600/700),
 * Inter = UI/body, JetBrains Mono = data (IDs, timestamps, codes, tabular numbers).
 * Each face sets a family variable that the `@theme inline` bridge in globals.css reads first,
 * with the brand file's `--token-font-*` stacks as fallback. Only the `[locale]` layout applies
 * `fontVariables` (on `<html>`).
 */
import { Inter, JetBrains_Mono, Urbanist } from 'next/font/google';

const urbanist = Urbanist({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-urbanist',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jbmono',
  display: 'swap',
});

/** Class list that declares every family variable. Apply once, on `<html>`. */
export const fontVariables = `${inter.variable} ${urbanist.variable} ${jetbrainsMono.variable}`;
