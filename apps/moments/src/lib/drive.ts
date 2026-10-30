import 'server-only';
import { env } from '@/env';

/*
 * Google Drive, called only from our server with the organiser's OAuth refresh token. Phones
 * never see a Drive URL, file ID or token. Uploads go into the organiser's own folders (IDs in
 * MOMENTS_FOLDER_*), which needs the full drive scope; the refresh token never leaves the server.
 */

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';

export class DriveError extends Error {}

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN } = env;
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_DRIVE_REFRESH_TOKEN) {
    throw new DriveError('Drive is not connected. Run pnpm drive:connect.');
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: GOOGLE_DRIVE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) throw new DriveError(`Drive sign-in failed: ${data.error}`);
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

async function drive(url: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await accessToken()}`);
  return fetch(url, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
}

async function driveJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await drive(url, init);
  if (!res.ok) throw new DriveError(`Drive ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

/** Drive query strings quote values with single quotes; escape them. */
const q = (v: string) => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const folderCache = new Map<string, string>();

async function ensureFolder(name: string, parent: string | null): Promise<string> {
  const key = `${parent ?? 'root'}/${name}`;
  const hit = folderCache.get(key);
  if (hit) return hit;
  const query = [
    `name = ${q(name)}`,
    `mimeType = '${FOLDER}'`,
    'trashed = false',
    parent ? `${q(parent)} in parents` : `'root' in parents`,
  ].join(' and ');
  const found = await driveJson<{ files: { id: string }[] }>(
    `${API}/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`,
  );
  const id =
    found.files[0]?.id ??
    (
      await driveJson<{ id: string }>(`${API}/files?fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: FOLDER, parents: parent ? [parent] : undefined }),
      })
    ).id;
  folderCache.set(key, id);
  return id;
}

/**
 * Photos and videos go straight into the organiser's own folders. Covers go in a "covers"
 * folder the app creates inside the main Share the moment folder.
 */
export async function momentsFolder(sub: 'photos' | 'videos' | 'covers'): Promise<string> {
  const { MOMENTS_FOLDER_ROOT, MOMENTS_FOLDER_PHOTOS, MOMENTS_FOLDER_VIDEOS } = env;
  if (!MOMENTS_FOLDER_ROOT || !MOMENTS_FOLDER_PHOTOS || !MOMENTS_FOLDER_VIDEOS) {
    throw new DriveError('Drive folders are not set (MOMENTS_FOLDER_*).');
  }
  if (sub === 'photos') return MOMENTS_FOLDER_PHOTOS;
  if (sub === 'videos') return MOMENTS_FOLDER_VIDEOS;
  return ensureFolder('covers', MOMENTS_FOLDER_ROOT);
}

/** A finished upload with the same checksum and size from the same phone, if one exists. */
export async function findUploaded(md5: string, size: number, device: string) {
  const query = [
    `appProperties has { key='md5' and value=${q(md5)} }`,
    `appProperties has { key='device' and value=${q(device)} }`,
    'trashed = false',
  ].join(' and ');
  const found = await driveJson<{ files: { id: string; size?: string }[] }>(
    `${API}/files?q=${encodeURIComponent(query)}&fields=files(id,size)&pageSize=5`,
  );
  return found.files.find((f) => Number(f.size) === size) ?? null;
}

/** Opens a resumable upload session; returns its URL (kept server-side, never sent raw). */
export async function startResumable(input: {
  name: string;
  mime: string;
  size: number;
  parent: string;
  description: string;
  appProperties: Record<string, string>;
}): Promise<string> {
  const res = await drive(`${UPLOAD}/files?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': input.mime,
      'X-Upload-Content-Length': String(input.size),
    },
    body: JSON.stringify({
      name: input.name,
      parents: [input.parent],
      mimeType: input.mime,
      description: input.description,
      appProperties: input.appProperties,
    }),
  });
  const session = res.headers.get('location');
  if (!res.ok || !session)
    throw new DriveError(`Drive could not start the upload (${res.status}).`);
  return session;
}

export type ChunkResult =
  { kind: 'partial'; received: number } | { kind: 'done'; fileId: string } | { kind: 'expired' };

function readRange(res: Response): number {
  // "bytes=0-1048575" means bytes 0..1048575 are stored, so 1048576 received.
  const m = /bytes=0-(\d+)/.exec(res.headers.get('range') ?? '');
  return m ? Number(m[1]) + 1 : 0;
}

async function interpret(res: Response): Promise<ChunkResult> {
  if (res.status === 308) return { kind: 'partial', received: readRange(res) };
  if (res.status === 200 || res.status === 201) {
    const data = (await res.json()) as { id: string };
    return { kind: 'done', fileId: data.id };
  }
  if (res.status === 404 || res.status === 410) return { kind: 'expired' };
  throw new DriveError(`Drive upload ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/** Sends bytes [offset, offset + bytes.length) of a file of `total` bytes. */
export async function putChunk(
  session: string,
  offset: number,
  bytes: Uint8Array,
  total: number,
): Promise<ChunkResult> {
  const end = offset + bytes.byteLength - 1;
  const res = await drive(
    session,
    {
      method: 'PUT',
      headers: { 'Content-Range': `bytes ${offset}-${end}/${total}` },
      body: bytes as unknown as BodyInit,
    },
    120_000,
  );
  return interpret(res);
}

/** Asks Drive how much of a session it has (used to resume and to finish). */
export async function sessionStatus(session: string, total: number): Promise<ChunkResult> {
  const res = await drive(session, {
    method: 'PUT',
    headers: { 'Content-Range': `bytes */${total}` },
  });
  return interpret(res);
}

export async function fileChecksum(fileId: string): Promise<{ md5: string | null; size: number }> {
  const f = await driveJson<{ md5Checksum?: string; size?: string }>(
    `${API}/files/${encodeURIComponent(fileId)}?fields=md5Checksum,size`,
  );
  return { md5: f.md5Checksum ?? null, size: Number(f.size ?? 0) };
}

export async function deleteFile(fileId: string): Promise<void> {
  await drive(`${API}/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
}

/** Small one-shot upload (the WebP cover). */
export async function uploadSmall(input: {
  name: string;
  mime: string;
  parent: string;
  bytes: Uint8Array;
  appProperties: Record<string, string>;
}): Promise<string> {
  const boundary = `cc${crypto.randomUUID().replace(/-/g, '')}`;
  const meta = JSON.stringify({
    name: input.name,
    parents: [input.parent],
    mimeType: input.mime,
    appProperties: input.appProperties,
  });
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: ${input.mime}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([head, Buffer.from(input.bytes), tail]);
  const data = await driveJson<{ id: string }>(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: body as unknown as BodyInit,
  });
  return data.id;
}
