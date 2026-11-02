'use client';

/** The chai pet's moods. Each has its own face, steam and walking speed. */
export type Mood =
  | 'happy'
  | 'excited'
  | 'curious'
  | 'sleepy'
  | 'annoyed'
  | 'love'
  | 'dizzy'
  | 'sad'
  | 'shy'
  | 'proud'
  | 'scared'
  | 'silly';

export interface PetLine {
  text: string;
  mood?: Mood;
}

/** Ask the pet to say something (the narrator in notice-you.tsx decides what and when). */
export function petSay(line: PetLine) {
  dispatchEvent(new CustomEvent<PetLine>('cc:pet-say', { detail: line }));
}

/** Which mood fits each kind of line. */
export const MOOD_FOR: Record<string, Mood> = {
  firstVisit: 'excited',
  secondVisit: 'love',
  thirdVisit: 'love',
  manyVisits: 'love',
  sameDayAgain: 'excited',
  longGap: 'sad',
  lateNight: 'sleepy',
  earlyMorning: 'sleepy',
  nightYawn: 'sleepy',
  countdownTomorrow: 'excited',
  eventDay: 'excited',
  afterEvent: 'sad',
  fastScroll: 'dizzy',
  bottomReached: 'curious',
  backToTop: 'curious',
  idle: 'sleepy',
  returnedToTab: 'happy',
  batteryLow: 'sad',
  offline: 'sad',
  online: 'excited',
  landscape: 'curious',
  darkMode: 'curious',
  copied: 'curious',
  rageTap: 'annoyed',
  menuLover: 'curious',
  pageNotFound: 'annoyed',
  doneAsk: 'excited',
  doneCv: 'excited',
  doneGames: 'excited',
  secretBack: 'curious',
  petted: 'love',
  pettedTooMuch: 'annoyed',
  pickedUp: 'excited',
  thrown: 'dizzy',
  fellOff: 'scared',
  teeter: 'scared',
  mantled: 'proud',
  refillDone: 'proud',
  heroIntro: 'proud',
  shyFirst: 'shy',
  musing: 'curious',
  joke: 'silly',
  scaredLine: 'scared',
  proudLine: 'proud',
  sillyLine: 'silly',
  scrollFling: 'excited',
  wokeUp: 'sleepy',
};
