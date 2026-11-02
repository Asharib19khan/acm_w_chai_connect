'use client';

import { useEffect, useState } from 'react';
import { lineFrom } from './notice-you';
import { petSay } from '@/lib/pet-bus';

const karachiHour = () =>
  Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      hour12: false,
    }).format(Date.now()),
  );
const isNight = () => {
  const h = karachiHour();
  return h >= 23 || h < 5;
};

/**
 * The website gets sleepy: from 11 PM to 5 AM Karachi time a warm, dim tint fades over the whole
 * site (like the lights are low), and the pet yawns about it once per visit.
 */
export function NightShade() {
  const [night, setNight] = useState(false);

  useEffect(() => {
    const check = () => setNight(isNight());
    const first = setTimeout(check, 0);
    const id = setInterval(check, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!night) return;
    let said = false;
    try {
      said = sessionStorage.getItem('cc_night_yawn') === '1';
      sessionStorage.setItem('cc_night_yawn', '1');
    } catch {
      // ignore
    }
    if (said) return;
    const id = setTimeout(() => petSay({ text: lineFrom('nightYawn'), mood: 'sleepy' }), 30_000);
    return () => clearTimeout(id);
  }, [night]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[71] transition-opacity duration-[3000ms]"
      style={{
        opacity: night ? 1 : 0,
        background:
          'radial-gradient(ellipse at 50% 30%, rgb(255 170 90 / 0.10), rgb(60 20 40 / 0.28))',
        mixBlendMode: 'multiply',
      }}
    />
  );
}
