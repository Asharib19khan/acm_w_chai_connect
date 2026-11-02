import 'server-only';
import { sql, tx } from '../sql';
import { bump, DEFAULT_SETTINGS, ready, revision } from '../store';
import type { Settings } from '../types';
import { writeAudit } from './audit';

export async function getSettings(): Promise<Settings> {
  await ready();
  const [row] = await sql()<{ data: Settings }[]>`select data from settings where id = 1`;
  return { ...DEFAULT_SETTINGS, ...row?.data };
}

export async function updateSettings(
  patch: Partial<Settings>,
  actor: { id: string; name: string },
): Promise<Settings> {
  await ready();
  return tx(async (t) => {
    const [row] = await t<{ data: Settings }[]>`select data from settings where id = 1 for update`;
    const current = { ...DEFAULT_SETTINGS, ...row?.data };
    const next: Settings = {
      ...current,
      ...patch,
      switches: { ...current.switches, ...(patch.switches ?? {}) },
    };
    await t`update settings set data = ${t.json(next as never)} where id = 1`;
    await writeAudit(t, actor, 'settings.update', 'settings', null, Object.keys(patch).join(', '));
    await bump(t);
    return next;
  });
}

/** Cheap change counter for screens that poll. */
export async function getRevision(): Promise<number> {
  return revision();
}
