import Link from 'next/link';
import { Marquee } from '@chai/ui';
import { SiteMenu } from './site-menu';
import { getSettings } from '@chai/db';

export async function TopStrip() {
  const settings = await getSettings();
  const items = settings.announcement
    ? [settings.announcement, ...settings.marquee]
    : settings.marquee;
  return (
    <Marquee
      items={items}
      speed={42}
      className="bg-brand font-display text-on-brand h-9 text-[0.72rem] font-bold tracking-[0.18em] uppercase"
      separator={<StarGlyph />}
    />
  );
}

function StarGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="text-on-brand size-3" aria-hidden>
      <path
        d="M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** ACM-W on the left, the Menu button on the right. */
export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
      <Link
        href="/"
        className="font-display text-fg rounded-lg text-[1.35rem] leading-none font-black tracking-[-0.02em]"
        aria-label="ACM-W, Chai Connect home"
      >
        ACM-<span className="text-accent">W</span>
      </Link>
      <SiteMenu />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-28 w-full max-w-6xl px-4 pb-8 sm:px-8">
      <p
        aria-hidden
        className="font-display cc-outline -mb-[0.12em] text-[18.5vw] leading-[0.8] font-black tracking-[-0.06em] select-none sm:text-[min(17vw,13rem)]"
      >
        ACM-W
      </p>
      <div className="border-accent/40 text-fg-muted flex flex-col gap-3 border-t pt-5 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span>ACM-W · FAST-NUCES Karachi · 27 November 2026</span>
        <Link href="/privacy" className="hover:text-fg underline-offset-4 hover:underline">
          Privacy
        </Link>
      </div>
    </footer>
  );
}
