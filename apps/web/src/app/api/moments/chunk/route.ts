import { LIMITS } from '@chai/core';
import { writeMomentChunk } from '@chai/db';
import { peekDevice } from '@/lib/device';
import { json, jsonError, sameOrigin } from '@/lib/quiz-session';

/*
 * Dev stand-in for the Cloudflare upload relay (blueprint section 0, A3): receives one piece of a
 * photo and appends it at its offset. Bytes are written exactly as received.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, { status: 403 });
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  const offset = Number(url.searchParams.get('offset'));
  if (!/^m_[A-Za-z0-9_-]{6,20}$/.test(id) || !Number.isInteger(offset) || offset < 0) {
    return json({ error: 'Bad upload piece.' }, { status: 400 });
  }
  const device = await peekDevice();
  if (!device) return json({ error: 'Start the upload again.' }, { status: 400 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > LIMITS.uploadChunkBytes) {
    return json({ error: 'Bad upload piece.' }, { status: 400 });
  }
  try {
    const received = await writeMomentChunk(id, device.hash, offset, bytes);
    return json({ received });
  } catch (error) {
    return jsonError(error);
  }
}
