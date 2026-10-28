import { listAdmins, listCvs } from '@chai/db';
import { ReviewBoard } from '@/components/review-board';

export const metadata = { title: 'CVs' };

function size(bytes: number) {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

export default async function CvsReview() {
  const [cvs, admins] = await Promise.all([listCvs(), listAdmins()]);
  const nameOf = (id: string | null) =>
    admins.find((a) => a.id === id)?.name ?? (id ? 'Demo seed' : null);
  return (
    <ReviewBoard
      kind="cvs"
      title="CVs"
      items={cvs.map((cv) => ({
        id: cv.id,
        status: cv.status,
        flag: cv.flag,
        reasons: cv.flagReasons,
        categories: cv.flagCategories,
        flagSource: cv.flagSource,
        createdAt: cv.createdAt,
        reviewedBy: nameOf(cv.reviewedBy),
        removedReason: cv.removedReason,
        title: `${cv.rollNo} · ${cv.department}`,
        meta: [
          cv.interests.slice(0, 2).join(', ') || 'No fields picked',
          `${cv.pageCount} page${cv.pageCount === 1 ? '' : 's'} · ${size(cv.sizeBytes)}`,
          cv.consentDisplay ? 'screen OK' : 'no screen',
        ],
        cv: {
          headline: cv.summary?.headline ?? '',
          skills: cv.summary?.skills ?? [],
          activeContent: cv.activeContent,
          viewUrl: `/admin/cvs/${cv.id}/pdf`,
          consentDisplay: cv.consentDisplay,
        },
      }))}
    />
  );
}
