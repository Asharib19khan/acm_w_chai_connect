import { displayData, listQuizzes } from '@chai/db';
import { Display } from '@/components/display/display';
import { getSession } from '@/lib/auth/session';
import { env } from '@/env';

export default async function DisplayPage() {
  const [data, session] = await Promise.all([displayData(), getSession()]);
  const quizzes = session
    ? (await listQuizzes()).map((q) => ({ id: q.id, title: q.title, count: q.questions.length }))
    : [];
  return (
    <Display
      initial={data}
      presenter={session ? { name: session.admin.name } : null}
      quizzes={quizzes}
      studentUrl={env.NEXT_PUBLIC_STUDENT_SITE_URL ?? 'http://localhost:3000'}
    />
  );
}
