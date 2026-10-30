'use client';

import { Button, ErrorState } from '@chai/ui';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 pt-16">
      <ErrorState title="Something went wrong." action={<Button onClick={reset}>Try again</Button>}>
        The desk could not load. Try again; if it keeps happening, tell the web team lead.
      </ErrorState>
    </main>
  );
}
