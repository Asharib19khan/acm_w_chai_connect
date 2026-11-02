'use client';

/*
 * Tiny synthesised sound kit (Web Audio, no files to download). Browsers only allow sound after the
 * first tap, so the audio context is created on the first pointer press and sounds before that are
 * silently skipped. There is deliberately no mute toggle; the phone's own volume decides.
 */
export type SoundName = 'tick' | 'whoosh' | 'pop' | 'open' | 'boom' | 'shimmer' | 'success';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function unlockSound() {
  if (ctx || typeof window === 'undefined') return;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.32;
  master.connect(ctx.destination);
}

function tone(freq: number, end: number, dur: number, type: OscillatorType, vol: number, at = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, from: number, to: number, vol: number, at = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + at;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.4;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t);
}

export function playSound(name: SoundName) {
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  switch (name) {
    case 'tick':
      tone(1900, 1200, 0.045, 'square', 0.12);
      break;
    case 'pop':
      tone(520, 1400, 0.12, 'sine', 0.35);
      break;
    case 'whoosh':
      noise(0.45, 400, 3200, 0.5);
      break;
    case 'open':
      noise(0.35, 2600, 500, 0.4);
      tone(180, 90, 0.25, 'sine', 0.35);
      break;
    case 'boom':
      tone(120, 38, 0.6, 'sine', 0.8);
      noise(0.5, 900, 120, 0.45);
      break;
    case 'shimmer':
      [880, 1175, 1480, 1760, 2350].forEach((f, i) =>
        tone(f, f * 1.01, 0.5, 'triangle', 0.12, i * 0.06),
      );
      break;
    case 'success':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.22, 'square', 0.1, i * 0.08));
      break;
  }
}
