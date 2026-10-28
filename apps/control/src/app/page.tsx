import { BRAND } from '@chai/ui';

// Holding page until the auditorium display is built (phase P8).
export default function DisplayPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm tracking-[0.2em] text-[var(--cc-plum)] uppercase">{BRAND.org}</p>
      <h1 className="text-5xl font-bold sm:text-7xl">{BRAND.name}</h1>
      <p className="text-[var(--cc-petal-72)]">Auditorium display</p>
      <footer className="fixed right-4 bottom-3 text-[10px] text-[var(--cc-petal-72)]">
        (ASHARIB)
      </footer>
    </main>
  );
}
