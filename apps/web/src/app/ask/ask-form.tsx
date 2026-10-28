'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, useTransition } from 'react';
import { LIMITS } from '@chai/core';
import { Button, ButtonLink, ChaiCup, Field, Input, Switch, Textarea, cn } from '@chai/ui';
import { readIndexedMirror, readMirror, writeMirror } from '@/lib/device-mirror';
import { askAction, checkAskedAction } from './actions';

export function AskForm({ alreadyAsked, src }: { alreadyAsked: boolean; src: string | null }) {
  const [body, setBody] = useState('');
  const [showName, setShowName] = useState(false);
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [state, setState] = useState<'form' | 'sent' | 'asked'>(alreadyAsked ? 'asked' : 'form');
  const [pending, start] = useTransition();

  useEffect(() => {
    if (alreadyAsked) return;
    // Cookie cleared? The mirrored ID still knows this phone asked.
    (async () => {
      const mirrored = readMirror() ?? (await readIndexedMirror());
      if (mirrored && (await checkAskedAction(mirrored))) setState('asked');
    })();
  }, [alreadyAsked]);

  const submit = () =>
    start(async () => {
      setFormError(null);
      const result = await askAction({
        body,
        showName,
        displayName: name,
        src: src ?? undefined,
        mirrored: readMirror(),
      });
      if (result.ok) {
        writeMirror(result.data.deviceToken);
        setState('sent');
      } else {
        setErrors(result.fields ?? {});
        setFormError(result.fields ? null : result.message);
        if (result.message.includes('already asked')) setState('asked');
      }
    });

  const left = LIMITS.questionMax - body.length;

  return (
    <AnimatePresence mode="wait">
      {state === 'form' ? (
        <motion.form
          key="form"
          exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
          transition={{ duration: 0.25 }}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-7"
          noValidate
        >
          <Field
            label="Your question"
            error={errors.body}
            aside={
              <span
                className={cn(
                  'tabular font-mono text-xs',
                  left < 20 ? 'text-coral' : 'text-petal-50',
                )}
                aria-live="polite"
              >
                {left}
              </span>
            }
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                value={body}
                maxLength={LIMITS.questionMax}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What would you ask if nobody was watching?"
                autoFocus
              />
            )}
          </Field>

          <div className="border-petal-12 flex flex-col gap-4 border-t pt-6">
            <Switch
              checked={showName}
              onChange={setShowName}
              label="Show my name"
              description="Off means the screen shows “Anonymous”. Only admins can see which phone asked."
            />
            <AnimatePresence initial={false}>
              {showName && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <Field label="Name on screen" error={errors.displayName} className="pt-2">
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        aria-invalid={invalid || undefined}
                        value={name}
                        maxLength={LIMITS.nameMax}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="How you'd like to be credited"
                        autoComplete="nickname"
                      />
                    )}
                  </Field>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {formError && (
            <p role="alert" className="text-coral text-sm font-medium">
              {formError}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-petal-72 text-sm">One question per phone, so make it count.</p>
            <Button
              type="submit"
              size="lg"
              loading={pending}
              disabled={body.trim().length < LIMITS.questionMin}
            >
              Send question
            </Button>
          </div>
        </motion.form>
      ) : (
        <motion.div
          key="done"
          initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="border-petal-12 flex flex-col items-start gap-5 border-t pt-10"
        >
          <ChaiCup className="h-20 w-auto" />
          <h2 className="font-display text-petal text-3xl font-bold">
            {state === 'sent' ? 'Your question is in.' : 'You’ve already asked from this phone.'}
          </h2>
          <p className="text-petal-72 max-w-md">
            {state === 'sent'
              ? 'Admins check every question before it goes on the big screen. Keep an eye on the auditorium.'
              : 'Each phone gets one question, so everyone gets a turn. Watch for yours on the big screen.'}
          </p>
          <ButtonLink href="/" variant="secondary">
            Back home
          </ButtonLink>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
