import { listMoments, readCover } from '@chai/db';

// Approved Share Moments covers for the display's spare card.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const approved = (await listMoments()).some((m) => m.id === id && m.status === 'approved');
  const bytes = approved ? await readCover(id) : null;
  if (!bytes) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
