import 'server-only';
import { mutate, read } from '../store';
import type { Settings } from '../types';
import { writeAudit } from './audit';

export async function getSettings(): Promise<Settings> {
  return (await read()).settings;
}

export async function updateSettings(
  patch: Partial<Settings>,
  actor: { id: string; name: string },
): Promise<Settings> {
  return mutate((db) => {
    db.settings = {
      ...db.settings,
      ...patch,
      switches: { ...db.settings.switches, ...(patch.switches ?? {}) },
    };
    writeAudit(db, actor, 'settings.update', 'settings', null, Object.keys(patch).join(', '));
    return db.settings;
  });
}

/** Cheap change counter for screens that poll. */
export async function getRevision(): Promise<number> {
  return (await read()).revision;
}
