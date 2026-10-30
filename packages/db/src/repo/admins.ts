import 'server-only';
import { generateTotpSecret, otpauthUrl, verifyTotp } from '@chai/core/totp';
import { decrypt, encrypt, hmac, newId, randomToken, serverKey } from '../crypto';
import { dbEnv } from '../env';
import { mutate, now, read, UserError } from '../store';
import type { Admin, AdminRole, AdminSession, Db, SessionApp } from '../types';
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

function toPublic(db: Db, admin: Admin): PublicAdmin {
  const { totpSecretEnc: _secret, ...rest } = admin;
  void _secret;
  return {
    ...rest,
    activeSessions: db.adminSessions.filter(
      (s) => s.adminId === admin.id && !s.revokedAt && Date.parse(s.expiresAt) > Date.now(),
    ).length,
  };
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

/** Creates the one superadmin (bootstrap script). Refuses if one already exists. */
export async function bootstrapSuperadmin(
  name: string,
): Promise<{ enrolment: Enrolment; recoveryCodes: string[] }> {
  return mutate((db) => {
    if (db.admins.some((a) => a.role === 'superadmin'))
      throw new UserError('A superadmin already exists.');
    const admin: Admin = {
      id: newId('adm'),
      name,
      email: normalizeEmail(dbEnv.SUPERADMIN_EMAIL),
      role: 'superadmin',
      totpSecretEnc: '',
      totpConfirmed: false,
      enrollExpiresAt: null,
      failedAttempts: 0,
      lockedUntil: null,
      hardLocked: false,
      lastTotpStep: null,
      disabled: false,
      createdBy: null,
      createdAt: now(),
      lastSignInAt: null,
    };
    const enrolment = newEnrolment(admin);
    // The bootstrap QR is scanned at a terminal, so it gets a long window and is confirmed at first sign-in.
    admin.enrollExpiresAt = null;
    db.admins.push(admin);
    const recoveryCodes = Array.from({ length: 10 }, () =>
      randomToken(8).replace(/[-_]/g, 'x').slice(0, 10).toUpperCase(),
    );
    for (const code of recoveryCodes) {
      db.recoveryCodes.push({
        adminId: admin.id,
        codeHash: hashToken(`recovery:${code}`),
        usedAt: null,
      });
    }
    writeAudit(db, { id: admin.id, name }, 'admins.bootstrap', 'admins', admin.id, null);
    return { enrolment, recoveryCodes };
  });
}

export async function createAdmin(
  input: { name: string; email: string; role: AdminRole },
  actor: { id: string; name: string },
): Promise<Enrolment> {
  return mutate((db) => {
    const email = normalizeEmail(input.email);
    if (input.role === 'superadmin') throw new UserError('There is only one superadmin.');
    if (db.admins.some((a) => a.email === email))
      throw new UserError('An admin with that email already exists.');
    const admin: Admin = {
      id: newId('adm'),
      name: input.name.trim().slice(0, 60),
      email,
      role: input.role,
      totpSecretEnc: '',
      totpConfirmed: false,
      enrollExpiresAt: null,
      failedAttempts: 0,
      lockedUntil: null,
      hardLocked: false,
      lastTotpStep: null,
      disabled: false,
      createdBy: actor.id,
      createdAt: now(),
      lastSignInAt: null,
    };
    const enrolment = newEnrolment(admin);
    db.admins.push(admin);
    writeAudit(db, actor, 'admins.create', 'admins', admin.id, `${admin.name} <${email}>`);
    return enrolment;
  });
}

export async function confirmEnrolment(
  adminId: string,
  code: string,
  actor: { id: string; name: string },
): Promise<void> {
  await mutate((db) => {
    const admin = db.admins.find((a) => a.id === adminId);
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
    writeAudit(db, actor, 'admins.confirm', 'admins', adminId, null);
  });
}

export async function resetAuthenticator(
  adminId: string,
  actor: { id: string; name: string },
): Promise<Enrolment> {
  return mutate((db) => {
    const admin = db.admins.find((a) => a.id === adminId);
    if (!admin) throw new UserError('Admin not found.');
    const enrolment = newEnrolment(admin);
    for (const s of db.adminSessions)
      if (s.adminId === adminId && !s.revokedAt) s.revokedAt = now();
    writeAudit(db, actor, 'admins.reset_totp', 'admins', adminId, null);
    return enrolment;
  });
}

export async function setAdminState(
  adminId: string,
  change: 'disable' | 'enable' | 'unlock' | 'revoke_sessions',
  actor: { id: string; name: string },
): Promise<void> {
  await mutate((db) => {
    const admin = db.admins.find((a) => a.id === adminId);
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
    if (change === 'disable' || change === 'revoke_sessions') {
      for (const s of db.adminSessions)
        if (s.adminId === adminId && !s.revokedAt) s.revokedAt = now();
    }
    writeAudit(db, actor, `admins.${change}`, 'admins', adminId, admin.email);
  });
}

export async function listAdmins(): Promise<PublicAdmin[]> {
  const db = await read();
  return db.admins.map((a) => toPublic(db, a));
}

export async function hasSuperadmin(): Promise<boolean> {
  return (await read()).admins.some((a) => a.role === 'superadmin');
}

/* ---------- sign-in ---------- */

const GENERIC = "Couldn't sign you in";

/** Members may only use the games desk. Admins and the superadmin may use both sites. */
export function roleAllowedOn(role: AdminRole, app: SessionApp): boolean {
  return app === 'desk' || role !== 'member';
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
  const email = normalizeEmail(emailInput);
  return mutate((db) => {
    const admin = db.admins.find((a) => a.email === email);
    if (!admin) {
      // Same work as a real check so timing reveals nothing.
      verifyTotp(generateTotpSecret(), code);
      return { ok: false as const, message: GENERIC };
    }
    if (!roleAllowedOn(admin.role, app)) {
      // A member trying the admin portal: same answer as a wrong code, and it is audited.
      verifyTotp(generateTotpSecret(), code);
      writeAudit(
        db,
        { id: admin.id, name: admin.name },
        'auth.wrong_site',
        'admins',
        admin.id,
        app,
      );
      return { ok: false as const, message: GENERIC };
    }
    const lockedSoft = admin.lockedUntil && Date.parse(admin.lockedUntil) > Date.now();
    if (admin.disabled || admin.hardLocked || lockedSoft || !admin.totpSecretEnc) {
      writeAudit(db, { id: admin.id, name: admin.name }, 'auth.blocked', 'admins', admin.id, null);
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
      writeAudit(
        db,
        { id: admin.id, name: admin.name },
        'auth.fail',
        'admins',
        admin.id,
        `attempt ${admin.failedAttempts}`,
      );
      return { ok: false as const, message: GENERIC };
    }
    admin.failedAttempts = 0;
    admin.lockedUntil = null;
    admin.lastTotpStep = step;
    admin.lastSignInAt = now();
    if (!admin.totpConfirmed) admin.totpConfirmed = true;
    const token = randomToken();
    db.adminSessions.push({
      id: newId('ses'),
      adminId: admin.id,
      app,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_ABSOLUTE_MS).toISOString(),
      lastSeenAt: now(),
      revokedAt: null,
      userAgent: userAgent?.slice(0, 200) ?? null,
    });
    writeAudit(db, { id: admin.id, name: admin.name }, 'auth.sign_in', 'admins', admin.id, app);
    return { ok: true as const, token, admin: toPublic(db, admin) };
  });
}

