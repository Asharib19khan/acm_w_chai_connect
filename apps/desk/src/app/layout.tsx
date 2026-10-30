import { PALETTE, ToastProvider } from '@chai/ui';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { fontVariables } from './fonts';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Games desk · Chai Connect', template: '%s · Games desk' },
  description: 'Chai Connect games desk for the ACM-W web team.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: PALETTE.canvas };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
