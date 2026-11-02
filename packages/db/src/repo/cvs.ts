import 'server-only';
import { readFileSync, writeFileSync } from 'node:fs';
import { checkCv, inspectPdfBytes } from '@chai/ai';
import { LIMITS, type DepartmentCode } from '@chai/core';
import { extractText, getDocumentProxy } from 'unpdf';
import { newId, sha256 } from '../crypto';
import { driveConfigured, driveDownload, driveUpload } from '../drive';
import { isUnique, sql, tx } from '../sql';
import { bump, filePath, now, ready, UserError } from '../store';
import type { Cv, CvSummary } from '../types';
import { writeAudit } from './audit';
import { newModeration } from './moderation';
import { getSettings } from './settings';

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
  await ready();
  return (await sql()`select 1 from cvs where roll_no = ${rollNo} limit 1`).length > 0;
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
  await ready();
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

  if (!(await getSettings()).switches.cvs) throw new UserError('CV uploads are closed right now.');
  const duplicateRoll = () =>
    new UserError(
      'A CV for this roll number is already in. To replace it, visit the registration desk.',
      'rollNo',
    );
  if (await cvExists(input.rollNo)) throw duplicateRoll();

  const digest = sha256(Buffer.from(input.bytes));
  const id = newId('cv');
  // The server checks above all ran before anything is stored.
  let fileKey: string;
  if (driveConfigured()) {
    const fileId = await driveUpload({
      name: `${input.rollNo} ${id}.pdf`,
      mime: 'application/pdf',
      bytes: input.bytes,
      appProperties: { cv: id, roll: input.rollNo },
    });
    fileKey = `drive:${fileId}`;
  } else {
    fileKey = `${id}.pdf`;
    writeFileSync(filePath('cvs', fileKey), input.bytes);
  }
  const cv: Cv = {
    id,
    rollNo: input.rollNo,
    department: input.department,
    interests: input.interests,
    interestNote: input.interestNote,
    consentShare: true,
    consentDisplay: input.consentDisplay,
    fileKey,
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
  try {
    await tx(async (t) => {
      const same = await t`select 1 from cvs where sha256 = ${digest} limit 1`;
      if (same.length) {
        cv.flag = 'red';
        cv.flagCategories.push('duplicate');
        cv.flagReasons.push('Same file as another CV.');
      }
      await t`
        insert into cvs ${t({ ...cv, summary: null } as never)}`;
      if (cv.summary) await t`update cvs set summary = ${t.json(cv.summary as never)} where id = ${id}`;
      await bump(t);
    });
  } catch (error) {
    if (isUnique(error)) throw duplicateRoll();
    throw error;
  }
  return cv;
}

export async function listCvs(): Promise<Cv[]> {
  await ready();
  return sql()<Cv[]>`select * from cvs order by created_at`;
}

export async function readCvFile(id: string): Promise<{ cv: Cv; bytes: Buffer } | null> {
  await ready();
  const [cv] = await sql()<Cv[]>`select * from cvs where id = ${id}`;
  if (!cv) return null;
  const bytes = cv.fileKey.startsWith('drive:')
    ? await driveDownload(cv.fileKey.slice(6))
    : readFileSync(filePath('cvs', cv.fileKey));
  return { cv, bytes };
}

export async function updateCvSummary(
  id: string,
  summary: CvSummary,
  actor: { id: string; name: string },
): Promise<void> {
  await ready();
  await tx(async (t) => {
    const clean = { headline: summary.headline.slice(0, 80), skills: summary.skills.slice(0, 5) };
    const done = await t`update cvs set summary = ${t.json(clean as never)} where id = ${id} returning id`;
    if (done.length === 0) throw new UserError('That CV no longer exists.');
    await writeAudit(t, actor, 'cvs.edit_summary', 'cvs', id, null);
    await bump(t);
  });
}
