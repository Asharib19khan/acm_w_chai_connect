import 'server-only';
import { generateTotpSecret, otpauthUrl, verifyTotp } from '@chai/core/totp';
import { decrypt, encrypt, hmac, newId, randomToken, serverKey } from '../crypto';
import { dbEnv } from '../env';
import { isUnique, sql, tx, type Tx } from '../sql';
import { now, ready, UserError } from '../store';
import type { Admin, AdminRole, AdminSession, SessionApp } from '../types';
import { writeAudit } from './audit';

const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;
const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
const ENROLL_MS = 10 * 60 * 1000;
const SOFT_LOCK_AFTER = 5;
const SOFT_LOCK_MS = 15 * 60 * 1000;
const HARD_LOCK_AFTER = 10;

export type PublicAdmin = Omit<Admin, 'totpSecretEnc'> & { activeSessions: number };

function totpKey() {
  return serverKey('TOTP_ENCRYPTION_KEY');
}

function hashToken(token: string): string {
  return hmac(serverKey('SESSION_HMAC_KEY'), `admin:${token}`);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function activeSessions(t: Tx, adminId: string): Promise<number> {
  const [row] = await t<{ n: number }[]>`
    select count(*)::int as n from admin_sessions
    where admin_id = ${adminId} and revoked_at is null and expires_at > now()`;
  return row?.n ?? 0;
}

async function toPublic(t: Tx, admin: Admin): Promise<PublicAdmin> {
  const { totpSecretEnc: _secret, ...rest } = admin;
  void _secret;
  return { ...rest, activeSessions: await activeSessions(t, admin.id) };
}

async function lockAdmin(t: Tx, where: ReturnType<Tx>): Promise<Admin | undefined> {
  const [admin] = await t<Admin[]>`select * from admins where ${where} for update`;
  return admin;
}

/** Writes the changed admin fields back (everything except id/created*). */
async function saveAdmin(t: Tx, a: Admin): Promise<void> {
  await t`
    update admins set
      name = ${a.name}, role = ${a.role}, totp_secret_enc = ${a.totpSecretEnc},
      totp_confirmed = ${a.totpConfirmed}, enroll_expires_at = ${a.enrollExpiresAt},
      failed_attempts = ${a.failedAttempts}, locked_until = ${a.lockedUntil},
      hard_locked = ${a.hardLocked}, last_totp_step = ${a.lastTotpStep},
      disabled = ${a.disabled}, last_sign_in_at = ${a.lastSignInAt}
    where id = ${a.id}`;
}

async function revokeAll(t: Tx, adminId: string): Promise<void> {
  await t`update admin_sessions set revoked_at = ${now()} where admin_id = ${adminId} and revoked_at is null`;
}

/* ---------- enrolment ---------- */

export interface Enrolment {
  adminId: string;
  secret: string;
  otpauth: string;
  expiresAt: string;
}

function newEnrolment(admin: Admin): Enrolment {
  const secret = generateTotpSecret();
  admin.totpSecretEnc = encrypt(totpKey(), secret);
  admin.totpConfirmed = false;
  admin.lastTotpStep = null;
  admin.enrollExpiresAt = new Date(Date.now() + ENROLL_MS).toISOString();
  return {
    adminId: admin.id,
    secret,
    otpauth: otpauthUrl(secret, admin.email),
    expiresAt: admin.enrollExpiresAt,
  };
}

function blankAdmin(input: { name: string; email: string; role: AdminRole; createdBy: string | null }): Admin {
  return {
    id: newId('adm'),
    name: input.name,
    email: input.email,
    role: input.role,
    totpSecretEnc: '',
    totpConfirmed: false,
    enrollExpiresAt: null,
    failedAttempts: 0,
    lockedUntil: null,
    hardLocked: false,
    lastTotpStep: null,
    disabled: false,
    createdBy: input.createdBy,
    createdAt: now(),
    lastSignInAt: null,
  };
}

/** Creates the one superadmin (bootstrap script). Refuses if one already exists. */
export async function bootstrapSuperadmin(
  name: string,
): Promise<{ enrolment: Enrolment; recoveryCodes: string[] }> {
  await ready();
  try {
    return await tx(async (t) => {
      const existing = await t`select 1 from admins where role = 'superadmin'`;
      if (existing.length) throw new UserError('A superadmin already exists.');
      const admin = blankAdmin({
        name,
        email: normalizeEmail(dbEnv.SUPERADMIN_EMAIL),
        role: 'superadmin',
        createdBy: null,
      });
      const enrolment = newEnrolment(admin);
      // The bootstrap QR is scanned at a terminal, so it gets a long window and is confirmed at first sign-in.
      admin.enrollExpiresAt = null;
      await t`insert into admins ${t(admin as never)}`;
      const recoveryCodes = Array.from({ length: 10 }, () =>
        randomToken(8).replace(/[-_]/g, 'x').slice(0, 10).toUpperCase(),
      );
      const rows = recoveryCodes.map((code) => ({
        adminId: admin.id,
        codeHash: hashToken(`recovery:${code}`),
        usedAt: null,
      }));
      await t`insert into recovery_codes ${t(rows as never)}`;
      await writeAudit(t, { id: admin.id, name }, 'admins.bootstrap', 'admins', admin.id, null);
      return { enrolment, recoveryCodes };
    });
  } catch (error) {
    if (isUnique(error)) throw new UserError('A superadmin already exists.');
    throw error;
  }
}

export async function createAdmin(
  input: { name: string; email: string; role: AdminRole },
  actor: { id: string; name: string },
): Promise<Enrolment> {
  await ready();
  if (input.role === 'superadmin') throw new UserError('There is only one superadmin.');
  const email = normalizeEmail(input.email);
  try {
    return await tx(async (t) => {
      const admin = blankAdmin({ name: input.name.trim().slice(0, 60), email, role: input.role, createdBy: actor.id });
      const enrolment = newEnrolment(admin);
      await t`insert into admins ${t(admin as never)}`;
      await writeAudit(t, actor, 'admins.create', 'admins', admin.id, `${admin.name} <${email}>`);
      return enrolment;
    });
  } catch (error) {
    if (isUnique(error)) throw new UserError('An admin with that email already exists.');
    throw error;
  }
}

export async function confirmEnrolment(
  adminId: string,
  code: string,
  actor: { id: string; name: string },
): Promise<void> {
  await ready();
  await tx(async (t) => {
    const admin = await lockAdmin(t, t`id = ${adminId}`);
    if (!admin) throw new UserError('Admin not found.');
    if (admin.enrollExpiresAt && Date.parse(admin.enrollExpiresAt) < Date.now()) {
      throw new UserError('This QR code expired. Reset the authenticator to get a new one.');
    }
    const step = verifyTotp(decrypt(totpKey(), admin.totpSecretEnc), code);
    if (step == null)
      throw new UserError('That code did not match. Check the phone and try the newest code.');
    admin.totpConfirmed = true;
    admin.enrollExpiresAt = null;
    admin.lastTotpStep = step;
    await saveAdmin(t, admin);
    await writeAudit(t, actor, 'admins.confirm', 'admins', adminId, null);
  });
}

export async function resetAuthenticator(
  adminId: string,
  actor: { id: string; name: string },
): Promise<Enrolment> {
  await ready();
  return tx(async (t) => {
    const admin = await lockAdmin(t, t`id = ${adminId}`);
    if (!admin) throw new UserError('Admin not found.');
    const enrolment = newEnrolment(admin);
    await saveAdmin(t, admin);
    await revokeAll(t, adminId);
    await writeAudit(t, actor, 'admins.reset_totp', 'admins', adminId, null);
    return enrolment;
  });
}

export async function setAdminState(
  adminId: string,
  change: 'disable' | 'enable' | 'unlock' | 'revoke_sessions',
  actor: { id: string; name: string },
): Promise<void> {
  await ready();
  await tx(async (t) => {
    const admin = await lockAdmin(t, t`id = ${adminId}`);
    if (!admin) throw new UserError('Admin not found.');
    if (admin.role === 'superadmin' && change === 'disable')
      throw new UserError('The superadmin cannot be disabled.');
    if (change === 'disable') admin.disabled = true;
    if (change === 'enable') admin.disabled = false;
    if (change === 'unlock') {
      admin.failedAttempts = 0;
      admin.lockedUntil = null;
      admin.hardLocked = false;
    }
    await saveAdmin(t, admin);
    if (change === 'disable' || change === 'revoke_sessions') await revokeAll(t, adminId);
    await writeAudit(t, actor, `admins.${change}`, 'admins', adminId, admin.email);
  });
}

export async function listAdmins(): Promise<PublicAdmin[]> {
  await ready();
  const s = sql();
  const admins = await s<Admin[]>`select * from admins order by created_at`;
  return Promise.all(admins.map((a) => toPublic(s, a)));
}

export async function hasSuperadmin(): Promise<boolean> {
  await ready();
  return (await sql()`select 1 from admins where role = 'superadmin'`).length > 0;
}

/* ---------- sign-in ---------- */

const GENERIC = "Couldn't sign you in";

/** Members may only use the games desk. Admins and the superadmin may use both sites. */
export function roleAllowedOn(role: AdminRole, app: SessionApp): boolean {
  return app === 'desk' || role !== 'member';
}

async function newSession(t: Tx, adminId: string, app: SessionApp, userAgent: string | null): Promise<string> {
  const token = randomToken();
  const session: AdminSession = {
    id: newId('ses'),
    adminId,
    app,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_ABSOLUTE_MS).toISOString(),
    lastSeenAt: now(),
    revokedAt: null,
    userAgent: userAgent?.slice(0, 200) ?? null,
  };
  await t`insert into admin_sessions ${t(session as never)}`;
  return token;
}

