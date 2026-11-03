import 'server-only';
import { dbEnv } from './env';

/*
 * CV PDFs go to the organiser's Google Drive (folder CV_FOLDER_ID), uploaded by our server with
 * the organiser's OAuth refresh token. Students never see Drive. Without the Drive variables
 * (local dev), files are kept in .data/files instead.
 */

const env = () => ({
  id: dbEnv.GOOGLE_OAUTH_CLIENT_ID,
  secret: dbEnv.GOOGLE_OAUTH_CLIENT_SECRET,
  refresh: dbEnv.GOOGLE_DRIVE_REFRESH_TOKEN,
  folder: dbEnv.CV_FOLDER_ID,
});

export function driveConfigured(): boolean {
  const e = env();
  return Boolean(e.id && e.secret && e.refresh && e.folder);
}

/** Signed in to Drive at all (CVs need a folder too; reading moments does not). */
export function driveSignedIn(): boolean {
  const e = env();
  return Boolean(e.id && e.secret && e.refresh);
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  md5Checksum?: string;
  createdTime: string;
  appProperties?: Record<string, string>;
}

/** Every file matching a Drive query (follows pages). */
export async function driveList(query: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let page: string | undefined;
  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', query);
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,size,md5Checksum,createdTime,appProperties)');
    if (page) url.searchParams.set('pageToken', page);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${await accessToken()}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Drive list ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { files: DriveFile[]; nextPageToken?: string };
    out.push(...data.files);
    page = data.nextPageToken;
  } while (page);
  return out;
}

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const e = env();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: e.id!,
      client_secret: e.secret!,
      refresh_token: e.refresh!,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) throw new Error(`Drive sign-in failed: ${data.error}`);
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/** Uploads one small file (≤ 5 MB) and returns its Drive file id. */
export async function driveUpload(input: {
  name: string;
  mime: string;
  bytes: Uint8Array;
  appProperties?: Record<string, string>;
}): Promise<string> {
  const boundary = `cc${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({
    name: input.name,
    parents: [env().folder],
    appProperties: input.appProperties ?? {},
  });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${input.mime}\r\n\r\n`),
    Buffer.from(input.bytes),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
      signal: AbortSignal.timeout(60_000),
    },
  );
  if (!res.ok) throw new Error(`Drive upload ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { id: string }).id;
}

export async function driveDownload(fileId: string): Promise<Buffer> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${await accessToken()}` }, signal: AbortSignal.timeout(60_000) },
  );
  if (!res.ok) throw new Error(`Drive download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
