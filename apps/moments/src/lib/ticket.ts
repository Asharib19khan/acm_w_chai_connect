import 'server-only';
import { open, seal, serverKey } from './keys';

/*
 * An upload ticket is everything the server needs to continue one upload, sealed with
 * MOMENTS_TICKET_KEY. The phone carries it between requests but can't read or change it, so the
 * Drive session URL stays private and the site needs no database.
 */
export interface Ticket {
  /** Drive resumable session URL. */
  s: string;
  /** Total bytes. */
  z: number;
  /** MD5 the phone computed, hex. */
  m: string;
  /** Device hash of the phone that started it. */
  d: string;
  /** Uploader name, for the cover's details. */
  n: string;
  /** Expiry, ms since epoch. Drive sessions last about a week; we allow a day. */
  e: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function issueTicket(t: Omit<Ticket, 'e'>): string {
  return seal(serverKey('MOMENTS_TICKET_KEY'), { ...t, e: Date.now() + DAY });
}

/** The ticket, if it's genuine, unexpired and belongs to this phone. */
export function readTicket(token: string, deviceHash: string): Ticket | null {
  if (!/^[A-Za-z0-9_-]{40,4000}$/.test(token)) return null;
  const t = open<Ticket>(serverKey('MOMENTS_TICKET_KEY'), token);
  if (!t || t.e < Date.now() || t.d !== deviceHash) return null;
  return t;
}
