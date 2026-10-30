import { deleteFile, fileChecksum, momentsFolder, sessionStatus, uploadSmall } from '@/lib/drive';
import { peekDevice } from '@/lib/device';
import { json, jsonError, sameOrigin } from '@/lib/http';
import { readTicket } from '@/lib/ticket';

/*
 * Finishes an upload: Drive's own MD5 of the stored file must equal the one the phone computed,
 * byte for byte. On a mismatch the file is deleted and the phone sends it again. The small WebP
 * cover (made on the phone, no EXIF) is saved beside it for the review screens.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, { status: 403 });
  const device = await peekDevice();
  const form = await request.formData().catch(() => null);
  const id = form?.get('id');
  const ticket = device && typeof id === 'string' ? readTicket(id, device.hash.slice(0, 64)) : null;
  if (!ticket) return json({ error: 'Start the upload again.' }, { status: 400 });
  try {
    const status = await sessionStatus(ticket.s, ticket.z);
    if (status.kind !== 'done') return json({ ok: false, reason: 'incomplete' });
    const stored = await fileChecksum(status.fileId);
    if (stored.md5 !== ticket.m || stored.size !== ticket.z) {
      await deleteFile(status.fileId);
      return json({ ok: false, reason: 'checksum' });
    }
    const cover = form?.get('cover');
    if (cover instanceof File && cover.size > 0 && cover.size <= 80_000) {
      const bytes = new Uint8Array(await cover.arrayBuffer());
      const isWebp =
        Buffer.from(bytes.subarray(0, 4)).toString('latin1') === 'RIFF' &&
        Buffer.from(bytes.subarray(8, 12)).toString('latin1') === 'WEBP';
      if (isWebp) {
        // A failed cover must not fail an upload that already arrived intact.
        await uploadSmall({
          name: `${status.fileId}.webp`,
          mime: 'image/webp',
          parent: await momentsFolder('covers'),
          bytes,
          appProperties: { for: status.fileId },
        }).catch((error) => console.error('cover upload failed', error));
      }
    }
    return json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
