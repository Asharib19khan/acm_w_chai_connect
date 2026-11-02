import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono, Unbounded } from 'next/font/google';

// Self-hosted at build time by next/font (blueprint section 2).
// Variable font (one file, every weight from 200 to 900): headings "breathe" with scroll speed.
export const display = Unbounded({
  subsets: ['latin'],
  variable: '--font-unbounded',
  display: 'swap',
});
export const body = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});
export const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

// The home hero title only: a characterful grotesque with a wide weight range.
export const hero = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-hero',
  display: 'swap',
});

export const fontVariables = `${display.variable} ${body.variable} ${mono.variable} ${hero.variable}`;
