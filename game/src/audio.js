// Sound, synthesized live with WebAudio: no audio files, no network, nothing to
// load. Every effect is a short envelope over one or two oscillators (or a noise
// burst for hits), so the whole soundtrack is a few dozen lines. The game creates
// the AudioContext lazily on the first user gesture, which is what browsers
// require; before that, play() is a no-op. M toggles mute, and the choice persists.

import { MUTE_KEY } from './config.js';

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function createAudio() {
  let context = null;
  let muted = readMuted();
  let master = null;

  function ensure() {
    if (context !== null) return context;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      context = new AC();
      master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
    } catch {
      context = null;
    }
    return context;
  }

  /** Resume the context after a user gesture; browsers start it suspended. */
  function unlock() {
    const ctx = ensure();
    if (ctx !== null && ctx.state === 'suspended') ctx.resume().catch(() => {});
    startMusic();
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null || master === null) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, when = 0, lowpass = 1200) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null || master === null) return;
    const t0 = ctx.currentTime + when;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  // ---- The soundboard: one function per game event. ----
  // Each is two or three tones at most, tuned by ear to its meaning: a draw is a
  // quick upward blip, a hit is a noise burst with a low thud, a heal is a soft
  // rising major third, a win is a four-note fanfare.


  // ---- Music: a slow, quiet chord loop, scheduled, not sequenced by hand. ----
  // Four chords (Am, F, C, G in spirit) as soft triangle pads, one chord every
  // two seconds, with a pentatonic note wandering over the top every other bar.
  // It starts on the first user gesture (unlock) and stops when muted; there
  // are no audio files, so the loop costs nothing to load.

  const MUSIC_CHORDS = [
    [220.0, 261.63, 329.63], // A minor
    [174.61, 220.0, 261.63], // F major
    [196.0, 246.94, 293.66], // G major
    [164.81, 220.0, 261.63], // E minor
  ];
  const MUSIC_MELODY = [440.0, 523.25, 659.25, 587.33, 523.25, 440.0, 392.0, 329.63];
  let musicTimer = null;
  let musicStep = 0;
  let musicEnabled = true;

  function setMusicEnabled(enabled) {
    musicEnabled = enabled;
    if (!enabled) stopMusic();
  }

  function startMusic() {
    if (musicTimer !== null || !musicEnabled) return;
    musicTimer = setInterval(() => {
      if (muted) return;
      const ctx = ensure();
      if (ctx === null || ctx.state !== 'running') return;
      const chord = MUSIC_CHORDS[Math.floor(musicStep / 2) % MUSIC_CHORDS.length];
      for (const freq of chord) tone(freq, 1.9, 'triangle', 0.07);
      if (musicStep % 2 === 0) {
        const note = MUSIC_MELODY[(musicStep * 7 + 3) % MUSIC_MELODY.length];
        tone(note, 0.55, 'sine', 0.05, 0.25);
      }
      musicStep += 1;
    }, 1000);
  }

  function stopMusic() {
    if (musicTimer !== null) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    unlock,
    startMusic,
    stopMusic,
    setMusicEnabled,
    isMuted() { return muted; },
    toggleMute() {
      muted = !muted;
      try { window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage off */ }
      return muted;
    },
    click() { tone(660, 0.06, 'sine', 0.5); },
    draw() { tone(520, 0.09, 'triangle', 0.45, 0, 780); },
    playCard() { tone(392, 0.12, 'triangle', 0.55, 0, 523); tone(523, 0.1, 'sine', 0.4, 0.05); },
    summon() { tone(220, 0.16, 'sawtooth', 0.28, 0, 330); tone(330, 0.14, 'triangle', 0.4, 0.06); },
    hit() { noise(0.14, 0.7, 0, 900); tone(140, 0.16, 'sine', 0.6, 0, 70); },
    heroHit() { noise(0.22, 0.8, 0, 700); tone(110, 0.25, 'sine', 0.7, 0, 55); tone(82, 0.3, 'sine', 0.5, 0.05, 40); },
    heal() { tone(523, 0.16, 'sine', 0.45); tone(659, 0.2, 'sine', 0.45, 0.09); },
    combo() { tone(523, 0.1, 'triangle', 0.5); tone(659, 0.1, 'triangle', 0.5, 0.08); tone(784, 0.16, 'triangle', 0.55, 0.16); },
    mana() { tone(880, 0.08, 'sine', 0.35, 0, 1174); },
    turn() { tone(440, 0.1, 'triangle', 0.4); tone(587, 0.12, 'triangle', 0.4, 0.08); },
    error() { tone(180, 0.14, 'square', 0.25, 0, 140); },
    freeze() { tone(1200, 0.2, 'sine', 0.3, 0, 500); tone(900, 0.24, 'sine', 0.25, 0.08, 380); },
    shuffle() { noise(0.12, 0.25, 0, 2000); tone(700, 0.08, 'triangle', 0.3, 0.05, 900); tone(700, 0.08, 'triangle', 0.3, 0.12, 900); },
    crown() {
      tone(523, 0.18, 'triangle', 0.55);
      tone(659, 0.18, 'triangle', 0.55, 0.16);
      tone(784, 0.18, 'triangle', 0.55, 0.32);
      tone(1046, 0.2, 'triangle', 0.6, 0.48);
      tone(1318, 0.5, 'triangle', 0.55, 0.64);
    },
    win() {
      tone(523, 0.16, 'triangle', 0.55);
      tone(659, 0.16, 'triangle', 0.55, 0.14);
      tone(784, 0.16, 'triangle', 0.55, 0.28);
      tone(1046, 0.34, 'triangle', 0.6, 0.42);
    },
    lose() {
      tone(392, 0.22, 'triangle', 0.5, 0, 330);
      tone(330, 0.22, 'triangle', 0.5, 0.2, 262);
      tone(262, 0.42, 'triangle', 0.5, 0.4, 196);
    },
    roundWin() {
      tone(587, 0.14, 'triangle', 0.5);
      tone(784, 0.14, 'triangle', 0.5, 0.12);
      tone(988, 0.26, 'triangle', 0.55, 0.24);
    },
  };
}
