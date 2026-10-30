import { listGames, stationPlayerList } from '@chai/db';
import { getSession } from '@/lib/auth/session';

/** registered_players.txt for a game station's offline list. Desk session required. */
export async function GET(request: Request) {
  if (!(await getSession())) return new Response('Not found', { status: 404 });
  const gameId = new URL(request.url).searchParams.get('game') ?? '';
  const game = (await listGames()).find((g) => g.id === gameId);
  if (!game) return new Response('Not found', { status: 404 });
  const rolls = await stationPlayerList(game.id);
  const body = [
    `# ${game.name}: players who may play, downloaded ${new Date().toISOString()}.`,
    '# One roll number per line. The game lets these play even without Wi-Fi.',
    '# Download it again after registration closes so late sign-ups are included.',
    ...rolls,
    '',
  ].join('\r\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'attachment; filename="registered_players.txt"',
      'Cache-Control': 'no-store',
    },
  });
}
