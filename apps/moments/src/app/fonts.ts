import { DM_Sans, JetBrains_Mono, Unbounded } from 'next/font/google';

// Self-hosted at build time by next/font (blueprint section 2).
export const display = Unbounded({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800', '900'],
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

export const fontVariables = `${display.variable} ${body.variable} ${mono.variable}`;
