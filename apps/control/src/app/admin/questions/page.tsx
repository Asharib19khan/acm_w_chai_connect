import { listAdmins, listQuestions } from '@chai/db';
import { ReviewBoard } from '@/components/review-board';

export const metadata = { title: 'Questions' };

export default async function QuestionsReview() {
  const [questions, admins] = await Promise.all([listQuestions(), listAdmins()]);
  const nameOf = (id: string | null) =>
    admins.find((a) => a.id === id)?.name ?? (id ? 'Demo seed' : null);
  return (
    <ReviewBoard
      kind="questions"
      title="Questions"
      items={questions.map((q) => ({
        id: q.id,
        status: q.status,
        flag: q.flag,
        reasons: q.flagReasons,
        categories: q.flagCategories,
        flagSource: q.flagSource,
        createdAt: q.createdAt,
        reviewedBy: nameOf(q.reviewedBy),
        removedReason: q.removedReason,
        title: q.body,
        meta: [
          q.showName && q.displayName ? `— ${q.displayName}` : 'Anonymous',
          ...(q.src ? [`QR: ${q.src}`] : []),
          ...(q.answered ? ['answered'] : []),
        ],
        question: { answered: q.answered, spotlight: Boolean(q.spotlightAt) },
      }))}
    />
  );
}
