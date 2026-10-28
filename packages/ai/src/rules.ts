/*
 * Free rule checks that run before any Claude scan (blueprint section 10).
 * Red flags from here merge with Claude's. They never approve or remove anything.
 */

export interface RuleResult {
  flag: 'green' | 'red';
  categories: string[];
  reasons: string[];
}

/**
 * Starter blocklist. The team extends this with English, Urdu and Roman Urdu terms
 * (blueprint section 10); keep entries lowercase.
 */
export const BLOCKLIST: string[] = ['fuck', 'shit', 'bitch', 'bastard', 'slut', 'whore', 'retard'];

const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|pk|io|me|xyz|link)\b/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE_RE = /(?:\+92|0092|\b0)3\d{2}[\s-]?\d{7}\b|\b\d{4}[\s-]?\d{7}\b/;
const INJECTION_RE =
  /\b(ignore|disregard|forget)\b.{0,30}\b(instructions|prompt|rules)\b|\bsystem prompt\b|\byou are now\b|\bflag (this|it) (green|as green)\b|\bapprove (this|me)\b/i;

function result(reds: { category: string; reason: string }[]): RuleResult {
  if (reds.length === 0) return { flag: 'green', categories: [], reasons: [] };
  return {
    flag: 'red',
    categories: [...new Set(reds.map((r) => r.category))],
    reasons: reds.map((r) => r.reason),
  };
}

export function checkQuestion(body: string, displayName?: string | null): RuleResult {
  const reds: { category: string; reason: string }[] = [];
  const text = `${body} ${displayName ?? ''}`;
  const lower = text.toLowerCase();
  const words = lower.split(/[^a-z]+/);

  if (BLOCKLIST.some((term) => words.includes(term) || lower.includes(` ${term}`))) {
    reds.push({ category: 'harassment', reason: 'Contains a blocklisted word.' });
  }
  if (URL_RE.test(text) || EMAIL_RE.test(text) || PHONE_RE.test(text)) {
    reds.push({ category: 'personal_info', reason: 'Contains a link, email or phone number.' });
  }
  if (INJECTION_RE.test(text)) {
    reds.push({ category: 'prompt_injection', reason: 'Tries to instruct the moderator.' });
  }
  const letters = body.replace(/[^a-z]/gi, '');
  if (letters.length > 20 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.75) {
    reds.push({ category: 'spam', reason: 'Mostly capital letters.' });
  }
  if (/(.)\1{6,}/.test(body)) {
    reds.push({ category: 'spam', reason: 'Repeated characters.' });
  }
  if (letters.length < 6) {
    reds.push({ category: 'not_a_question', reason: 'Too little text to be a question.' });
  }
  return result(reds);
}

const ACTIVE_TOKENS = [
  '/JavaScript',
  '/JS',
  '/OpenAction',
  '/AA',
  '/Launch',
  '/EmbeddedFile',
  '/RichMedia',
  '/XFA',
];

export interface PdfInspection {
  isPdf: boolean;
  encrypted: boolean;
  activeContent: string[];
}

/** Byte-level PDF checks; runs on the server before the file is stored. */
export function inspectPdfBytes(bytes: Uint8Array): PdfInspection {
  const head = Buffer.from(bytes.subarray(0, 5)).toString('latin1');
  const raw = Buffer.from(bytes).toString('latin1');
  const activeContent = ACTIVE_TOKENS.filter((token) =>
    new RegExp(`${token.replace('/', '\\/')}(?![A-Za-z])`).test(raw),
  );
  return { isPdf: head === '%PDF-', encrypted: /\/Encrypt(?![A-Za-z])/.test(raw), activeContent };
}

export function checkCv(inspection: PdfInspection, textLength: number): RuleResult {
  const reds: { category: string; reason: string }[] = [];
  if (inspection.encrypted) reds.push({ category: 'other', reason: 'PDF is encrypted.' });
  if (inspection.activeContent.length > 0) {
    reds.push({
      category: 'other',
      reason: `PDF carries active content (${inspection.activeContent.join(', ')}).`,
    });
  }
  if (textLength < 200) {
    reds.push({ category: 'not_a_cv', reason: 'Very little text: may be a scan or not a CV.' });
  }
  return result(reds);
}