/**
 * Verifies email + code. Unknown emails, wrong codes and locked accounts all return the same
 * message, so nobody can learn which emails are admins.
 */
export async function signIn(
  emailInput: string,
  code: string,
  userAgent: string | null,
  app: SessionApp = 'control',
): Promise<{ ok: true; token: string; admin: PublicAdmin } | { ok: false; message: string }> {
  await ready();
  const email = normalizeEmail(emailInput);
  return tx(async (t) => {
    const admin = await lockAdmin(t, t`email = ${email}`);
    if (!admin) {
      // Same work as a real check so timing reveals nothing.
      verifyTotp(generateTotpSecret(), code);
      return { ok: false as const, message: GENERIC };
    }
    const me = { id: admin.id, name: admin.name };
    if (!roleAllowedOn(admin.role, app)) {
      // A member trying the admin portal: same answer as a wrong code, and it is audited.
      verifyTotp(generateTotpSecret(), code);
      await writeAudit(t, me, 'auth.wrong_site', 'admins', admin.id, app);
      return { ok: false as const, message: GENERIC };
    }
    const lockedSoft = admin.lockedUntil && Date.parse(admin.lockedUntil) > Date.now();
    if (admin.disabled || admin.hardLocked || lockedSoft || !admin.totpSecretEnc) {
      await writeAudit(t, me, 'auth.blocked', 'admins', admin.id, null);
      return { ok: false as const, message: GENERIC };
    }
    const step = verifyTotp(decrypt(totpKey(), admin.totpSecretEnc), code, {
      lastUsedStep: admin.lastTotpStep,
    });
    if (step == null) {
      admin.failedAttempts += 1;
      if (admin.failedAttempts >= HARD_LOCK_AFTER) admin.hardLocked = true;
      else if (admin.failedAttempts % SOFT_LOCK_AFTER === 0) {
        admin.lockedUntil = new Date(Date.now() + SOFT_LOCK_MS).toISOString();
      }
      await saveAdmin(t, admin);
      await writeAudit(t, me, 'auth.fail', 'admins', admin.id, `attempt ${admin.failedAttempts}`);
      return { ok: false as const, message: GENERIC };
    }
    admin.failedAttempts = 0;
    admin.lockedUntil = null;
    admin.lastTotpStep = step;
    admin.lastSignInAt = now();
    if (!admin.totpConfirmed) admin.totpConfirmed = true;
    await saveAdmin(t, admin);
    const token = await newSession(t, admin.id, app, userAgent);
    await writeAudit(t, me, 'auth.sign_in', 'admins', admin.id, app);
    return { ok: true as const, token, admin: await toPublic(t, admin) };
  });
}

