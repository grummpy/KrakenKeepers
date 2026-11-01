// All sound is synthesized. Nothing is fetched.

const MELODY = [
  220, 261.63, 293.66, 261.63,
  329.63, 293.66, 261.63, 196,
  174.61, 220, 261.63, 220,
  293.66, 246.94, 220, 174.61,
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let noise = null;
  let volume = 0.7;
  let muted = false;
  let musicOn = false;
  let nextNoteAt = 0;
  let noteIndex = 0;
  let armed = false;

  function outputGain() {
    return muted ? 0 : volume;
  }

  function ensure() {
    if (!armed) return null;
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      ctx = new AudioCtx();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = outputGain();
    master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.4);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function tone(freq, dur, type, gain, delay = 0) {
    const audio = ensure();
    if (!audio || muted || gain <= 0) return;
    const t = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp);
    amp.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function burst(dur, gain, freq = 800) {
    const audio = ensure();
    if (!audio || !noise || muted) return;
    const t = audio.currentTime;
    const src = audio.createBufferSource();
    src.buffer = noise;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const amp = audio.createGain();
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    src.start(t);
    src.stop(t + dur);
  }

  function playEvents(events) {
    if (!events || muted) return;
    for (const event of events) {
      if (event.type === 'fire') {
        burst(0.12, 0.18, 420);
        tone(140, 0.08, 'square', 0.05);
      } else if (event.type === 'hit') {
        burst(0.08, 0.1, 900);
      } else if (event.type === 'pickup') {
        tone(event.kind === 'power' ? 523 : 660, 0.09, 'square', 0.06);
        tone(event.kind === 'power' ? 784 : 880, 0.12, 'square', 0.05, 0.07);
      } else if (event.type === 'sink') {
        tone(220, 0.28, 'sawtooth', 0.07);
        tone(110, 0.4, 'triangle', 0.06, 0.05);
        burst(0.25, 0.16, 200);
      } else if (event.type === 'kraken') {
        tone(55, 0.45, 'sawtooth', 0.08);
        burst(0.35, 0.2, 120);
      } else if (event.type === 'kraken-warn') {
        tone(98, 0.18, 'triangle', 0.04);
      } else if (event.type === 'countdown') {
        tone(event.value === 0 ? 660 : 440, event.value === 0 ? 0.2 : 0.1, 'square', 0.06);
      } else if (event.type === 'round' || event.type === 'match') {
        [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.18, 'square', 0.05, i * 0.1));
      }
    }
  }

  return {
    unlock() {
      armed = true;
      return ensure();
    },
    setVolume(value) {
      volume = Math.max(0, Math.min(1, value));
      if (master) master.gain.value = outputGain();
    },
    setMuted(value) {
      muted = !!value;
      if (master) master.gain.value = outputGain();
      return muted;
    },
    toggleMute() {
      return this.setMuted(!muted);
    },
    isMuted() {
      return muted;
    },
    playEvents,
    updateMusic(active) {
      musicOn = !!active;
      if (!musicOn || !armed) {
        nextNoteAt = 0;
        return;
      }
      const audio = ensure();
      if (!audio || muted) return;
      const now = audio.currentTime;
      if (nextNoteAt === 0) nextNoteAt = now + 0.05;
      if (now < nextNoteAt) return;
      const freq = MELODY[noteIndex % MELODY.length];
      tone(freq, 0.2, 'square', 0.035);
      tone(freq / 2, 0.22, 'triangle', 0.03);
      noteIndex += 1;
      nextNoteAt = now + 0.28;
    },
  };
}
