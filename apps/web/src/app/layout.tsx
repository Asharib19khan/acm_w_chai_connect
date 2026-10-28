import { PALETTE } from '@chai/ui';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chai Connect',
  description: 'ACM-W Chai Connect at FAST-NUCES Karachi, 25 November 2026.',
};

export const viewport: Viewport = {
  themeColor: PALETTE.ink,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
