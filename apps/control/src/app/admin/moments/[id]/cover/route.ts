import { readCover } from '@chai/db';
import { getSession } from '@/lib/auth/session';

// Admin-only cover preview, including photos not yet approved.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return new Response('Not found', { status: 404 });
  const { id } = await params;
  const bytes = await readCover(id);
  if (!bytes) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
