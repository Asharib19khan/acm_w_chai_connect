/** FAST Karachi programs (blueprint section 4). Editable later from admin settings. */
export const DEPARTMENTS = [
  { code: 'FT', name: 'Financial Technology' },
  { code: 'AF', name: 'Accounting & Finance' },
  { code: 'AI', name: 'Artificial Intelligence' },
  { code: 'BA', name: 'Business Analytics' },
  { code: 'BBA', name: 'Business Administration' },
  { code: 'CE', name: 'Computer Engineering' },
  { code: 'CS', name: 'Computer Science' },
  { code: 'CY', name: 'Cyber Security' },
  { code: 'DS', name: 'Data Science' },
  { code: 'EE', name: 'Electrical Engineering' },
  { code: 'SE', name: 'Software Engineering' },
  { code: 'GRAD', name: 'Graduate (MS / PhD)' },
] as const;

export type DepartmentCode = (typeof DEPARTMENTS)[number]['code'];
export const DEPARTMENT_CODES = DEPARTMENTS.map((d) => d.code) as [
  DepartmentCode,
  ...DepartmentCode[],
];

export type GameCategory = 'physical' | 'mini';
export type GameStatus = 'open' | 'closed' | 'live' | 'ended';

export interface GameSeed {
  slug: string;
  name: string;
  category: GameCategory;
  teamSize: number;
  capacity: number | null;
  blurb: string;
}

/** Blueprint section 13. Adding a minigame later is one entry here (and one row in the database). */
export const GAME_SEEDS: GameSeed[] = [
  {
    slug: 'hide-and-seek',
    name: 'Hide & Seek',
    category: 'physical',
    teamSize: 1,
    capacity: 80,
    blurb: 'Teams of five, two rounds of fifteen minutes: hide once, seek once. Your phone is the radar.',
  },
  {
    // Played on a game-station laptop; the game talks to the games desk API (amendment A8).
    slug: 'skill-issues',
    name: 'Skill Issues',
    category: 'mini',
    teamSize: 1,
    capacity: null,
    blurb:
      'A hammer, a pot and a mountain. One timed climb at the game station, one turn each. Based on Getting Over It by Bennett Foddy.',
  },
  {
    // Racing station (Game.exe kiosk). Score = metres driven in the timed run.
    slug: 'donda',
    name: 'DONDA',
    category: 'mini',
    teamSize: 1,
    capacity: null,
    blurb: 'A random car, a random track, one timed run. Drive as far as you can. One turn each.',
  },
];

/** Most points one station round may send. DONDA sends metres driven, so it needs more room. */
export const STATION_MAX_POINTS: Record<string, number> = { donda: 100_000 };
export const STATION_DEFAULT_MAX_POINTS = 1000;

export const DEFAULT_MARQUEE = ['ACM-W', 'CHAI CONNECT', 'NOV 27', 'FAST-NUCES KARACHI'];

/** Placeholder list until the VP sends the real companies (blueprint section 20). */
export const DEFAULT_COMPANIES = [
  'Software engineering',
  'Data & AI',
  'Cyber security',
  'Product & design',
  'Finance & fintech',
  'Research',
];

export const LIMITS = {
  questionMin: 10,
  questionMax: 300,
  nameMin: 2,
  nameMax: 40,
  cvMaxBytes: 4 * 1024 * 1024,
  cvMaxPages: 3,
  interestNoteMax: 200,
  momentTitleMax: 60,
  /** One photo or video. Full-quality phone video runs ~400 MB a minute in 4K. */
  momentMaxBytes: 2 * 1024 ** 3,
  /** Dev upload chunk; the Cloudflare relay uses 8 MB in production. */
  uploadChunkBytes: 3 * 1024 * 1024,
} as const;
