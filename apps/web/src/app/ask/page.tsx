import type { Metadata } from 'next';
import { getSettings, hasAsked } from '@chai/db';
import { ClosedState, PageIntro, PageShell } from '@/components/page-intro';
import { peekDevice } from '@/lib/device';
import { AskForm } from './ask-form';

export const metadata: Metadata = { title: 'Ask a question' };

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}) {
  const [{ src }, settings, device] = await Promise.all([
    searchParams,
    getSettings(),
    peekDevice(),
  ]);
  const asked = device ? await hasAsked(device.hash) : false;
  const spot = src && /^[a-z0-9-]{1,40}$/.test(src) ? src : null;
  return (
    <PageShell>
      <PageIntro title="Ask a question">
        Ask what you’d never ask out loud. Approved questions go up on the auditorium screen for the
        panel.
      </PageIntro>
      {settings.switches.questions ? (
        <AskForm alreadyAsked={asked} src={spot} />
      ) : (
        <ClosedState what="Questions are" />
      )}
    </PageShell>
  );
}
