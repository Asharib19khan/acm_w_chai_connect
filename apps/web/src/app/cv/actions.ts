'use server';

import { createCv } from '@chai/db';
import { cvInputSchema, fieldIssues, LIMITS } from '@chai/core';
import { ensureDevice, ipHash } from '@/lib/device';
import { LIMITS as RATE, limited } from '@/lib/rate-limit';
import { fail, SLOW_DOWN, type ActionResult } from '@/lib/result';

export async function uploadCvAction(form: FormData): Promise<ActionResult<{ rollNo: string }>> {
  const parsed = cvInputSchema.safeParse({
    rollNo: form.get('rollNo'),
    department: form.get('department'),
    interests: form.getAll('interests').map(String),
    interestNote: (form.get('interestNote') as string) || undefined,
    consentShare: form.get('consentShare') === 'true',
    consentDisplay: form.get('consentDisplay') === 'true',
  });
  if (!parsed.success)
    return { ok: false, message: 'Check the form.', fields: fieldIssues(parsed.error) };

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      message: 'Attach your CV as a PDF.',
      fields: { file: 'Attach your CV as a PDF.' },
    };
  }
  if (file.size > LIMITS.cvMaxBytes) {
    return {
      ok: false,
      message: 'That PDF is over 4 MB.',
      fields: { file: 'That PDF is over 4 MB. Export a smaller copy.' },
    };
  }

  const device = await ensureDevice();
  if (
    limited(`cv:d:${device.hash}`, RATE.cvDevice) ||
    limited(`cv:ip:${await ipHash()}`, RATE.cvIp)
  ) {
    return { ok: false, message: SLOW_DOWN };
  }
  try {
    const cv = await createCv({
      rollNo: parsed.data.rollNo,
      department: parsed.data.department,
      interests: parsed.data.interests,
      interestNote: parsed.data.interestNote ?? null,
      consentDisplay: parsed.data.consentDisplay,
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return { ok: true, data: { rollNo: cv.rollNo } };
  } catch (error) {
    return fail(error);
  }
}
