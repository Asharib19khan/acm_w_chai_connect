'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState, useTransition, type DragEvent } from 'react';
import { LIMITS } from '@chai/core';
import { Button, ButtonLink, ChaiCup, Checkbox, ChoiceChip, Field, Input, cn } from '@chai/ui';
import { IdentityFields } from '@/components/identity-fields';
import { uploadCvAction } from './actions';

function formatSize(bytes: number) {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function CvForm({ companies }: { companies: string[] }) {
  const [rollNo, setRollNo] = useState('');
  const [department, setDepartment] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [consentShare, setConsentShare] = useState(false);
  const [consentDisplay, setConsentDisplay] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setErrors((e) => ({ ...e, file: 'That file is not a PDF.' }));
      return;
    }
    if (f.size > LIMITS.cvMaxBytes) {
      setErrors((e) => ({ ...e, file: `That PDF is ${formatSize(f.size)}. The limit is 4 MB.` }));
      return;
    }
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'file')));
    setFile(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files[0]);
  };

  const submit = () =>
    start(async () => {
      setFormError(null);
      const form = new FormData();
      form.set('rollNo', rollNo);
      form.set('department', department);
      interests.forEach((i) => form.append('interests', i));
      form.set('interestNote', note);
      form.set('consentShare', String(consentShare));
      form.set('consentDisplay', String(consentDisplay));
      if (file) form.set('file', file);
      const result = await uploadCvAction(form);
      if (result.ok) {
        setDone(result.data.rollNo);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setErrors(result.fields ?? {});
        setFormError(result.fields ? null : result.message);
      }
    });

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="border-line flex flex-col items-start gap-5 border-t pt-10"
      >
        <ChaiCup className="h-20 w-auto" />
        <h2 className="font-display text-fg text-3xl font-bold">CV received.</h2>
        <p className="text-fg-muted max-w-md">
          <span className="text-fg font-mono">{done}</span> is in. An admin reviews it before it
          reaches partner companies. To replace it later, visit the registration desk.
        </p>
        <ButtonLink href="/" variant="secondary">
          Back home
        </ButtonLink>
      </motion.div>
    );
  }

  return (
    <form
      className="flex flex-col gap-9"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <IdentityFields
        rollNo={rollNo}
        department={department}
        onRollNo={setRollNo}
        onDepartment={setDepartment}
        errors={errors}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-fg mb-3 text-sm font-semibold">Consider my CV for</legend>
        <div className="flex flex-wrap gap-2">
          {companies.map((c) => (
            <ChoiceChip
              key={c}
              selected={interests.includes(c)}
              onToggle={() =>
                setInterests((list) =>
                  list.includes(c) ? list.filter((x) => x !== c) : [...list, c],
                )
              }
            >
              {c}
            </ChoiceChip>
          ))}
        </div>
        <Field
          label="Anything specific?"
          hint="Optional: a company, a role, a field."
          className="mt-3"
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={note}
              maxLength={LIMITS.interestNoteMax}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. backend internships"
            />
          )}
        </Field>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="text-fg text-sm font-semibold">Your CV</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          aria-describedby="cv-file-help"
          className={cn(
            'group relative flex min-h-36 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border-[1.5px] border-dashed px-6 py-8 text-center transition-colors duration-200',
            dragging
              ? 'border-accent-strong bg-accent-soft'
              : errors.file
                ? 'border-danger'
                : 'border-edge hover:border-accent-strong',
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            {file ? (
              <motion.span
                key="f"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col items-center gap-1"
              >
                <span className="font-display text-fg text-lg font-semibold">{file.name}</span>
                <span className="text-fg-muted text-sm">
                  {formatSize(file.size)} ·{' '}
                  <span className="text-accent-strong underline">Change file</span>
                </span>
              </motion.span>
            ) : (
              <motion.span
                key="e"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col items-center gap-1"
              >
                <svg viewBox="0 0 24 24" className="text-accent-strong mb-1 size-8" aria-hidden>
                  <path
                    d="M12 16V4m0 0 4.5 4.5M12 4 7.5 8.5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-display text-fg text-lg font-semibold">Choose your PDF</span>
                <span className="text-fg-muted text-sm">or drop it here</span>
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <p
          id="cv-file-help"
          className={cn('text-sm', errors.file ? 'text-danger font-medium' : 'text-fg-muted')}
          role={errors.file ? 'alert' : undefined}
        >
          {errors.file ?? 'PDF only, up to 4 MB and 3 pages.'}
        </p>
      </div>

      <div className="border-line flex flex-col gap-4 border-t pt-7">
        <Checkbox
          checked={consentShare}
          onChange={setConsentShare}
          invalid={Boolean(errors.consentShare)}
        >
          Share my CV with Chai Connect partner companies.
        </Checkbox>
        {errors.consentShare && (
          <p className="text-danger -mt-2 pl-8 text-sm font-medium">{errors.consentShare}</p>
        )}
        <Checkbox checked={consentDisplay} onChange={setConsentDisplay}>
          Show a summary on the event screen: department and skills only, never my name.
        </Checkbox>
        <p className="text-fg-muted pl-8 text-sm">
          CVs are screened by an AI tool for moderation and deleted 60 days after the event.
        </p>
      </div>

      {formError && (
        <p role="alert" className="text-danger text-sm font-medium">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" loading={pending} className="self-start">
        Send my CV
      </Button>
    </form>
  );
}
