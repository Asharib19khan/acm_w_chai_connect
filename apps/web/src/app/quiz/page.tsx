import type { Metadata } from 'next';
import { PageShell } from '@/components/page-intro';
import { QuizClient } from './quiz-client';

export const metadata: Metadata = { title: 'Quiz' };

export default function QuizPage() {
  return (
    <PageShell>
      <h1 className="font-display text-fg mb-8 text-[clamp(2.4rem,9vw,5rem)] leading-[0.9] font-black tracking-[-0.05em] uppercase">
        Quiz
      </h1>
      <QuizClient />
    </PageShell>
  );
}
