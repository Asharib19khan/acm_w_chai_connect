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
      className="bg-prussian font-display text-petal h-10 text-[0.8rem] font-semibold tracking-[0.12em]"
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

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
      <Link href="/" className="text-petal rounded-lg" aria-label="Chai Connect home">
        <Wordmark compact className="text-[1.05rem]" />
      </Link>
      <nav aria-label="Main" className="hidden items-center gap-1 text-sm font-medium sm:flex">
        {[
          ['/ask', 'Ask'],
          ['/cv', 'CV'],
          ['/games', 'Games'],
          ['/moments', 'Moments'],
          ['/leaderboard', 'Scores'],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href!}
            className="text-petal-72 hover:bg-petal-06 hover:text-petal rounded-full px-3.5 py-2 transition-colors"
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-24 w-full max-w-6xl px-4 pb-10 sm:px-8">
      <div className="border-petal-12 text-petal-72 flex flex-col gap-6 border-t pt-8 text-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-display text-petal">ACM-W · FAST-NUCES Karachi</span>
          <span>Chai Connect, 25 November 2026</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/privacy" className="hover:text-petal">
            Privacy
          </Link>
          <span>Built by the ACM-W Web Team</span>
        </div>
      </div>
      <p className="text-petal-50 mt-6 text-right text-[10px] tracking-wide">(ASHARIB)</p>
    </footer>
  );
}
