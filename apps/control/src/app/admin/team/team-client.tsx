'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { AuditEntry, Enrolment, PublicAdmin, Settings } from '@chai/db';
import { Button, CodeInput, Field, Input, Modal, QrCode, Switch, cn, useToast } from '@chai/ui';
import {
  adminStateAction,
  confirmEnrolmentAction,
  createAdminAction,
  resetAuthenticatorAction,
  updateSettingsAction,
} from '../actions';

export function TeamClient({
  me,
  admins,
  settings,
  audit,
}: {
  me: string;
  admins: PublicAdmin[];
  settings: Settings;
  audit: AuditEntry[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [enrolment, setEnrolment] = useState<(Enrolment & { name: string }) | null>(null);
  const [stepUp, setStepUp] = useState<null | ((code: string) => void)>(null);
  const [companies, setCompanies] = useState(settings.companies.join('\n'));
  const [now] = useState(() => Date.now());

  const withStepUp = <T,>(
    call: (code?: string) => Promise<{ ok: true; data: T } | { ok: false; message: string }>,
    onOk: (d: T) => void,
  ) =>
    start(async () => {
      const r = await call();
      if (r.ok) return onOk(r.data);
      if (r.message !== 'STEP_UP') return toast(r.message, 'error');
      setStepUp(
        () => (code: string) =>
          start(async () => {
            const again = await call(code);
            setStepUp(null);
            if (again.ok) onOk(again.data);
            else
              toast(
                again.message === 'STEP_UP' ? 'That code did not match.' : again.message,
                'error',
              );
          }),
      );
    });

  const setting = (patch: Partial<Settings>, done = 'Saved.') =>
    start(async () => {
      const r = await updateSettingsAction(patch);
      if (r.ok) {
        toast(done, 'success');
        router.refresh();
      } else toast(r.message, 'error');
    });

  const state = (id: string, change: 'disable' | 'enable' | 'unlock' | 'revoke_sessions') =>
    start(async () => {
      const r = await adminStateAction(id, change);
      if (r.ok) router.refresh();
      else toast(r.message, 'error');
    });

  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-display text-petal text-4xl font-black tracking-tight">
        Admins & settings
      </h1>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="bg-prussian ring-grape flex flex-col gap-4 rounded-[24px] p-6 ring-1">
          <h2 className="font-display text-petal text-xl font-bold">Admins</h2>
          <ul className="flex flex-col">
            {admins.map((a) => {
              const locked = a.hardLocked || (a.lockedUntil && Date.parse(a.lockedUntil) > now);
              return (
                <li
                  key={a.id}
                  className="border-petal-12 flex flex-wrap items-center justify-between gap-3 border-t py-4 first:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-petal font-semibold">
                      {a.name} <span className="text-petal-72 text-sm font-normal">· {a.role}</span>
                    </p>
                    <p className="text-petal-72 truncate text-sm">{a.email}</p>
                    <p className="mt-1 flex flex-wrap gap-2 text-xs">
                      <Status ok={!a.disabled} label={a.disabled ? 'disabled' : 'active'} />
                      {!a.totpConfirmed && <Status ok={false} label="authenticator not set up" />}
                      {locked && (
                        <Status ok={false} label={a.hardLocked ? 'locked' : 'locked 15 min'} />
                      )}
                      <span className="text-petal-50">
                        {a.activeSessions} session{a.activeSessions === 1 ? '' : 's'} · last sign-in{' '}
                        {a.lastSignInAt
                          ? new Date(a.lastSignInAt).toLocaleString('en-GB', {
                              timeZone: 'Asia/Karachi',
                            })
                          : 'never'}
                      </span>
                    </p>
                  </div>
                  {a.id !== me && (
                    <div className="flex flex-wrap gap-1">
                      {locked && (
                        <Button size="sm" variant="secondary" onClick={() => state(a.id, 'unlock')}>
                          Unlock
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          withStepUp(
                            (code) => resetAuthenticatorAction(a.id, code),
                            (d) => setEnrolment({ ...d, name: a.name }),
                          )
                        }
                      >
                        Reset authenticator
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => state(a.id, 'revoke_sessions')}
                      >
                        Sign out everywhere
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => state(a.id, a.disabled ? 'enable' : 'disable')}
                      >
                        {a.disabled ? 'Enable' : 'Disable'}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <form
            className="border-petal-12 grid gap-3 border-t pt-5 sm:grid-cols-[1fr_1.3fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              withStepUp(
                (code) => createAdminAction({ name, email, stepUpCode: code }),
                (d) => {
                  setEnrolment({ ...d, name });
                  setName('');
                  setEmail('');
                  router.refresh();
                },
              );
            }}
          >
            <Field label="Name">
              {({ id }) => (
                <Input
                  id={id}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Arwa"
                  className="h-11"
                />
              )}
            </Field>
            <Field label="Email">
              {({ id }) => (
                <Input
                  id={id}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="h-11"
                />
              )}
            </Field>
            <Button
              type="submit"
              loading={pending}
              disabled={name.length < 2 || !email.includes('@')}
            >
              Add admin
            </Button>
          </form>
        </div>

        <div className="bg-prussian ring-grape flex flex-col gap-5 rounded-[24px] p-6 ring-1">
          <h2 className="font-display text-petal text-xl font-bold">Switches</h2>
          <Switch
            checked={settings.switches.questions}
            onChange={(v) => setting({ switches: { ...settings.switches, questions: v } })}
            label="Questions open"
          />
          <Switch
            checked={settings.switches.cvs}
            onChange={(v) => setting({ switches: { ...settings.switches, cvs: v } })}
            label="CV uploads open"
          />
          <Switch
            checked={settings.switches.registration}
            onChange={(v) => setting({ switches: { ...settings.switches, registration: v } })}
            label="Game registration open"
          />
          <Switch
            checked={settings.switches.moments}
            onChange={(v) => setting({ switches: { ...settings.switches, moments: v } })}
            label="Share Moments open"
          />
          <div className="border-petal-12 border-t" />
          <Switch
            checked={settings.moderation}
            onChange={(v) => setting({ moderation: v })}
            label="Claude moderation"
            description="Off: items wait as Unscanned for manual review."
          />
          <Switch
            checked={settings.projectorMode}
            onChange={(v) => setting({ projectorMode: v })}
            label="Projector mode"
            description="Lifts the display background for washed-out projectors."
          />
          <div className="border-petal-12 flex flex-col gap-2 border-t pt-5">
            <Field label="Companies and fields for CVs" hint="One per line.">
              {({ id, describedBy }) => (
                <textarea
                  id={id}
                  aria-describedby={describedBy}
                  value={companies}
                  onChange={(e) => setCompanies(e.target.value)}
                  className="bg-ink-2 text-petal ring-grape focus:ring-plum min-h-32 rounded-2xl px-4 py-3 text-sm ring-1 ring-inset focus:ring-2 focus:outline-none"
                />
              )}
            </Field>
            <Button
              size="sm"
              variant="secondary"
              className="self-start"
              onClick={() =>
                setting(
                  {
                    companies: companies
                      .split('\n')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                  'Companies saved.',
                )
              }
            >
              Save companies
            </Button>
          </div>
          <div className="border-petal-12 flex items-center justify-between gap-3 border-t pt-5">
            <div>
              <p className="text-petal text-sm font-semibold">Google Drive</p>
              <p className="text-petal-72 text-sm">
                Not connected yet. Connects in the Share Moments phase.
              </p>
            </div>
            <span className="bg-grape size-2.5 rounded-full" aria-label="Not connected" />
          </div>
        </div>
      </section>

      <section
        className="bg-prussian ring-grape flex flex-col gap-4 rounded-[24px] p-6 ring-1"
        aria-labelledby="audit-h"
      >
        <h2 id="audit-h" className="font-display text-petal text-xl font-bold">
          Audit log
        </h2>
        <ul className="max-h-[32rem] overflow-y-auto">
          {audit.map((e) => (
            <li
              key={e.id}
              className="border-petal-12 grid grid-cols-[8rem_minmax(0,1fr)] gap-3 border-t py-2.5 text-sm first:border-0 sm:grid-cols-[10rem_9rem_minmax(0,1fr)]"
            >
              <span className="text-petal-50 font-mono text-xs">
                {new Date(e.createdAt).toLocaleString('en-GB', {
                  timeZone: 'Asia/Karachi',
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
              <span className="text-petal truncate font-semibold">{e.adminName ?? 'system'}</span>
              <span className="text-petal-72 col-span-2 truncate sm:col-span-1">
                <span className="text-plum font-mono">{e.action}</span> {e.detail}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <EnrolmentModal
        key={enrolment?.adminId ?? 'none'}
        enrolment={enrolment}
        onClose={() => {
          setEnrolment(null);
          router.refresh();
        }}
      />
      <StepUpModal
        open={Boolean(stepUp)}
        onClose={() => setStepUp(null)}
        onCode={(c) => stepUp?.(c)}
      />
    </div>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 font-semibold ring-1',
        ok ? 'text-mint ring-mint/40' : 'text-coral ring-coral/50',
      )}
    >
      {label}
    </span>
  );
}

function EnrolmentModal({
  enrolment,
  onClose,
}: {
  enrolment: (Enrolment & { name: string }) | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [pending, start] = useTransition();
  const [left, setLeft] = useState(600);
  useEffect(() => {
    if (!enrolment) return;
    const tick = () =>
      setLeft(Math.max(0, Math.round((Date.parse(enrolment.expiresAt) - Date.now()) / 1000)));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [enrolment]);
  return (
    <Modal
      open={Boolean(enrolment)}
      onClose={onClose}
      title={`Set up ${enrolment?.name ?? ''}’s authenticator`}
      description="Do this in person. In Microsoft Authenticator: Add account → Other account → scan. This QR is shown once."
      className="max-w-lg"
    >
      {enrolment && (
        <div className="flex flex-col items-center gap-5">
          {left > 0 ? (
            <QrCode value={enrolment.otpauth} className="w-60" label="Authenticator setup QR" />
          ) : (
            <p className="text-coral">This QR expired. Reset the authenticator to get a new one.</p>
          )}
          <p className="text-petal-72 font-mono text-xs">
            Expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
          </p>
          <p className="text-petal self-start text-sm font-semibold">
            Then type the code their phone shows:
          </p>
          <CodeInput
            value={code}
            onChange={setCode}
            onComplete={(c) =>
              start(async () => {
                const r = await confirmEnrolmentAction(enrolment.adminId, c);
                if (r.ok) {
                  toast('Authenticator confirmed.', 'success');
                  onClose();
                } else {
                  toast(r.message, 'error');
                  setCode('');
                }
              })
            }
          />
          {pending && <p className="text-petal-72 text-sm">Checking…</p>}
        </div>
      )}
    </Modal>
  );
}

function StepUpModal({
  open,
  onClose,
  onCode,
}: {
  open: boolean;
  onClose: () => void;
  onCode: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  return (
    <Modal
      open={open}
      onClose={() => {
        setCode('');
        onClose();
      }}
      title="Confirm it’s you"
      description="Enter a fresh code from your authenticator. This protects admin changes."
    >
      <CodeInput
        value={code}
        onChange={setCode}
        onComplete={(c) => {
          setCode('');
          onCode(c);
        }}
        autoFocus
      />
    </Modal>
  );
}
