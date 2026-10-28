'use server';

import { createQuestion, hasAsked } from '@chai/db';
import { fieldIssues, questionInputSchema } from '@chai/core';
import { ensureDevice, ipHash } from '@/lib/device';
import { LIMITS, limited } from '@/lib/rate-limit';
import { fail, SLOW_DOWN, type ActionResult } from '@/lib/result';

export async function askAction(input: {
  body: string;
  showName: boolean;
  displayName?: string;
  src?: string;
  mirrored?: string | null;
}): Promise<ActionResult<{ deviceToken: string }>> {
  // Order: validate → (Turnstile in production) → rate limit → write.
  const parsed = questionInputSchema.safeParse({
    body: input.body,
    showName: input.showName,
    displayName: input.displayName,
    src: input.src || undefined,
  });
  if (!parsed.success)
    return { ok: false, message: 'Check the form.', fields: fieldIssues(parsed.error) };
  if (limited(`ask:${await ipHash()}`, LIMITS.askIp)) return { ok: false, message: SLOW_DOWN };
  try {
    const device = await ensureDevice(input.mirrored);
    await createQuestion({
      body: parsed.data.body,
      showName: parsed.data.showName,
      displayName: parsed.data.displayName ?? null,
      deviceHash: device.hash,
      src: parsed.data.src ?? null,
    });
    return { ok: true, data: { deviceToken: device.token } };
  } catch (error) {
    return fail(error);
  }
}

/** Lets a phone whose cookie was cleared prove it already asked, using its mirrored ID. */
export async function checkAskedAction(mirrored: string): Promise<boolean> {
  const device = await ensureDevice(mirrored);
  return hasAsked(device.hash);
}
