import { readCvFile } from '@chai/db';
import { getSession } from '@/lib/auth/session';

/*
 * Admin-only CV viewer. Production streams the file from Drive through the server (students and
 * admins never get a Drive link). Served inline so it opens in the browser's sandboxed PDF viewer.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return new Response('Not found', { status: 404 });
  const { id } = await params;
  const file = await readCvFile(id);
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${file.cv.rollNo}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
