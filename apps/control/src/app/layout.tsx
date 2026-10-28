import { PALETTE, ToastProvider } from '@chai/ui';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { fontVariables } from './fonts';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Chai Connect · Live', template: '%s · Chai Connect' },
  description: 'Chai Connect auditorium display.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: PALETTE.ink,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="cc-night min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
