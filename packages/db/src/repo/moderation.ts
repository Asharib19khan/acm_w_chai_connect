import 'server-only';
import { tx } from '../sql';
import { bump, now, ready, UserError } from '../store';
import type { Moderated } from '../types';
import { writeAudit } from './audit';

export type ReviewKind = 'questions' | 'cvs' | 'moments';
export type ReviewAction = 'approve' | 'remove' | 'restore';

export function newModeration(rule: {
  flag: 'green' | 'red';
  categories: string[];
  reasons: string[];
}): Moderated {
  return {
    status: 'scanned',
    flag: rule.flag,
    flagReasons: rule.reasons,
    flagCategories: rule.categories,
    flagSource: 'rules',
    reviewedBy: null,
    reviewedAt: null,
    removedReason: null,
  };
}

export interface ReviewActor {
  id: string;
  name: string;
}

/**
 * Applies a review action. Locks the items first, so two admins cannot double-act: the second
 * gets "Already reviewed by <name>".
 */
export async function review(
  kind: ReviewKind,
  ids: string[],
  action: ReviewAction,
  actor: ReviewActor,
  reason?: string,
): Promise<{ done: number; skipped: string[] }> {
  await ready();
  if (ids.length === 0) return { done: 0, skipped: [] };
  return tx(async (t) => {
    const table = t(kind);
    const items = await t<(Moderated & { id: string })[]>`
      select id, status, reviewed_by from ${table} where id in ${t(ids)} order by id for update`;
    const byId = new Map(items.map((i) => [i.id, i]));
    const skipped: string[] = [];
    let done = 0;
    for (const id of ids) {
      const item = byId.get(id);
      if (!item) continue;
      const allowed =
        action === 'restore'
          ? item.status === 'removed' || item.status === 'approved'
          : item.status !== (action === 'approve' ? 'approved' : 'removed');
      if (!allowed) {
        const [by] = item.reviewedBy
          ? await t<{ name: string }[]>`select name from admins where id = ${item.reviewedBy}`
          : [];
        skipped.push(`Already reviewed by ${by?.name ?? 'another admin'}`);
        continue;
      }
      const before = item.status;
      const status = action === 'approve' ? 'approved' : action === 'remove' ? 'removed' : 'scanned';
      const removedReason = action === 'remove' ? (reason ?? 'other') : action === 'restore' ? null : undefined;
      await t`
        update ${table} set status = ${status}, reviewed_by = ${actor.id}, reviewed_at = ${now()}
        ${removedReason !== undefined ? t`, removed_reason = ${removedReason}` : t``}
        where id = ${id}`;
      await writeAudit(
        t,
        actor,
        `${kind}.${action}`,
        kind,
        id,
        `${before} → ${status}${reason ? ` (${reason})` : ''}`,
      );
      done++;
    }
    if (done === 0 && skipped.length > 0) throw new UserError(skipped[0]!);
    if (done > 0) await bump(t);
    return { done, skipped };
  });
}
