import 'server-only';
import { createHash } from 'node:crypto';
import {
  closeSync,
  createReadStream,
  existsSync,
  openSync,
  readFileSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { newId } from '../crypto';
import { filePath, mutate, now, read, UserError } from '../store';
import type { Moment } from '../types';

/*
 * Dev stand-in for the Drive resumable upload behind the Cloudflare relay (blueprint section 0, A3).
 * Bytes are written exactly as received; completion recomputes the MD5 and must match the phone's.
 */

export async function initMoment(input: {
  batchId: string;
  uploaderName: string;
  title: string | null;
  fileName: string;
  mime: string;
  size: number;
  md5: string;
  deviceHash: string;
}): Promise<{ id: string; receivedBytes: number; alreadyDone: boolean }> {
  return mutate((db) => {
    if (!db.settings.switches.moments) throw new UserError('Uploads are closed right now.');
    const existing = db.moments.find(
      (m) => m.md5 === input.md5 && m.sizeBytes === input.size && m.deviceHash === input.deviceHash,
    );
    if (existing) {
      return {
        id: existing.id,
        receivedBytes: existing.receivedBytes,
        alreadyDone: existing.uploadState === 'complete',
      };
    }
    const recent = db.moments.filter(
      (m) => m.deviceHash === input.deviceHash && Date.now() - Date.parse(m.createdAt) < 3_600_000,
    );
    if (recent.length >= 200)
      throw new UserError('That is a lot of photos. Take a short break and try again.');
    const id = newId('m');
    const ext = (input.fileName.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? '.jpg').toLowerCase();
    const moment: Moment = {
      id,
      batchId: input.batchId,
      uploaderName: input.uploaderName,
      title: input.title,
      fileName: input.fileName.slice(0, 200),
      mime: input.mime,
      sizeBytes: input.size,
      md5: input.md5,
      fileKey: `${id}${ext}`,
      coverKey: null,
      uploadState: 'uploading',
      receivedBytes: 0,
      deviceHash: input.deviceHash,
      createdAt: now(),
      status: 'pending_scan',
      flag: null,
      flagReasons: [],
      flagCategories: [],
      flagSource: null,
      reviewedBy: null,
      reviewedAt: null,
      removedReason: null,
    };
    db.moments.push(moment);
    return { id, receivedBytes: 0, alreadyDone: false };
  });
}

export async function writeMomentChunk(
  id: string,
  deviceHash: string,
  offset: number,
  bytes: Uint8Array,
): Promise<number> {
  const moment = (await read()).moments.find((m) => m.id === id && m.deviceHash === deviceHash);
  if (!moment) throw new UserError('Upload not found. Start again.');
  if (moment.uploadState === 'complete') return moment.sizeBytes;
  if (offset !== moment.receivedBytes) {
    // Out-of-order piece: tell the phone where to resume.
    return moment.receivedBytes;
  }
  if (offset + bytes.byteLength > moment.sizeBytes)
    throw new UserError('Piece is larger than the photo.');
  const target = filePath('moments', moment.fileKey);
  const fd = openSync(target, existsSync(target) ? 'r+' : 'w');
  try {
    writeSync(fd, bytes, 0, bytes.byteLength, offset);
  } finally {
    closeSync(fd);
  }
  return mutate((db) => {
    const m = db.moments.find((item) => item.id === id);
    if (!m) throw new UserError('Upload not found.');
    m.receivedBytes = offset + bytes.byteLength;
    return m.receivedBytes;
  });
}

function md5OfFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('md5');
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

export async function completeMoment(
  id: string,
  deviceHash: string,
  cover: Uint8Array | null,
): Promise<{ ok: true } | { ok: false; reason: 'md5' | 'size' }> {
  const moment = (await read()).moments.find((m) => m.id === id && m.deviceHash === deviceHash);
  if (!moment) throw new UserError('Upload not found.');
  const target = filePath('moments', moment.fileKey);
  if (!existsSync(target) || statSync(target).size !== moment.sizeBytes)
    return { ok: false, reason: 'size' };
  const md5 = await md5OfFile(target);
  if (md5 !== moment.md5) {
    await mutate((db) => {
      const m = db.moments.find((item) => item.id === id);
      if (m) m.receivedBytes = 0;
    });
    return { ok: false, reason: 'md5' };
  }
  let coverKey: string | null = null;
  if (cover && cover.byteLength <= 120_000) {
    coverKey = `${id}.webp`;
    writeFileSync(filePath('covers', coverKey), cover);
  }
  await mutate((db) => {
    const m = db.moments.find((item) => item.id === id);
    if (!m) return;
    m.uploadState = 'complete';
    m.coverKey = coverKey;
    m.status = 'scanned';
    m.flag = coverKey ? 'green' : 'red';
    m.flagSource = 'rules';
    m.flagReasons = coverKey ? [] : ['No cover could be made; check the original in Drive.'];
    m.flagCategories = coverKey ? [] : ['other'];
  });
  return { ok: true };
}

export async function listMoments(): Promise<Moment[]> {
  return [...(await read()).moments]
    .filter((m) => m.uploadState === 'complete')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function readCover(id: string): Promise<Buffer | null> {
  const moment = (await read()).moments.find((m) => m.id === id);
  if (!moment?.coverKey) return null;
  return readFileSync(filePath('covers', moment.coverKey));
}

export async function readMomentOriginal(
  id: string,
): Promise<{ moment: Moment; bytes: Buffer } | null> {
  const moment = (await read()).moments.find((m) => m.id === id);
  if (!moment) return null;
  return { moment, bytes: readFileSync(filePath('moments', moment.fileKey)) };
}
