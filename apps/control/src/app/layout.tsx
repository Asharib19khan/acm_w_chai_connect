import { PALETTE } from '@chai/ui';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chai Connect · Live',
  description: 'Chai Connect auditorium display.',
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
