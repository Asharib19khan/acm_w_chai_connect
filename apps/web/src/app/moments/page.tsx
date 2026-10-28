import type { Metadata } from 'next';
import { getSettings, listMoments } from '@chai/db';
import { EmptyState } from '@chai/ui';
import { ClosedState, PageIntro, PageShell } from '@/components/page-intro';
import { MomentsUploader } from './uploader';

export const metadata: Metadata = { title: 'Share moments' };

export default async function MomentsPage() {
  const [settings, moments] = await Promise.all([getSettings(), listMoments()]);
  const approved = moments.filter((m) => m.status === 'approved' && m.coverKey);
  return (
    <>
      <PageShell>
        <PageIntro title="Share moments">
          Photos from today, in full quality. Admins check covers before they show here.
        </PageIntro>
        {settings.switches.moments ? <MomentsUploader open /> : <ClosedState what="Uploads are" />}
      </PageShell>
      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-8" aria-labelledby="gallery">
        <h2 id="gallery" className="font-display text-petal text-3xl font-black tracking-tight">
          Today so far
        </h2>
        {approved.length === 0 ? (
          <EmptyState title="No photos yet." align="start">
            Be the first. Approved photos appear here.
          </EmptyState>
        ) : (
          <ul className="mt-8 columns-2 gap-3 sm:columns-3 lg:columns-4">
            {approved.map((m) => (
              <li
                key={m.id}
                className="bg-prussian ring-grape mb-3 break-inside-avoid overflow-hidden rounded-2xl ring-1"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny WebP covers served from our route */}
                <img
                  src={`/api/moments/cover/${m.id}`}
                  alt={m.title ?? `Photo by ${m.uploaderName}`}
                  loading="lazy"
                  className="w-full"
                />
                <div className="flex flex-col gap-0.5 p-3">
                  {m.title && <span className="text-petal text-sm font-semibold">{m.title}</span>}
                  <span className="text-petal-72 text-xs">by {m.uploaderName}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
