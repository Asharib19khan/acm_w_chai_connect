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
import { driveDownload, driveList, driveSignedIn } from '../drive';
import { sql, tx } from '../sql';
import { bump, filePath, now, ready, UserError } from '../store';
import { getSettings } from './settings';
import type { Moment } from '../types';

/*
 * Dev stand-in for the Drive resumable upload behind the Cloudflare relay (blueprint section 0, A3).
 * Bytes are written exactly as received; completion recomputes the MD5 and must match the phone's.
 */

async function find(id: string, deviceHash?: string): Promise<Moment | undefined> {
  await ready();
  const s = sql();
  const [m] = await s<Moment[]>`
    select * from moments where id = ${id} ${deviceHash ? s`and device_hash = ${deviceHash}` : s``}`;
  return m;
}

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
  await ready();
  if (!(await getSettings()).switches.moments) throw new UserError('Uploads are closed right now.');
  return tx(async (t) => {
    await t`select pg_advisory_xact_lock(hashtext(${`moment:${input.deviceHash}`}))`;
    const [existing] = await t<Moment[]>`
      select * from moments
      where md5 = ${input.md5} and size_bytes = ${input.size} and device_hash = ${input.deviceHash}`;
    if (existing) {
      return {
        id: existing.id,
        receivedBytes: existing.receivedBytes,
        alreadyDone: existing.uploadState === 'complete',
      };
    }
    const [recent] = await t<{ n: number }[]>`
      select count(*)::int as n from moments
      where device_hash = ${input.deviceHash}
        and created_at > ${new Date(Date.now() - 3_600_000).toISOString()}`;
    if (recent!.n >= 200)
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
    await t`insert into moments ${t(moment as never)}`;
    return { id, receivedBytes: 0, alreadyDone: false };
  });
}

export async function writeMomentChunk(
  id: string,
  deviceHash: string,
  offset: number,
  bytes: Uint8Array,
): Promise<number> {
  const moment = await find(id, deviceHash);
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
  const received = offset + bytes.byteLength;
  await sql()`update moments set received_bytes = ${received} where id = ${id}`;
  return received;
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
  const moment = await find(id, deviceHash);
  if (!moment) throw new UserError('Upload not found.');
  const target = filePath('moments', moment.fileKey);
  if (!existsSync(target) || statSync(target).size !== moment.sizeBytes)
    return { ok: false, reason: 'size' };
  const md5 = await md5OfFile(target);
  if (md5 !== moment.md5) {
    await sql()`update moments set received_bytes = 0 where id = ${id}`;
    return { ok: false, reason: 'md5' };
  }
  let coverKey: string | null = null;
  if (cover && cover.byteLength <= 120_000) {
    coverKey = `${id}.webp`;
    writeFileSync(filePath('covers', coverKey), cover);
  }
  await tx(async (t) => {
    await t`
      update moments set upload_state = 'complete', cover_key = ${coverKey}, status = 'scanned',
        flag = ${coverKey ? 'green' : 'red'}, flag_source = 'rules',
        flag_reasons = ${coverKey ? [] : ['No cover could be made; check the original in Drive.']}::text[],
        flag_categories = ${coverKey ? [] : ['other']}::text[]
      where id = ${id}`;
    await bump(t);
  });
  return { ok: true };
}

/*
 * Share the moment uploads straight to Drive (no database there). The admin portal mirrors those
 * files into the moments table so the usual review (approve / remove / restore) works. Runs at most
 * every 30 s per server; new files appear as "scanned" and wait for an admin.
 */
const g = globalThis as unknown as { __momentsSyncAt?: number; __momentsSync?: Promise<void> };
/** Drive query strings quote values with single quotes; escape them. */
const q = (v: string) => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

