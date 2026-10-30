import { z } from 'zod';
import { firstIssue, momentInitSchema } from '@chai/core';
import { findUploaded, momentsFolder, startResumable } from '@/lib/drive';
import { ensureDevice, ipHash } from '@/lib/device';
import { json, jsonError, sameOrigin, UserError } from '@/lib/http';
import { LIMITS, limited } from '@/lib/rate-limit';
import { issueTicket } from '@/lib/ticket';
import { momentsOpen } from '@/env';

const body = momentInitSchema.extend({ batchId: z.string().min(4).max(40) });

/** "2026-11-25 14.03.22 Asharib Khan · IMG_1234.HEIC", safe for Drive and readable in a list. */
function driveName(uploader: string, fileName: string): string {
  const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Karachi' }).replace(/:/g, '.');
  const clean = fileName.replace(/[\u0000-\u001f/\\]/g, '_').slice(0, 120);
  return `${stamp} ${uploader} · ${clean}`;
}

/** Starts (or recognises) one upload and hands back a sealed ticket for its pieces. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: firstIssue(parsed.error) }, { status: 400 });
  if (limited(`m:ip:${await ipHash()}`, LIMITS.momentsIp))
    return json({ error: 'Too many uploads at once. Wait a minute.' }, { status: 429 });
  try {
    if (!momentsOpen) throw new UserError('Uploads are closed right now.');
    const { uploaderName, fileName, mime, size, md5, batchId } = parsed.data;
    const device = await ensureDevice();
    const deviceKey = device.hash.slice(0, 64);
    // Already in Drive from this phone (same bytes): skip it instead of storing a copy.
    if (await findUploaded(md5, size, deviceKey)) {
      return json({ id: '', receivedBytes: size, alreadyDone: true });
    }
    const kind = mime.startsWith('video/') ? 'videos' : 'photos';
    const session = await startResumable({
      name: driveName(uploaderName, fileName),
      mime,
      size,
      parent: await momentsFolder(kind),
      description: `Shared by ${uploaderName} on Share the moment (ACM-W Chai Connect 2026).`,
      // Drive limit: each key + value under 124 bytes.
      appProperties: {
        md5,
        device: deviceKey,
        uploader: uploaderName.slice(0, 40),
        batch: batchId,
        status: 'pending_review',
      },
    });
    const id = issueTicket({ s: session, z: size, m: md5, d: deviceKey, n: uploaderName });
    return json({ id, receivedBytes: 0, alreadyDone: false });
  } catch (error) {
    return jsonError(error);
  }
}
