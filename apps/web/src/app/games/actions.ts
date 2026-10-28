'use server';

import { lookupRegistration, register, type RegisterResult } from '@chai/db';
import { fieldIssues, registrationInputSchema, rollNumberSchema } from '@chai/core';
import { ensureDevice, ipHash } from '@/lib/device';
import { LIMITS, limited } from '@/lib/rate-limit';
import { fail, SLOW_DOWN, type ActionResult } from '@/lib/result';

export async function registerAction(input: {
  rollNo: string;
  department: string;
  physical?: string;
  mini?: string;
}): Promise<ActionResult<RegisterResult>> {
  const parsed = registrationInputSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: 'Check the form.', fields: fieldIssues(parsed.error) };
  const device = await ensureDevice();
  if (
    limited(`reg:d:${device.hash}`, LIMITS.registerDevice) ||
    limited(`reg:ip:${await ipHash()}`, LIMITS.registerIp)
  ) {
    return { ok: false, message: SLOW_DOWN };
  }
  try {
    const gameIds = [parsed.data.physical, parsed.data.mini].filter((id): id is string =>
      Boolean(id),
    );
    return {
      ok: true,
      data: await register({
        rollNo: parsed.data.rollNo,
        department: parsed.data.department,
        gameIds,
      }),
    };
  } catch (error) {
    return fail(error);
  }
}

export async function lookupAction(
  rollNo: string,
  code: string,
): Promise<ActionResult<Awaited<ReturnType<typeof lookupRegistration>>>> {
  const roll = rollNumberSchema.safeParse(rollNo);
  if (!roll.success) return { ok: false, message: 'Enter your roll number like 25K-5570.' };
  if (limited(`lookup:${await ipHash()}`, [60, 10 * 60_000]))
    return { ok: false, message: SLOW_DOWN };
  const rows = await lookupRegistration(roll.data, code);
  if (rows.length === 0)
    return { ok: false, message: 'No registration matches that roll number and code.' };
  return { ok: true, data: rows };
}