/** Superadmin break-glass: a one-time recovery code unlocks the account and signs in. */
export async function signInWithRecovery(
  emailInput: string,
  code: string,
  userAgent: string | null,
): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  const email = normalizeEmail(emailInput);
  return mutate((db) => {
    const admin = db.admins.find((a) => a.email === email && a.role === 'superadmin');
    const hash = hashToken(`recovery:${code.trim().toUpperCase()}`);
    const rc =
      admin &&
      db.recoveryCodes.find((r) => r.adminId === admin.id && r.codeHash === hash && !r.usedAt);
    if (!admin || !rc) return { ok: false as const, message: GENERIC };
    rc.usedAt = now();
    admin.failedAttempts = 0;
    admin.lockedUntil = null;
    admin.hardLocked = false;
    const token = randomToken();
    db.adminSessions.push({
      id: newId('ses'),
      adminId: admin.id,
      app: 'control',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_ABSOLUTE_MS).toISOString(),
      lastSeenAt: now(),
      revokedAt: null,
      userAgent: userAgent?.slice(0, 200) ?? null,
    });
    writeAudit(db, { id: admin.id, name: admin.name }, 'auth.recovery', 'admins', admin.id, null);
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
  const db = await read();
  const hash = hashToken(token);
  const session = db.adminSessions.find((s) => s.tokenHash === hash);
  if (!session || session.revokedAt || (session.app ?? 'control') !== app) return null;
  const t = Date.now();
  if (Date.parse(session.expiresAt) < t || t - Date.parse(session.lastSeenAt) > SESSION_IDLE_MS)
    return null;
  const admin = db.admins.find((a) => a.id === session.adminId);
  if (!admin || admin.disabled || !roleAllowedOn(admin.role, app)) return null;
  if (t - Date.parse(session.lastSeenAt) > 60_000) {
    await mutate((d) => {
      const s = d.adminSessions.find((x) => x.id === session.id);
      if (s) s.lastSeenAt = now();
    });
  }
  return { admin: toPublic(db, admin), session };
}

export async function signOut(token: string | undefined): Promise<void> {
  if (!token) return;
  const hash = hashToken(token);
  await mutate((db) => {
    const s = db.adminSessions.find((x) => x.tokenHash === hash);
    if (s && !s.revokedAt) s.revokedAt = now();
  });
}

/** Step-up: confirms a fresh code for dangerous actions without creating a session. */
export async function stepUp(adminId: string, code: string): Promise<boolean> {
  return mutate((db) => {
    const admin = db.admins.find((a) => a.id === adminId);
    if (!admin) return false;
    const step = verifyTotp(decrypt(totpKey(), admin.totpSecretEnc), code, {
      lastUsedStep: admin.lastTotpStep,
    });
    if (step == null) return false;
    admin.lastTotpStep = step;
    return true;
  });
}