/** Superadmin break-glass: a one-time recovery code unlocks the account and signs in. */
export async function signInWithRecovery(
  emailInput: string,
  code: string,
  userAgent: string | null,
): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  await ready();
  const email = normalizeEmail(emailInput);
  return tx(async (t) => {
    const admin = await lockAdmin(t, t`email = ${email} and role = 'superadmin'`);
    if (!admin) return { ok: false as const, message: GENERIC };
    const hash = hashToken(`recovery:${code.trim().toUpperCase()}`);
    const used = await t`
      update recovery_codes set used_at = ${now()}
      where admin_id = ${admin.id} and code_hash = ${hash} and used_at is null
      returning admin_id`;
    if (used.length === 0) return { ok: false as const, message: GENERIC };
    admin.failedAttempts = 0;
    admin.lockedUntil = null;
    admin.hardLocked = false;
    await saveAdmin(t, admin);
    const token = await newSession(t, admin.id, 'control', userAgent);
    await writeAudit(t, { id: admin.id, name: admin.name }, 'auth.recovery', 'admins', admin.id, null);
    return { ok: true as const, token };
  });
}

export interface SessionInfo {
  admin: PublicAdmin;
  session: AdminSession;
}

/**
 * Resolves a session token for one site. Expired, idle, revoked or disabled sessions, sessions
 * made on the other site, and members on the admin portal all resolve to null.
 */
