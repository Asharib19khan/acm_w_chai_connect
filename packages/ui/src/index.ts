// Components arrive in phase P1 (design system).
export const BRAND = {
  name: 'Chai Connect',
  org: 'ACM-W',
  campus: 'FAST-NUCES Karachi',
} as const;

/** Palette for places CSS variables can't reach (e.g. viewport themeColor). Mirrors tokens.css. */
export const PALETTE = {
  ink: '#011c27',
  prussian: '#03254e',
  grape: '#545677',
  plum: '#eb9fef',
  petal: '#fecee9',
} as const;
