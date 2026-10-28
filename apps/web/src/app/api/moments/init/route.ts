import { z } from 'zod';
import { initMoment } from '@chai/db';
import { firstIssue, momentInitSchema } from '@chai/core';
import { ensureDevice, ipHash } from '@/lib/device';
import { json, jsonError, sameOrigin } from '@/lib/quiz-session';
import { LIMITS, limited } from '@/lib/rate-limit';

const body = momentInitSchema.extend({ batchId: z.string().min(4).max(40) });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: firstIssue(parsed.error) }, { status: 400 });
  if (limited(`m:ip:${await ipHash()}`, LIMITS.momentsIp))
    return json({ error: 'Too many uploads at once. Wait a minute.' }, { status: 429 });
  try {
    const device = await ensureDevice();
    const result = await initMoment({
      batchId: parsed.data.batchId,
      uploaderName: parsed.data.uploaderName,
      title: parsed.data.title || null,
      fileName: parsed.data.fileName,
      mime: parsed.data.mime,
      size: parsed.data.size,
      md5: parsed.data.md5,
      deviceHash: device.hash,
    });
    return json(result);
  } catch (error) {
    return jsonError(error);
  }
}
