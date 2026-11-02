import 'server-only';
import { newId } from '../crypto';
import { sql, type Tx } from '../sql';
import { now, ready } from '../store';
import type { AuditEntry } from '../types';

/** Call with the same transaction as the change, so the audit row lands in the same write. */
export async function writeAudit(
  t: Tx,
  actor: { id: string; name: string } | null,
  action: string,
  entity: string,
  entityId: string | null,
  detail: string | null = null,
): Promise<void> {
  const row: AuditEntry = {
    id: newId('aud'),
    adminId: actor?.id ?? null,
    adminName: actor?.name ?? null,
    action,
    entity,
    entityId,
    detail,
    createdAt: now(),
  };
  await t`insert into audit ${t(row as never)}`;
}

export async function listAudit(
  filter: { adminId?: string; limit?: number } = {},
): Promise<AuditEntry[]> {
  await ready();
  const s = sql();
  return s<AuditEntry[]>`
    select * from audit
    where ${filter.adminId ? s`admin_id = ${filter.adminId}` : s`true`}
    order by created_at desc
    limit ${filter.limit ?? 200}`;
}
