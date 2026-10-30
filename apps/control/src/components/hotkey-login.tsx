'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Button, ButtonLink, CodeInput, Field, Input, Modal } from '@chai/ui';
import { signInAction } from '@/lib/auth/actions';

/**
 * Hidden admin sign-in. Ctrl + Shift + 1 + 9 (tracked by event.code, so Shift doesn't turn 1
 * into "!"), or a 3-second long-press on the logo for phones. The combo only hides the box:
 * the Authenticator code, lockouts and server checks are the security.
 */
export function useSecretCombo(onTrigger: () => void) {
  useEffect(() => {
    const down = new Set<string>();
    const onKey = (e: KeyboardEvent) => {
      down.add(e.code);
      const one = down.has('Digit1') || down.has('Numpad1');
      const nine = down.has('Digit9') || down.has('Numpad9');
      if (e.ctrlKey && e.shiftKey && one && nine) {
        e.preventDefault();
        down.clear();
        onTrigger();
      }
    };
    const onUp = (e: KeyboardEvent) => down.delete(e.code);
    const reset = () => down.clear();
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', reset);
    };
  }, [onTrigger]);
}

export function useLongPress(onTrigger: () => void, ms = 3000) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: () => {
      cancel();
      timer.current = setTimeout(onTrigger, ms);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };
}

export function LoginDialog({
  open,
  onClose,
  signedIn,
}: {
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code' | 'done'>(signedIn ? 'done' : 'email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [pending, start] = useTransition();

  const close = () => {
    onClose();
    setStep(signedIn ? 'done' : 'email');
    setCode('');
    setError(null);
  };

  const submit = useCallback(
    (value: string) =>
      start(async () => {
        setError(null);
        const result = await signInAction({ email, code: value });
        if (result.ok) {
          setName(result.name);
          setStep('done');
          router.refresh();
        } else {
          setError(result.message);
          setCode('');
        }
      }),
    [email, router],
  );

  return (
    <Modal
      open={open}
      onClose={close}
      title={step === 'done' ? `Welcome${name ? `, ${name}` : ''}` : 'Admin sign-in'}
      description={
        step === 'email'
          ? 'Enter your admin email.'
          : step === 'code'
            ? recovery
              ? 'Enter a recovery code.'
              : 'Open Microsoft Authenticator and enter the 6-digit code.'
            : undefined
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {step === 'email' && (
          <motion.form
            key="email"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
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
            <Button type="submit" disabled={!email.includes('@')}>
              Continue
            </Button>
          </motion.form>
        )}
        {step === 'code' && (
          <motion.form
            key="code"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onSubmit={(e) => {
              e.preventDefault();
              submit(code);
            }}
            className="flex flex-col gap-5"
          >
            {recovery ? (
              <Field label="Recovery code">
                {({ id }) => (
                  <Input
                    id={id}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="font-mono tracking-widest"
                    autoFocus
                    maxLength={10}
                  />
                )}
              </Field>
            ) : (
              <CodeInput
                value={code}
                onChange={setCode}
                onComplete={submit}
                invalid={Boolean(error)}
                autoFocus
              />
            )}
            {error && (
              <p role="alert" className="text-danger text-sm font-medium">
                {error}
              </p>
            )}
            <Button
              type="submit"
              loading={pending}
              disabled={recovery ? code.length !== 10 : code.length !== 6}
            >
              Sign in
            </Button>
            <div className="flex justify-between text-sm">
              <button
                type="button"
                className="text-fg-muted hover:text-fg"
                onClick={() => setStep('email')}
              >
                Change email
              </button>
              <button
                type="button"
                className="text-fg-muted hover:text-fg"
                onClick={() => {
                  setRecovery(!recovery);
                  setCode('');
                }}
              >
                {recovery ? 'Use authenticator' : 'Use a recovery code'}
              </button>
            </div>
          </motion.form>
        )}
        {step === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            <ButtonLink href="/admin" onClick={close}>
              Open admin portal
            </ButtonLink>
            <Button variant="ghost" onClick={close}>
              Stay on screen
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
