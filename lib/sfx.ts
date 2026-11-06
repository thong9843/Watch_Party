import { ActionType } from './types';
import { localPosRef } from './playerRefs';

let audioCtx: AudioContext | null = null;
let muted = false;

// Concurrency limiter: max 4 action sounds at the same time
let activeActionSounds = 0;
const MAX_CONCURRENT_ACTION_SOUNDS = 4;

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
export function playCrow(volumeScale = 1.0): void {
  if (muted || volumeScale <= 0.02) return;
  if (activeActionSounds >= MAX_CONCURRENT_ACTION_SOUNDS) return;
  activeActionSounds++;
  setTimeout(() => {
    activeActionSounds = Math.max(0, activeActionSounds - 1);
  }, 1350);

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

    // Master gain scaled
    const peakGain = 0.2 * volumeScale;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.05);
    gain.gain.setValueAtTime(peakGain, now + 1.0);
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
export function playShout(volumeScale = 1.0): void {
  if (muted || volumeScale <= 0.02) return;
  if (activeActionSounds >= MAX_CONCURRENT_ACTION_SOUNDS) return;
  activeActionSounds++;
  setTimeout(() => {
    activeActionSounds = Math.max(0, activeActionSounds - 1);
  }, 950);

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
    const peakOscGain = 0.15 * volumeScale;
    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.linearRampToValueAtTime(peakOscGain, now + 0.05);
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
    const peakNoiseGain = 0.18 * volumeScale;
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(peakNoiseGain, now + 0.04);
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
export function playSiuu(volumeScale = 1.0): void {
  if (muted || volumeScale <= 0.02) return;
  if (activeActionSounds >= MAX_CONCURRENT_ACTION_SOUNDS) return;
  activeActionSounds++;
  setTimeout(() => {
    activeActionSounds = Math.max(0, activeActionSounds - 1);
  }, 1300);

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
    const peakNoiseGain = 0.14 * volumeScale;
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(peakNoiseGain, now + 0.02);
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
    const peakTriGain = 0.28 * volumeScale;
    triGain.gain.setValueAtTime(0.001, triStart);
    triGain.gain.linearRampToValueAtTime(peakTriGain, triStart + 0.08);
    triGain.gain.setValueAtTime(peakTriGain, triStart + 0.7);
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
export function playOxygenHiss(sourcePos?: { x: number; z: number }): void {
  if (muted) return;
  let volumeScale = 1.0;
  if (sourcePos) {
    const dx = sourcePos.x - localPosRef.x;
    const dz = sourcePos.z - localPosRef.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 20) {
      volumeScale = 1 / (1 + (dist - 20) * 0.1);
    }
  }
  if (volumeScale <= 0.02) return;

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
    const peakGain = 0.2 * volumeScale;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.15);
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

/** 🌬️ Oxygen Inhale: soothing high-frequency oxygen hiss rising over 0.8s */
export function playOxygenInhale(sourcePos?: { x: number; z: number }): void {
  if (muted) return;
  let volumeScale = 1.0;
  if (sourcePos) {
    const dx = sourcePos.x - localPosRef.x;
    const dz = sourcePos.z - localPosRef.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 15) {
      volumeScale = 1 / (1 + (dist - 15) * 0.12);
    }
  }
  if (volumeScale <= 0.02) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = 0.78;

    const noiseBuffer = createNoiseBuffer(ctx, duration);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const bpFilter = ctx.createBiquadFilter();
    bpFilter.type = 'bandpass';
    bpFilter.Q.setValueAtTime(3.0, now);
    bpFilter.frequency.setValueAtTime(1400, now);
    bpFilter.frequency.exponentialRampToValueAtTime(2400, now + duration);

    const gain = ctx.createGain();
    const peakGain = 0.18 * volumeScale;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + duration * 0.85);
    gain.gain.linearRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(bpFilter);
    bpFilter.connect(gain);
    gain.connect(ctx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + duration);
  } catch (err) {
    console.warn('SFX error:', err);
  }
}

/** 💨 Oxygen Exhale: gentle low-frequency exhalation hiss through valve over 0.8s */
export function playOxygenExhale(sourcePos?: { x: number; z: number }): void {
  if (muted) return;
  let volumeScale = 1.0;
  if (sourcePos) {
    const dx = sourcePos.x - localPosRef.x;
    const dz = sourcePos.z - localPosRef.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 15) {
      volumeScale = 1 / (1 + (dist - 15) * 0.12);
    }
  }
  if (volumeScale <= 0.02) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = 0.78;

    const noiseBuffer = createNoiseBuffer(ctx, duration);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const lpFilter = ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.setValueAtTime(850, now);
    lpFilter.frequency.exponentialRampToValueAtTime(380, now + duration);

    const gain = ctx.createGain();
    const peakGain = 0.16 * volumeScale;
    gain.gain.setValueAtTime(peakGain, now);
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

export function playActionSound(action: ActionType, sourcePos?: { x: number; z: number }): void {
  let volumeScale = 1.0;
  if (sourcePos) {
    const dx = sourcePos.x - localPosRef.x;
    const dz = sourcePos.z - localPosRef.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 20) {
      volumeScale = 1 / (1 + (dist - 20) * 0.1);
    }
  }
  if (volumeScale <= 0.02) return;

  switch (action) {
    case 'crow':
      playCrow(volumeScale);
      break;
    case 'shout':
      playShout(volumeScale);
      break;
    case 'siuu':
      playSiuu(volumeScale);
      break;
  }
}

