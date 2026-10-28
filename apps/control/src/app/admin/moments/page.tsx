import { listAdmins, listMoments } from '@chai/db';
import { ReviewBoard } from '@/components/review-board';

export const metadata = { title: 'Moments' };

function size(bytes: number) {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

export default async function MomentsReview() {
  const [moments, admins] = await Promise.all([listMoments(), listAdmins()]);
  const nameOf = (id: string | null) =>
    admins.find((a) => a.id === id)?.name ?? (id ? 'Demo seed' : null);
  return (
    <ReviewBoard
      kind="moments"
      title="Moments"
      items={moments.map((m) => ({
        id: m.id,
        status: m.status,
        flag: m.flag,
        reasons: m.flagReasons,
        categories: m.flagCategories,
        flagSource: m.flagSource,
        createdAt: m.createdAt,
        reviewedBy: nameOf(m.reviewedBy),
        removedReason: m.removedReason,
        title: m.title ?? m.fileName,
        meta: [`by ${m.uploaderName}`, size(m.sizeBytes), m.mime.replace('image/', '')],
        moment: {
          coverUrl: m.coverKey ? `/admin/moments/${m.id}/cover` : null,
          originalUrl: `/admin/moments/${m.id}/original`,
        },
      }))}
    />
  );
}
