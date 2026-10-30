import Link from 'next/link';
import { Marquee, Wordmark } from '@chai/ui';
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
      className="bg-brand font-display text-on-brand h-10 text-[0.8rem] font-semibold tracking-[0.12em]"
      separator={<StarGlyph />}
    />
  );
}

function StarGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="text-plum size-3" aria-hidden>
      <path
        d="M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Just the wordmark. The student site has no menu: every page is reached from home or a QR code. */
export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center px-4 py-4 sm:px-8">
      <Link href="/" className="text-fg rounded-lg" aria-label="Chai Connect home">
        <Wordmark compact className="text-[1.05rem]" />
      </Link>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-24 w-full max-w-5xl px-4 pb-10 sm:px-8">
      <div className="border-line text-fg-muted flex flex-col gap-3 border-t pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span>ACM-W · FAST-NUCES Karachi · 25 November 2026</span>
        <Link href="/privacy" className="hover:text-fg underline-offset-4 hover:underline">
          Privacy
        </Link>
      </div>
    </footer>
  );
}
