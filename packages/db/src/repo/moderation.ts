import 'server-only';
import { mutate, now, UserError } from '../store';
import type { Db, Moderated } from '../types';
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

function collection(db: Db, kind: ReviewKind): (Moderated & { id: string })[] {
  return db[kind];
}

export interface ReviewActor {
  id: string;
  name: string;
}

/**
 * Applies a review action. Checks the item's current status inside the same locked write, so two
 * admins cannot double-act: the second gets "Already reviewed by <name>".
 */
export async function review(
  kind: ReviewKind,
  ids: string[],
  action: ReviewAction,
  actor: ReviewActor,
  reason?: string,
): Promise<{ done: number; skipped: string[] }> {
  return mutate((db) => {
    const items = collection(db, kind);
    const skipped: string[] = [];
    let done = 0;
    for (const id of ids) {
      const item = items.find((i) => i.id === id);
      if (!item) continue;
      const allowed =
        action === 'restore'
          ? item.status === 'removed' || item.status === 'approved'
          : item.status !== (action === 'approve' ? 'approved' : 'removed');
      if (!allowed) {
        const by = db.admins.find((a) => a.id === item.reviewedBy)?.name ?? 'another admin';
        skipped.push(`Already reviewed by ${by}`);
        continue;
      }
      const before = item.status;
      if (action === 'approve') item.status = 'approved';
      if (action === 'remove') {
        item.status = 'removed';
        item.removedReason = reason ?? 'other';
      }
      if (action === 'restore') {
        item.status = 'scanned';
        item.removedReason = null;
      }
      item.reviewedBy = actor.id;
      item.reviewedAt = now();
      writeAudit(
        db,
        actor,
        `${kind}.${action}`,
        kind,
        id,
        `${before} → ${item.status}${reason ? ` (${reason})` : ''}`,
      );
      done++;
    }
    if (done === 0 && skipped.length > 0) throw new UserError(skipped[0]!);
    return { done, skipped };
  });
}
