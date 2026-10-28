'use client';

import { Button, ErrorState } from '@chai/ui';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 sm:px-8">
      <ErrorState title="Something spilled." action={<Button onClick={reset}>Try again</Button>}>
        We couldn’t load this page. It’s us, not you. Try again in a moment.
      </ErrorState>
    </div>
  );
}
