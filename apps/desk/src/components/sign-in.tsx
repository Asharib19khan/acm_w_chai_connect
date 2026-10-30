'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { Button, ChaiCup, CodeInput, Field, Input } from '@chai/ui';
import { deskSignInAction } from '@/lib/auth/actions';

/** Visible sign-in for web team members: email, then the 6-digit Authenticator code. */
export function SignIn() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = useCallback(
    (value: string) =>
      start(async () => {
        setError(null);
        const result = await deskSignInAction({ email, code: value });
        if (result.ok) router.refresh();
        else {
          setError(result.message);
          setCode('');
        }
      }),
    [email, router],
  );

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <ChaiCup className="h-14 w-auto" />
        <h1 className="font-display text-fg mt-6 text-4xl leading-[0.95] font-black tracking-tight">
          Games desk
        </h1>
        <p className="text-fg-muted mt-3">Registrations, check-in and scores for the web team.</p>
        <div className="bg-surface ring-edge mt-8 rounded-[28px] p-6 shadow-[0_24px_60px_-30px_var(--cc-shadow)] ring-1">
          <AnimatePresence mode="wait" initial={false}>
            {step === 'email' ? (
              <motion.form
                key="email"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.includes('@')) setStep('code');
                }}
                className="flex flex-col gap-5"
              >
                <Field label="Email">
                  {({ id }) => (
                    <Input
                      id={id}
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus
                      placeholder="you@example.com"
                    />
                  )}
                </Field>
                <Button type="submit" size="lg" disabled={!email.includes('@')}>
                  Continue
                </Button>
              </motion.form>
            ) : (
              <motion.form
                key="code"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(code);
                }}
                className="flex flex-col gap-5"
              >
                <p className="text-fg-muted text-sm">
                  Open Microsoft Authenticator and enter the 6-digit code for{' '}
                  <span className="text-fg font-medium">{email}</span>.
                </p>
                <CodeInput
                  value={code}
                  onChange={setCode}
                  onComplete={submit}
                  invalid={Boolean(error)}
                  autoFocus
                />
                {error && (
                  <p role="alert" className="text-danger text-sm font-medium">
                    {error}
                  </p>
                )}
                <Button type="submit" size="lg" loading={pending} disabled={code.length !== 6}>
                  Sign in
                </Button>
                <button
                  type="button"
                  className="text-fg-muted hover:text-fg self-start text-sm"
                  onClick={() => {
                    setStep('email');
                    setCode('');
                    setError(null);
                  }}
                >
                  Change email
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
        <p className="text-fg-subtle mt-6 text-xs">No account? Ask the web team lead to add you.</p>
      </div>
    </main>
  );
}
