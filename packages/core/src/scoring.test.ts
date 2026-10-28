import { describe, expect, it } from 'vitest';
import { bingoScore, catchValue, hiderScore, huntScore, quizPoints, rankQuiz } from './scoring';

describe('quizPoints', () => {
  it('pays full points for an instant right answer', () =>
    expect(quizPoints(true, 1000, 0, 15000)).toBe(1000));
  it('pays half at the buzzer', () => expect(quizPoints(true, 1000, 15000, 15000)).toBe(500));
  it('pays nothing when wrong', () => expect(quizPoints(false, 1000, 10, 15000)).toBe(0));
  it('clamps late answers to half', () => expect(quizPoints(true, 1000, 99999, 15000)).toBe(500));
  it('is linear in between', () => expect(quizPoints(true, 1000, 7500, 15000)).toBe(750));
});

describe('rankQuiz', () => {
  it('breaks ties by correct count, then time, then join order', () => {
    const ranked = rankQuiz([
      { id: 'a', score: 900, correctCount: 1, correctMs: 100, joinedAt: '2026-11-25T10:00:00Z' },
      { id: 'b', score: 900, correctCount: 2, correctMs: 900, joinedAt: '2026-11-25T10:00:00Z' },
      { id: 'c', score: 900, correctCount: 2, correctMs: 500, joinedAt: '2026-11-25T10:00:05Z' },
      { id: 'd', score: 900, correctCount: 2, correctMs: 500, joinedAt: '2026-11-25T10:00:01Z' },
      { id: 'e', score: 1200, correctCount: 1, correctMs: 999, joinedAt: '2026-11-25T10:00:09Z' },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(['e', 'd', 'c', 'b', 'a']);
    expect(ranked[0]?.rank).toBe(1);
  });
});

describe('game scoring', () => {
  it('caps a hider at 125', () => expect(hiderScore(20, true)).toBe(125));
  it('values a catch at 60 to 20, halved when converted', () => {
    expect(catchValue(0, false)).toBe(60);
    expect(catchValue(20, false)).toBe(20);
    expect(catchValue(0, true)).toBe(30);
  });
  it('adds the hunt bonus for all 25', () => expect(huntScore(25, 2, 1)).toBe(250 + 10 + 50 - 3));
  it('caps bingo confirmations at 15', () => expect(bingoScore(0, 0, false, 40)).toBe(30));
});
