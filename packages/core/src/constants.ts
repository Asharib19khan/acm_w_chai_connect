/** FAST Karachi programs (blueprint section 4). Editable later from admin settings. */
export const DEPARTMENTS = [
  { code: 'AF', name: 'Accounting & Finance' },
  { code: 'AI', name: 'Artificial Intelligence' },
  { code: 'BA', name: 'Business Analytics' },
  { code: 'BBA', name: 'Business Administration' },
  { code: 'CE', name: 'Computer Engineering' },
  { code: 'CS', name: 'Computer Science' },
  { code: 'CY', name: 'Cyber Security' },
  { code: 'DS', name: 'Data Science' },
  { code: 'EE', name: 'Electrical Engineering' },
  { code: 'FT', name: 'Financial Technology' },
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
    blurb: 'Hiders brief in CS, seekers in EE. Twenty minutes, one arrow, ground floor only.',
  },
  {
    slug: 'scavenger-hunt',
    name: 'Scavenger Hunt',
    category: 'physical',
    teamSize: 3,
    capacity: 90,
    blurb: 'Twenty-five codes across campus, and every team walks its own route.',
  },
  {
    slug: 'campus-impostor',
    name: 'Campus Impostor',
    category: 'physical',
    teamSize: 1,
    capacity: 60,
    blurb: 'Eight crew, two impostors, one meeting bell. Every tag is a phone scan.',
  },
  {
    slug: 'human-bingo',
    name: 'Human Bingo',
    category: 'physical',
    teamSize: 1,
    capacity: null,
    blurb: 'Find someone who has done the thing on your card. Lines fill by meeting people.',
  },
  {
    slug: 'chai-rush',
    name: 'Chai Rush',
    category: 'mini',
    teamSize: 1,
    capacity: null,
    blurb: 'Catch the sugar cubes, dodge the chillies. One minute, best of three.',
  },
  {
    slug: 'fast-type',
    name: 'FAST Type',
    category: 'mini',
    teamSize: 1,
    capacity: null,
    blurb: 'Type the snippet faster than the person next to you.',
  },
  {
    slug: 'memory-match',
    name: 'Memory Match',
    category: 'mini',
    teamSize: 1,
    capacity: null,
    blurb: 'Flip, remember, match. The clock is the only opponent.',
  },
];

export const DEFAULT_MARQUEE = ['ACM-W', 'CHAI CONNECT', 'NOV 25', 'FAST-NUCES KARACHI'];

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
  /** Dev upload chunk; the Cloudflare relay uses 8 MB in production. */
  uploadChunkBytes: 3 * 1024 * 1024,
} as const;