export async function sessionFromToken(
  token: string | undefined,
  app: SessionApp = 'control',
): Promise<SessionInfo | null> {
  if (!token) return null;
  await ready();
  const s = sql();
  const [session] = await s<AdminSession[]>`
    select * from admin_sessions where token_hash = ${hashToken(token)}`;
  if (!session || session.revokedAt || (session.app ?? 'control') !== app) return null;
  const t = Date.now();
  if (Date.parse(session.expiresAt) < t || t - Date.parse(session.lastSeenAt) > SESSION_IDLE_MS)
    return null;
  const [admin] = await s<Admin[]>`select * from admins where id = ${session.adminId}`;
  if (!admin || admin.disabled || !roleAllowedOn(admin.role, app)) return null;
  if (t - Date.parse(session.lastSeenAt) > 60_000) {
    await s`update admin_sessions set last_seen_at = ${now()} where id = ${session.id}`;
  }
  return { admin: await toPublic(s, admin), session };
}

export async function signOut(token: string | undefined): Promise<void> {
  if (!token) return;
  await ready();
  await sql()`
    update admin_sessions set revoked_at = ${now()}
    where token_hash = ${hashToken(token)} and revoked_at is null`;
}

/** Step-up: confirms a fresh code for dangerous actions without creating a session. */
export async function stepUp(adminId: string, code: string): Promise<boolean> {
  await ready();
  return tx(async (t) => {
    const admin = await lockAdmin(t, t`id = ${adminId}`);
    if (!admin) return false;
    const step = verifyTotp(decrypt(totpKey(), admin.totpSecretEnc), code, {
      lastUsedStep: admin.lastTotpStep,
    });
    if (step == null) return false;
    await t`update admins set last_totp_step = ${step} where id = ${adminId}`;
    return true;
  });
}
