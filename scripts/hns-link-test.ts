/*
 * Test helper for the Hide & Seek link: registers 22 made-up students for Hide & Seek through the
 * real registration code and creates a game-server station key. Run it against a throwaway store
 * (CHAI_DATA_DIR) only. Prints {key, players:[{rollNo, passCode}]}.
 */
import { createStation, listGames, register, setGameStatus } from '@chai/db';
import { DEPARTMENT_CODES } from '@chai/core';

const actor = { id: 'hns-test', name: 'Hide & Seek link test' };
const games = await listGames();
const game = games.find((g) => g.slug === 'hide-and-seek');
if (!game) throw new Error('No Hide & Seek game');
if (game.status !== 'open') await setGameStatus(game.id, 'open', actor);
const players: { rollNo: string; passCode: string }[] = [];
for (let i = 0; i < 22; i++) {
  const rollNo = `25K-${6100 + i}`;
  const r = await register({ rollNo, department: DEPARTMENT_CODES[i % DEPARTMENT_CODES.length]!, gameIds: [game.id] });
  players.push({ rollNo, passCode: r.passCode });
}
const { key } = await createStation(game.id, 'Game server', actor);
console.log(JSON.stringify({ key, players }));
