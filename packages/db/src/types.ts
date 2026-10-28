import type { DepartmentCode, GameCategory, GameStatus } from '@chai/core';

export type ModerationStatus = 'pending_scan' | 'scanned' | 'approved' | 'removed';
export type Flag = 'green' | 'red';

export interface Moderated {
  status: ModerationStatus;
  flag: Flag | null;
  flagReasons: string[];
  flagCategories: string[];
  flagSource: 'rules' | 'claude' | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  removedReason: string | null;
}

export interface Question extends Moderated {
  id: string;
  body: string;
  showName: boolean;
  displayName: string | null;
  deviceHash: string;
  src: string | null;
  answered: boolean;
  spotlightAt: string | null;
  createdAt: string;
}

export interface CvSummary {
  headline: string;
  skills: string[];
}

export interface Cv extends Moderated {
  id: string;
  rollNo: string;
  department: DepartmentCode;
  interests: string[];
  interestNote: string | null;
  consentShare: boolean;
  consentDisplay: boolean;
  /** Dev stand-in for the Drive file id. */
  fileKey: string;
  fileName: string;
  sha256: string;
  sizeBytes: number;
  pageCount: number;
  activeContent: boolean;
  textLength: number;
  summary: CvSummary | null;
  createdAt: string;
}

export interface Moment extends Moderated {
  id: string;
  batchId: string;
  uploaderName: string;
  title: string | null;
  fileName: string;
  mime: string;
  sizeBytes: number;
  md5: string;
  fileKey: string;
  coverKey: string | null;
  uploadState: 'uploading' | 'complete';
  receivedBytes: number;
  deviceHash: string;
  createdAt: string;
}

export interface Game {
  id: string;
  slug: string;
  name: string;
  category: GameCategory;
  status: GameStatus;
  capacity: number | null;
  teamSize: number;
  blurb: string;
  sort: number;
}

export type RegistrationStatus =
  'registered' | 'waitlisted' | 'checked_in' | 'withdrawn' | 'disqualified';

export interface Registration {
  id: string;
  rollNo: string;
  department: DepartmentCode;
  gameId: string;
  category: GameCategory;
  status: RegistrationStatus;
  confirmationCode: string;
  passCodeHash: string;
  team: string | null;
  round: number | null;
  createdAt: string;
  checkedInAt: string | null;
}

export interface ScoreEvent {
  id: string;
  gameId: string;
  registrationId: string;
  points: number;
  reason: string;
  source: 'system' | 'admin';
  adminId: string | null;
  voided: boolean;
  voidReason: string | null;
  createdAt: string;
}

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  body: string;
  options: QuizOption[];
  correctOptionId: string;
  timeLimitS: number;
  points: number;
}

export interface QuizSettings {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  dqOnLeave: boolean;
  offlineSeconds: number;
  revealAfterEnd: boolean;
}

export interface Quiz {
  id: string;
  title: string;
  settings: QuizSettings;
  questions: QuizQuestion[];
  ranAt: string | null;
  createdAt: string;
}

export type QuizPhase = 'locked' | 'open' | 'countdown' | 'live' | 'ended';

export interface QuizControl {
  quizId: string | null;
  phase: QuizPhase;
  startsAt: string | null;
  endedAt: string | null;
  updatedBy: string | null;
}

export interface QuizAnswer {
  questionId: string;
  optionId: string | null;
  correct: boolean;
  points: number;
  ms: number;
}

export interface QuizSession {
  id: string;
  quizId: string;
  rollNo: string;
  department: DepartmentCode;
  deviceHash: string;
  tokenHash: string;
  status: 'active' | 'finished' | 'disqualified';
  dqReason: string | null;
  questionOrder: string[];
  optionOrders: Record<string, string[]>;
  currentIndex: number;
  servedAt: string | null;
  lastHeartbeatAt: string;
  answers: QuizAnswer[];
  score: number;
  correctCount: number;
  correctMs: number;
  joinedAt: string;
}

export type AdminRole = 'superadmin' | 'admin';

export interface Admin {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  totpSecretEnc: string;
  totpConfirmed: boolean;
  enrollExpiresAt: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
  hardLocked: boolean;
  lastTotpStep: number | null;
  disabled: boolean;
  createdBy: string | null;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface AdminSession {
  id: string;
  adminId: string;
  tokenHash: string;
  expiresAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  userAgent: string | null;
}

export interface RecoveryCode {
  adminId: string;
  codeHash: string;
  usedAt: string | null;
}

export interface AuditEntry {
  id: string;
  adminId: string | null;
  adminName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  detail: string | null;
  createdAt: string;
}

export interface Settings {
  marquee: string[];
  announcement: string | null;
  switches: { questions: boolean; cvs: boolean; registration: boolean; moments: boolean };
  companies: string[];
  projectorMode: boolean;
  moderation: boolean;
  cvRetentionDays: number;
}

export interface Db {
  version: 1;
  settings: Settings;
  questions: Question[];
  cvs: Cv[];
  moments: Moment[];
  games: Game[];
  registrations: Registration[];
  scoreEvents: ScoreEvent[];
  quizzes: Quiz[];
  quizControl: QuizControl;
  quizSessions: QuizSession[];
  admins: Admin[];
  adminSessions: AdminSession[];
  recoveryCodes: RecoveryCode[];
  audit: AuditEntry[];
  /** Bumped on every write; screens poll it to know when to refetch. */
  revision: number;
}
