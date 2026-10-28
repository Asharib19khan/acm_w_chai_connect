import type { Metadata } from 'next';
import { getSettings } from '@chai/db';
import { ClosedState, PageIntro, PageShell } from '@/components/page-intro';
import { CvForm } from './cv-form';

export const metadata: Metadata = { title: 'Drop your CV' };

export default async function CvPage() {
  const settings = await getSettings();
  return (
    <PageShell>
      <PageIntro title="Drop your CV">
        Tell us where you want it to go. Partner companies see approved CVs after the event.
      </PageIntro>
      {settings.switches.cvs ? (
        <CvForm companies={settings.companies} />
      ) : (
        <ClosedState what="CV uploads are" />
      )}
    </PageShell>
  );
}
