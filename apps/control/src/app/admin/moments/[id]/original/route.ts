import { readMomentOriginal } from '@chai/db';
import { getSession } from '@/lib/auth/session';

// Admin-only: the untouched original (in production this is the file in Ye's Drive).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return new Response('Not found', { status: 404 });
  const { id } = await params;
  const file = await readMomentOriginal(id);
  if (!file) return new Response('Not found', { status: 404 });
  const safeType = /^(image\/(jpeg|png|webp|gif|heic|heif|avif)|video\/(mp4|quicktime|webm|3gpp))$/.test(file.moment.mime)
    ? file.moment.mime
    : 'application/octet-stream';
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      'Content-Type': safeType,
      'Content-Disposition': `inline; filename="${file.moment.fileName.replace(/[^\w.-]/g, '_')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self'; media-src 'self'",
    },
  });
}
