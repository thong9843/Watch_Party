import { ActionType } from './types';

let audioCtx: AudioContext | null = null;
let muted = false;

export function isMuted(): boolean {
  return muted;
}

export function setMuted(val: boolean): void {
  muted = val;
}

export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const bufferSize = Math.max(1, Math.floor(sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** 🐓 Rooster crow: 4 sawtooth segments: 500->750, 750->620, 650->1000, 1000->520 with vibrato */
export function playCrow(): void {
  if (muted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    osc.type = 'sawtooth';

    // 4 Segments
    // 1: 0 - 0.14s: 500 -> 750
    // 2: 0.14 - 0.32s: 750 -> 620
    // 3: 0.32 - 0.58s: 650 -> 1000
    // 4: 0.58 - 1.25s: 1000 -> 520 with vibrato
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.linearRampToValueAtTime(750, now + 0.14);
    osc.frequency.setValueAtTime(750, now + 0.14);
    osc.frequency.linearRampToValueAtTime(620, now + 0.32);
    osc.frequency.setValueAtTime(650, now + 0.32);
    osc.frequency.linearRampToValueAtTime(1000, now + 0.58);
    osc.frequency.setValueAtTime(1000, now + 0.58);
    osc.frequency.exponentialRampToValueAtTime(520, now + 1.25);

    // Vibrato on final syllable
    lfo.frequency.setValueAtTime(10, now);
    lfoGain.gain.setValueAtTime(0, now);
    lfoGain.gain.setValueAtTime(0, now + 0.58);
    lfoGain.gain.linearRampToValueAtTime(35, now + 0.75);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Master gain
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.setValueAtTime(0.2, now + 1.0);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + 1.3);
    lfo.stop(now + 1.3);
  } catch (err) {
    console.warn('SFX error:', err);
  }
}

/** 📣 Shout: bandpass 900Hz noise + sawtooth 230Hz (~0.9s) */
export function playShout(): void {
  if (muted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = 0.9;

    // Sawtooth base
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(230, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + duration);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.linearRampToValueAtTime(0.15, now + 0.05);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Noise with bandpass 900Hz
    const noiseBuffer = createNoiseBuffer(ctx, duration);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.Q.setValueAtTime(2.5, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.18, now + 0.04);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    noiseSource.start(now);
    osc.stop(now + duration);
    noiseSource.stop(now + duration);
  } catch (err) {
    console.warn('SFX error:', err);
  }
}

/** 🙌 SIUUU: "s" highpass noise 0.18s + triangle 540->400Hz long 1.1s */
export function playSiuu(): void {
  if (muted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. "S" sound: highpass noise 0.18s
    const noiseBuffer = createNoiseBuffer(ctx, 0.2);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const hpFilter = ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.setValueAtTime(3200, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.14, now + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noiseSource.connect(hpFilter);
    hpFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + 0.2);

    // 2. Triangle glide 540 -> 400Hz long 1.1s
    const tri = ctx.createOscillator();
    tri.type = 'triangle';
    const triStart = now + 0.12;
    const triDuration = 1.1;

    tri.frequency.setValueAtTime(540, triStart);
    tri.frequency.exponentialRampToValueAtTime(400, triStart + triDuration);

    const triGain = ctx.createGain();
    triGain.gain.setValueAtTime(0.001, triStart);
    triGain.gain.linearRampToValueAtTime(0.28, triStart + 0.08);
    triGain.gain.setValueAtTime(0.28, triStart + 0.7);
    triGain.gain.exponentialRampToValueAtTime(0.001, triStart + triDuration);

    tri.connect(triGain);
    triGain.connect(ctx.destination);

    tri.start(triStart);
    tri.stop(triStart + triDuration + 0.05);
  } catch (err) {
    console.warn('SFX error:', err);
  }
}

/** 💬 Chat: small pop sound */
export function playPop(): void {
  if (muted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.07);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  } catch (err) {
    console.warn('SFX error:', err);
  }
}

/** 😮💨 Oxygen hiss ("phì" noise lowpass) */
export function playOxygenHiss(): void {
  if (muted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = 1.3;

    const noiseBuffer = createNoiseBuffer(ctx, duration);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const lpFilter = ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.setValueAtTime(800, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(lpFilter);
    lpFilter.connect(gain);
    gain.connect(ctx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + duration);
  } catch (err) {
    console.warn('SFX error:', err);
  }
}

export function playActionSound(action: ActionType): void {
  switch (action) {
    case 'crow':
      playCrow();
      break;
    case 'shout':
      playShout();
      break;
    case 'siuu':
      playSiuu();
      break;
  }
}

