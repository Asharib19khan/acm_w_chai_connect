import 'server-only';
import { readFileSync, writeFileSync } from 'node:fs';
import { checkCv, inspectPdfBytes } from '@chai/ai';
import { LIMITS, type DepartmentCode } from '@chai/core';
import { extractText, getDocumentProxy } from 'unpdf';
import { newId, sha256 } from '../crypto';
import { filePath, mutate, now, read, UserError } from '../store';
import type { Cv, CvSummary } from '../types';
import { writeAudit } from './audit';
import { newModeration } from './moderation';

const SKILL_WORDS = [
  'Python',
  'Java',
  'C++',
  'JavaScript',
  'TypeScript',
  'React',
  'Next.js',
  'Node.js',
  'SQL',
  'PostgreSQL',
  'MongoDB',
  'Flutter',
  'Kotlin',
  'Swift',
  'Docker',
  'Kubernetes',
  'AWS',
  'Azure',
  'Machine Learning',
  'Deep Learning',
  'PyTorch',
  'TensorFlow',
  'Data Analysis',
  'Power BI',
  'Excel',
  'Figma',
  'UI/UX',
  'Linux',
  'Git',
  'Networking',
  'Penetration Testing',
  'Cryptography',
  'Embedded',
  'Arduino',
  'MATLAB',
  'Verilog',
  'Accounting',
  'Finance',
  'Marketing',
  'Leadership',
];

/** Stand-in summary until the Claude worker writes a better one (admins can edit either). */
function guessSummary(text: string): CvSummary | null {
  const lower = text.toLowerCase();
  const skills = SKILL_WORDS.filter((s) => lower.includes(s.toLowerCase())).slice(0, 5);
  if (skills.length === 0) return null;
  return { headline: '', skills };
}

export async function cvExists(rollNo: string): Promise<boolean> {
  return (await read()).cvs.some((cv) => cv.rollNo === rollNo);
}

export async function createCv(input: {
  rollNo: string;
  department: DepartmentCode;
  interests: string[];
  interestNote: string | null;
  consentDisplay: boolean;
  fileName: string;
  bytes: Uint8Array;
}): Promise<Cv> {
  if (input.bytes.byteLength > LIMITS.cvMaxBytes) {
    throw new UserError('That PDF is over 4 MB. Export a smaller copy and try again.', 'file');
  }
  const inspection = inspectPdfBytes(input.bytes);
  if (!inspection.isPdf) throw new UserError('That file is not a PDF.', 'file');

  let pageCount = 0;
  let text = '';
  if (!inspection.encrypted) {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(input.bytes));
      pageCount = pdf.numPages;
      const extracted = await extractText(pdf, { mergePages: true });
      text = extracted.text;
    } catch {
      throw new UserError('That PDF could not be opened. Re-export it and try again.', 'file');
    }
    if (pageCount > LIMITS.cvMaxPages) {
      throw new UserError(`Keep your CV to ${LIMITS.cvMaxPages} pages or fewer.`, 'file');
    }
  }

  const digest = sha256(Buffer.from(input.bytes));
  return mutate((db) => {
    if (!db.settings.switches.cvs) throw new UserError('CV uploads are closed right now.');
    if (db.cvs.some((cv) => cv.rollNo === input.rollNo)) {
      throw new UserError(
        'A CV for this roll number is already in. To replace it, visit the registration desk.',
        'rollNo',
      );
    }
    const id = newId('cv');
    // Dev stand-in for the Drive upload; the server checks happened above, before storage.
    writeFileSync(filePath('cvs', `${id}.pdf`), input.bytes);
    const cv: Cv = {
      id,
      rollNo: input.rollNo,
      department: input.department,
      interests: input.interests,
      interestNote: input.interestNote,
      consentShare: true,
      consentDisplay: input.consentDisplay,
      fileKey: `${id}.pdf`,
      fileName: input.fileName.slice(0, 120),
      sha256: digest,
      sizeBytes: input.bytes.byteLength,
      pageCount,
      activeContent: inspection.activeContent.length > 0,
      textLength: text.length,
      summary: guessSummary(text),
      createdAt: now(),
      ...newModeration(checkCv(inspection, text.length)),
    };
    if (db.cvs.some((other) => other.sha256 === digest)) {
      cv.flag = 'red';
      cv.flagCategories.push('duplicate');
      cv.flagReasons.push('Same file as another CV.');
    }
    db.cvs.push(cv);
    return cv;
  });
}

export async function listCvs(): Promise<Cv[]> {
  return [...(await read()).cvs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function readCvFile(id: string): Promise<{ cv: Cv; bytes: Buffer } | null> {
  const cv = (await read()).cvs.find((item) => item.id === id);
  if (!cv) return null;
  return { cv, bytes: readFileSync(filePath('cvs', cv.fileKey)) };
}

export async function updateCvSummary(
  id: string,
  summary: CvSummary,
  actor: { id: string; name: string },
): Promise<void> {
  await mutate((db) => {
    const cv = db.cvs.find((item) => item.id === id);
    if (!cv) throw new UserError('That CV no longer exists.');
    cv.summary = { headline: summary.headline.slice(0, 80), skills: summary.skills.slice(0, 5) };
    writeAudit(db, actor, 'cvs.edit_summary', 'cvs', id, null);
  });
}
