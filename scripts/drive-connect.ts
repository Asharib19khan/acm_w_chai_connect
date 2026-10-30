/*
 * One-time Google Drive connection for the Share the moment site.
 *
 *   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... pnpm drive:connect
 *
 * Opens Google's consent page in the browser, catches the reply on 127.0.0.1, and writes the
 * refresh token (plus fresh random server keys, if missing) to apps/moments/.env.local, which git
 * ignores. Google shows an "unverified app" warning for the full drive scope; that's expected.
 * Nothing secret is printed.
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

// Full drive scope: uploads go into folders the organiser made by hand, which drive.file can't see.
const SCOPE = 'https://www.googleapis.com/auth/drive';
const ENV_FILE = join(process.cwd(), 'apps', 'moments', '.env.local');

function readEnvFile(): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(ENV_FILE)) return map;
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) map.set(m[1]!, m[2]!);
  }
  return map;
}

function writeEnvFile(map: Map<string, string>) {
  const lines = [
    '# Share the moment: local secrets. Never commit this file (it is gitignored).',
    ...[...map].map(([k, v]) => `${k}=${v}`),
    '',
  ];
  writeFileSync(ENV_FILE, lines.join('\n'));
}

function openBrowser(url: string) {
  // Windows `start` needs the empty title argument; other systems use open / xdg-open.
  if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '""', url.replace(/&/g, '^&')]);
  else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url]);
}

async function main() {
  const existing = readEnvFile();
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? existing.get('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret =
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? existing.get('GOOGLE_OAUTH_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    console.error('Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET first.');
    process.exit(1);
  }

  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('hex');

  const code = await new Promise<{ code: string; redirect: string }>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/callback') return res.writeHead(404).end();
      const got = url.searchParams.get('code');
      const ok = got && url.searchParams.get('state') === state;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        ok
          ? '<h2 style="font-family:sans-serif">Drive connected. You can close this tab.</h2>'
          : '<h2 style="font-family:sans-serif">That did not work. Go back to the terminal.</h2>',
      );
      server.close();
      if (ok) resolve({ code: got, redirect });
      else reject(new Error(url.searchParams.get('error') ?? 'No code returned.'));
    });
    let redirect = '';
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      redirect = `http://127.0.0.1:${port}/callback`;
      const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      auth.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirect,
        response_type: 'code',
        scope: SCOPE,
        access_type: 'offline',
        prompt: 'consent',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }).toString();
      console.log('Opening Google in your browser. Sign in with the Drive account and allow it.');
      console.log(`If nothing opens, paste this into the browser:\n${auth.toString()}\n`);
      openBrowser(auth.toString());
    });
    setTimeout(() => reject(new Error('Timed out after 5 minutes.')), 5 * 60_000).unref();
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code.code,
      code_verifier: verifier,
      redirect_uri: code.redirect,
      grant_type: 'authorization_code',
    }),
  });
  const data = (await res.json()) as {
    refresh_token?: string;
    access_token?: string;
    error?: string;
  };
  if (!res.ok || !data.refresh_token || !data.access_token) {
    throw new Error(`Google did not return a refresh token (${data.error ?? res.status}).`);
  }

  // Prove it works: whose Drive is this, and is there room?
  const about = (await (
    await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress),storageQuota',
      {
        headers: { Authorization: `Bearer ${data.access_token}` },
      },
    )
  ).json()) as {
    user?: { emailAddress?: string };
    storageQuota?: { limit?: string; usage?: string };
  };

  const env = existing;
  env.set('GOOGLE_OAUTH_CLIENT_ID', clientId);
  env.set('GOOGLE_OAUTH_CLIENT_SECRET', clientSecret);
  env.set('GOOGLE_DRIVE_REFRESH_TOKEN', data.refresh_token);
  // The organiser's Share the moment folders (not secret, but kept with the other settings).
  const folders = {
    MOMENTS_FOLDER_ROOT: '1eLRw5zp-zm82yZbnvvQDbDaceQDZDP7H',
    MOMENTS_FOLDER_PHOTOS: '1ObZZbVSPCsgPKwpEDLzfGbC8fKS9iy55',
    MOMENTS_FOLDER_VIDEOS: '1bN3N5TdemNUsDhrknzYrLQSgmXU6RtmK',
  };
  for (const [k, v] of Object.entries(folders)) if (!env.get(k)) env.set(k, v);
  for (const key of ['DEVICE_TOKEN_KEY', 'IP_HASH_KEY', 'MOMENTS_TICKET_KEY']) {
    if (!env.get(key)) env.set(key, randomBytes(32).toString('base64'));
  }
  writeEnvFile(env);

  for (const [k, id] of Object.entries(folders)) {
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=name,mimeType,capabilities(canAddChildren)`,
      { headers: { Authorization: `Bearer ${data.access_token}` } },
    );
    const f = (await r.json()) as { name?: string; capabilities?: { canAddChildren?: boolean } };
    console.log(
      r.ok && f.capabilities?.canAddChildren
        ? `Folder OK: ${f.name} (${k})`
        : `Can't upload into ${k} (${id}). Check the folder belongs to this account.`,
    );
  }
  const gb = (n?: string) => (n ? `${(Number(n) / 1024 ** 3).toFixed(0)} GB` : 'unlimited');
  console.log(`Connected to ${about.user?.emailAddress ?? 'your Google account'}.`);
  console.log(`Drive: ${gb(about.storageQuota?.usage)} used of ${gb(about.storageQuota?.limit)}.`);
  console.log(`Saved to apps/moments/.env.local (gitignored).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
