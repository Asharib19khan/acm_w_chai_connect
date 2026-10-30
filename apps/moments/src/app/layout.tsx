import { PALETTE, ToastProvider, Wordmark } from '@chai/ui';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { fontVariables } from './fonts';
import { ClickSpark } from './click-spark';
import { IntroGate } from './intro';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Share moments · Chai Connect', template: '%s · Chai Connect' },
  description: 'Send your photos and videos from ACM-W Chai Connect 2026.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: PALETTE.canvas,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        <ClickSpark
          className="flex min-h-dvh flex-1 flex-col"
          style={{ height: 'auto' }}
          sparkColor={['#eb9fef', '#d46fdb', '#7c4f88']}
          shape="line"
          sparkCount={10}
          sparkSize={16}
          sparkWidth={2.5}
          sparkRadius={36}
          duration={520}
          glow={0.5}
        >
          <ToastProvider>
            <IntroGate>
              <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-5 sm:px-8 sm:pt-8">
                <Wordmark compact className="text-fg text-[1.05rem]" />
                <span className="font-display text-fg text-[1.05rem] font-black tracking-[-0.02em]">
                  ACM-<span className="text-accent">W</span>
                </span>
              </header>
              <main id="main" className="flex-1">
                {children}
              </main>
              <footer className="text-fg-subtle mx-auto w-full max-w-3xl px-4 pt-20 pb-8 text-xs sm:px-8">
                ACM-W Chai Connect · FAST-NUCES Karachi
              </footer>
            </IntroGate>
          </ToastProvider>
        </ClickSpark>
      </body>
    </html>
  );
}
