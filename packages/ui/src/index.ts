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

export { cn } from './cn';
export { AnimatedNumber } from './animated-number';
export { Button, ButtonLink, buttonClass, Spinner } from './button';
export { ChaiCup, Wordmark } from './chai-cup';
export { CodeInput } from './code-input';
export { Checkbox, ChoiceChip, Field, Input, Select, Switch, Textarea } from './fields';
export { Marquee, Star } from './marquee';
export { Drawer, Modal } from './overlay';
export { QrCode } from './qr';
export { EmptyState, ErrorState, LiveDot, Skeleton } from './states';
export { ToastProvider, useToast } from './toast';
