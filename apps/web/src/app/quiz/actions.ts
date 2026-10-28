'use server';

import { joinQuiz } from '@chai/db';
import { fieldIssues, quizJoinSchema } from '@chai/core';
import { ensureDevice, ipHash } from '@/lib/device';
import { setQuizToken } from '@/lib/quiz-session';
import { LIMITS, limited } from '@/lib/rate-limit';
import { fail, SLOW_DOWN, type ActionResult } from '@/lib/result';

export async function joinQuizAction(input: {
  rollNo: string;
  department: string;
  acceptRules: boolean;
}): Promise<ActionResult> {
  const parsed = quizJoinSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: 'Check the form.', fields: fieldIssues(parsed.error) };
  const device = await ensureDevice();
  if (
    limited(`qj:d:${device.hash}`, LIMITS.quizJoinDevice) ||
    limited(`qj:ip:${await ipHash()}`, LIMITS.quizJoinIp)
  ) {
    return { ok: false, message: SLOW_DOWN };
  }
  try {
    const { token } = await joinQuiz({
      rollNo: parsed.data.rollNo,
      department: parsed.data.department,
      deviceHash: device.hash,
    });
    await setQuizToken(token);
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}
