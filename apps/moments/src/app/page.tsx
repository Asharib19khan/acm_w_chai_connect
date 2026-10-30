import { momentsOpen } from '@/env';
import { ChaiCup } from '@chai/ui';
import { Hero } from './hero';
import { MomentsUploader } from './uploader';

export default function MomentsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-8">
      <Hero />
      {momentsOpen ? (
        <MomentsUploader open />
      ) : (
        <div className="border-line flex flex-col items-start gap-4 border-t py-12">
          <ChaiCup className="h-14 w-auto" steam={false} />
          <p className="font-display text-fg text-2xl font-semibold">Uploads are closed for now.</p>
          <p className="text-fg-muted max-w-md">
            They open again soon. Keep your photos, and check back on this page.
          </p>
        </div>
      )}
    </div>
  );
}