async function syncFromDrive(): Promise<void> {
  const root = process.env.MOMENTS_FOLDER_ROOT;
  const folders = [process.env.MOMENTS_FOLDER_PHOTOS, process.env.MOMENTS_FOLDER_VIDEOS].filter(
    (f): f is string => Boolean(f),
  );
  if (!driveSignedIn() || !root || folders.length === 0) return;
  const files = await driveList(
    `(${folders.map((f) => `${q(f)} in parents`).join(' or ')}) and trashed = false`,
  );
  const coverFolders = await driveList(
    `name = 'covers' and ${q(root)} in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  );
  const covers = coverFolders[0]
    ? await driveList(`${q(coverFolders[0].id)} in parents and trashed = false`)
    : [];
  const coverFor = new Map(covers.map((c) => [c.appProperties?.for ?? '', c.id]));
  const rows: Moment[] = files.map((f) => {
    const p = f.appProperties ?? {};
    const cover = coverFor.get(f.id);
    return {
      id: `drv_${f.id}`,
      batchId: p.batch ?? '',
      uploaderName: p.uploader ?? 'Anonymous',
      title: null,
      fileName: f.name.slice(0, 200),
      mime: f.mimeType,
      sizeBytes: Number(f.size ?? 0),
      md5: f.md5Checksum ?? p.md5 ?? '',
      fileKey: `drive:${f.id}`,
      coverKey: cover ? `drive:${cover}` : null,
      uploadState: 'complete',
      receivedBytes: Number(f.size ?? 0),
      deviceHash: p.device ?? '',
      createdAt: f.createdTime,
      status: 'scanned',
      flag: cover ? 'green' : 'red',
      flagReasons: cover ? [] : ['No preview yet; open the original in Drive.'],
      flagCategories: cover ? [] : ['other'],
      flagSource: 'rules',
      reviewedBy: null,
      reviewedAt: null,
      removedReason: null,
    };
  });
  if (rows.length === 0) return;
  await tx(async (t) => {
    for (let i = 0; i < rows.length; i += 200) {
      // New files go in; known ones only pick up a cover that arrived later. Reviews are kept.
      await t`
        insert into moments ${t(rows.slice(i, i + 200) as never)}
        on conflict (id) do update set
          cover_key = coalesce(moments.cover_key, excluded.cover_key),
          flag = case when moments.cover_key is null and excluded.cover_key is not null
                      then 'green' else moments.flag end,
          flag_reasons = case when moments.cover_key is null and excluded.cover_key is not null
                              then '{}'::text[] else moments.flag_reasons end`;
    }
    await bump(t);
  });
}

export async function syncMoments(force = false): Promise<void> {
  if (!force && g.__momentsSyncAt && Date.now() - g.__momentsSyncAt < 30_000) return;
  g.__momentsSyncAt = Date.now();
  g.__momentsSync ??= syncFromDrive()
    .catch((error) => console.error('moments sync failed', error))
    .finally(() => (g.__momentsSync = undefined));
  await g.__momentsSync;
}

export async function listMoments(): Promise<Moment[]> {
  await ready();
  await syncMoments();
  return sql()<Moment[]>`
    select * from moments where upload_state = 'complete' order by created_at desc`;
}

export async function readCover(id: string): Promise<Buffer | null> {
  const moment = await find(id);
  if (!moment?.coverKey) return null;
  return moment.coverKey.startsWith('drive:')
    ? driveDownload(moment.coverKey.slice(6))
    : readFileSync(filePath('covers', moment.coverKey));
}

/** Small originals come back as bytes; big ones (Vercel can't send > 4.5 MB) as a Drive link. */
export async function readMomentOriginal(
  id: string,
): Promise<{ moment: Moment; bytes: Buffer } | { moment: Moment; driveUrl: string } | null> {
  const moment = await find(id);
  if (!moment) return null;
  if (moment.fileKey.startsWith('drive:')) {
    const fileId = moment.fileKey.slice(6);
    if (moment.sizeBytes > 4_000_000)
      return { moment, driveUrl: `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view` };
    return { moment, bytes: await driveDownload(fileId) };
  }
  return { moment, bytes: readFileSync(filePath('moments', moment.fileKey)) };
}
