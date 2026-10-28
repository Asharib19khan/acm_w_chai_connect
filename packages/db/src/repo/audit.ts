import 'server-only';
import { newId } from '../crypto';
import { now, read } from '../store';
import type { AuditEntry, Db } from '../types';

/** Call inside a mutate() so the audit row lands in the same write as the change. */
export function writeAudit(
  db: Db,
  actor: { id: string; name: string } | null,
  action: string,
  entity: string,
  entityId: string | null,
  detail: string | null = null,
): void {
  db.audit.unshift({
    id: newId('aud'),
    adminId: actor?.id ?? null,
    adminName: actor?.name ?? null,
    action,
    entity,
    entityId,
    detail,
    createdAt: now(),
  });
  if (db.audit.length > 5000) db.audit.length = 5000;
}

export async function listAudit(
  filter: { adminId?: string; limit?: number } = {},
): Promise<AuditEntry[]> {
  const db = await read();
  return db.audit
    .filter((entry) => !filter.adminId || entry.adminId === filter.adminId)
    .slice(0, filter.limit ?? 200);
}
