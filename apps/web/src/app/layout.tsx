import { ToastProvider } from '@chai/ui';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { IntroGate } from '@/components/intro';
import { BreathingType } from '@/components/breathing-type';
import { ChaiPet } from '@/components/chai-pet';
import { GamesNight } from '@/components/games-night';
import { JoinToasts } from '@/components/join-toasts';
import { LiveReaders } from '@/components/live-readers';
import { NightShade } from '@/components/night-shade';
import { NoticeYou } from '@/components/notice-you';
import { SoundWiring } from '@/components/sound-wiring';
import { SiteFooter, SiteHeader, TopStrip } from '@/components/site-chrome';
import { fontVariables } from './fonts';
import './globals.css';

// Reads live data (settings, quiz state) on every request.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Chai Connect', template: '%s · Chai Connect' },
  description: 'ACM-W Chai Connect at FAST-NUCES Karachi, 27 November 2026.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        <ToastProvider>
          <IntroGate>
            <a
              href="#main"
              className="focus:bg-brand focus:text-on-brand sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:rounded-full focus:px-4 focus:py-2"
            >
              Skip to content
            </a>
            <TopStrip />
            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
            <JoinToasts />
            <NoticeYou />
            <GamesNight />
            <ChaiPet />
            <LiveReaders />
            <NightShade />
            <BreathingType />
            <SoundWiring />
          </IntroGate>
        </ToastProvider>
      </body>
    </html>
  );
}
