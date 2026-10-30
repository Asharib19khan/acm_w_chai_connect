import { LIMITS } from '@chai/core';
import { putChunk, sessionStatus } from '@/lib/drive';
import { peekDevice } from '@/lib/device';
import { json, jsonError, sameOrigin } from '@/lib/http';
import { readTicket } from '@/lib/ticket';

// Each piece streams through to Drive; allow time for a slow phone connection.
export const maxDuration = 60;

/*
 * One piece of a photo or video, forwarded to the Drive upload session exactly as received.
 * The answer is how many bytes Drive has stored, so the phone always resumes from the truth.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, { status: 403 });
  const url = new URL(request.url);
  const offset = Number(url.searchParams.get('offset'));
  const device = await peekDevice();
  const ticket = device
    ? readTicket(url.searchParams.get('id') ?? '', device.hash.slice(0, 64))
    : null;
  if (!ticket) return json({ error: 'Start the upload again.' }, { status: 400 });
  if (!Number.isInteger(offset) || offset < 0 || offset >= ticket.z) {
    return json({ error: 'Bad upload piece.' }, { status: 400 });
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > LIMITS.uploadChunkBytes) {
    return json({ error: 'Bad upload piece.' }, { status: 400 });
  }
  if (offset + bytes.byteLength > ticket.z) {
    return json({ error: 'Piece is larger than the file.' }, { status: 400 });
  }
  try {
    // Ask Drive where it is first, so a retried or out-of-order piece is never written blind.
    const status = await sessionStatus(ticket.s, ticket.z);
    if (status.kind === 'done') return json({ received: ticket.z });
    if (status.kind === 'expired')
      return json({ error: 'Start the upload again.' }, { status: 400 });
    if (status.received !== offset) return json({ received: status.received });

    const result = await putChunk(ticket.s, offset, bytes, ticket.z);
    if (result.kind === 'expired')
      return json({ error: 'Start the upload again.' }, { status: 400 });
    return json({ received: result.kind === 'done' ? ticket.z : result.received });
  } catch (error) {
    return jsonError(error);
  }
}
