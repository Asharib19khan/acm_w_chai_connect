import { BRAND } from '@chai/ui';

// Holding page until the student site is built (phases P1 onward).
export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm tracking-[0.2em] text-[var(--cc-plum)] uppercase">
        {BRAND.org} · {BRAND.campus}
      </p>
      <h1 className="text-4xl font-bold sm:text-6xl">{BRAND.name}</h1>
      <p className="text-[var(--cc-petal-72)]">25 November 2026</p>
      <footer className="fixed right-4 bottom-3 text-[10px] text-[var(--cc-petal-72)]">
        (ASHARIB)
      </footer>
    </main>
  );
}
