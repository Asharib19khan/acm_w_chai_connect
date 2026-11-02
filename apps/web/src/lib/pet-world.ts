'use client';

/** Where the pet's feet are right now (screen px), so the page can react to it (e.g. dots scatter). */
export const petFeet = { x: -9999, y: -9999, kicking: false };

/** What the pet can sense about the wider page (set by other components). */
export const world = { othersReading: 0 };
