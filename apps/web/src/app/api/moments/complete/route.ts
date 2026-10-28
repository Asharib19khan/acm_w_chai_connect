import { completeMoment } from '@chai/db';
import { peekDevice } from '@/lib/device';
import { json, jsonError, sameOrigin } from '@/lib/quiz-session';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, { status: 403 });
  const device = await peekDevice();
  if (!device) return json({ error: 'Start the upload again.' }, { status: 400 });
  const form = await request.formData().catch(() => null);
  const id = form?.get('id');
  if (typeof id !== 'string') return json({ error: 'Bad request.' }, { status: 400 });
  const cover = form?.get('cover');
  let coverBytes: Uint8Array | null = null;
  if (cover instanceof File && cover.size > 0) {
    const bytes = new Uint8Array(await cover.arrayBuffer());
    // Covers must be WebP (RIFF....WEBP) made on the phone.
    const isWebp =
      Buffer.from(bytes.subarray(0, 4)).toString('latin1') === 'RIFF' &&
      Buffer.from(bytes.subarray(8, 12)).toString('latin1') === 'WEBP';
    if (isWebp) coverBytes = bytes;
  }
  try {
    return json(await completeMoment(id, device.hash, coverBytes));
  } catch (error) {
    return jsonError(error);
  }
}
