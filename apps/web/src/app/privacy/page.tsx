import type { Metadata } from 'next';
import { PageIntro, PageShell } from '@/components/page-intro';

export const metadata: Metadata = { title: 'Privacy' };

const sections: [string, string[]][] = [
  [
    'What we collect',
    [
      'Your roll number and department when you upload a CV, register for a game or join the quiz.',
      'Your question, and a name only if you choose to show one.',
      'Your CV file and the companies or fields you pick.',
      'Photos you share, the title and the name you give them.',
      'For Hide & Seek, your location during a round only.',
      'We never ask for your phone number or email.',
    ],
  ],
  [
    'Why',
    [
      'To run the event: show approved questions on stage, pass CVs to partner companies, keep game scores and stop spam.',
      'Each phone gets a random ID so “one question per phone” works. We store a scrambled version of it, never your IP address.',
    ],
  ],
  [
    'Who sees it',
    [
      'Admins from the ACM-W team review every question, CV and photo before anything appears on screen.',
      'An AI tool screens submissions and suggests flags for admins. It never approves or removes anything by itself.',
      'Partner companies see approved CVs only if you ticked the box to share yours.',
      'The event screen never shows names or roll numbers next to CVs.',
    ],
  ],
  [
    'How long we keep it',
    [
      'CVs and their summaries are deleted 60 days after the event.',
      'Hide & Seek locations are deleted when each round ends.',
      'Scrambled phone and network IDs are deleted after 30 days.',
    ],
  ],
  [
    'Your choices',
    [
      'Ask the ACM-W team at the desk, or after the event, to delete your data. We can remove everything linked to your roll number.',
    ],
  ],
];

export default function PrivacyPage() {
  return (
    <PageShell>
      <PageIntro title="Privacy">
        What we collect, why, and how long we keep it. In plain words.
      </PageIntro>
      <div className="flex flex-col">
        {sections.map(([title, lines]) => (
          <section key={title} className="border-line border-t py-8">
            <h2 className="font-display text-fg text-xl font-bold">{title}</h2>
            <ul className="text-fg-muted mt-4 flex flex-col gap-2.5">
              {lines.map((line) => (
                <li key={line} className="flex gap-3">
                  <span className="bg-accent mt-2.5 size-1.5 shrink-0 rounded-full" aria-hidden />
                  <span className="leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
