// Ember Court — sound: tiny synthesized effects via WebAudio. No audio files,
// no network: every blip is an oscillator. Mute persists in localStorage.
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('ember-court-muted') === '1'; } catch { /* private mode */ }

export function isMuted() { return muted; }

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('ember-court-muted', muted ? '1' : '0'); } catch { /* ignore */ }
  return muted;
}

function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.12, when = 0, slideTo = null) {
  if (muted) return;
  const ac = audioCtx();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  click() { tone(660, 0.06, 'triangle', 0.08); },
  select() { tone(520, 0.07, 'triangle', 0.09); },
  playCard() { tone(392, 0.1, 'triangle', 0.12); tone(523, 0.12, 'triangle', 0.1, 0.07); },
  draw() { tone(880, 0.05, 'sine', 0.05); },
  attack() { tone(220, 0.14, 'sawtooth', 0.1, 0, 110); },
  hit() { tone(160, 0.16, 'square', 0.09, 0, 70); },
  heal() { tone(523, 0.16, 'sine', 0.09); tone(784, 0.2, 'sine', 0.08, 0.1); },
  spell() { tone(740, 0.12, 'sine', 0.1, 0, 1180); tone(1180, 0.16, 'sine', 0.07, 0.08); },
  turn() { tone(440, 0.1, 'triangle', 0.1); tone(587, 0.14, 'triangle', 0.1, 0.09); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.24, 'triangle', 0.12, i * 0.13)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.26, 'triangle', 0.1, i * 0.15)); },
};
