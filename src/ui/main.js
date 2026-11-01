import { createMatch, skipBanner, step } from '../core/game.js';
import {
  BINDING_FIELDS,
  defaultBindings,
  readPlayerControl,
  sanitizeBindings,
} from '../core/input.js';
import { createAudio } from './audio.js';
import { render } from './render.js';

const SETTINGS_KEY = 'krakenkeepers.settings';
const BINDINGS_KEY = 'krakenkeepers.bindings';
const STEP_MS = 1000 / 60;
const MAX_STEPS = 8;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const audio = createAudio();
const cover = new Image();
cover.src = 'assets/cover.jpg';
const icon = new Image();
icon.src = 'assets/icon.jpg';

const held = new Set();
const edges = new Set();
const prevPad = [null, null, null, null];

const ui = {
  screen: 'title',
  slots: ['open', 'open', 'open', 'open'],
  settings: loadSettings(),
  bindings: loadBindings(),
  game: null,
  activeSlots: null,
  paused: false,
  pauseIndex: 0,
  optionIndex: 0,
  controlIndex: 0,
  capturing: false,
  captureLabel: '',
  optionsFrom: 'title',
  controlsFrom: 'title',
  pads: [false, false, false, false],
  padEdges: [],
  padList: [null, null, null, null],
  message: '',
  messageUntil: 0,
  particles: [],
  slams: [],
  shake: 0,
  acc: 0,
  last: performance.now(),
};

audio.setVolume(ui.settings.volume);
audio.setMuted(ui.settings.muted);

function loadSettings() {
  const base = { volume: 0.7, muted: false, roundCount: 3, fillBots: true };
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return base;
    const volume = Number(raw.volume);
    return {
      volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : base.volume,
      muted: !!raw.muted,
      roundCount: [1, 3, 5].includes(raw.roundCount) ? raw.roundCount : 3,
      fillBots: raw.fillBots !== false,
    };
  } catch {
    return base;
  }
}

function loadBindings() {
  try {
    return sanitizeBindings(JSON.parse(localStorage.getItem(BINDINGS_KEY) || 'null'));
  } catch {
    return defaultBindings();
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(ui.settings));
  } catch {
    // Private mode and full disks should not sink the match.
  }
}

function saveBindings() {
  try {
    localStorage.setItem(BINDINGS_KEY, JSON.stringify(ui.bindings));
  } catch {
    // Same as settings: play continues with the bindings in memory.
  }
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(640, Math.floor(window.innerWidth * dpr));
  canvas.height = Math.max(360, Math.floor(window.innerHeight * dpr));
}

function flash(message) {
  ui.message = message;
  ui.messageUntil = performance.now() + 1800;
}

function buttonDown(buttons, index) {
  const button = buttons?.[index];
  if (!button) return false;
  return !!(button.pressed || button.value > 0.5);
}

function pollPads() {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  ui.padEdges = [];
  for (let i = 0; i < 4; i++) {
    const pad = list?.[i];
    const connected = !!(pad && pad.connected);
    ui.pads[i] = connected;
    ui.padList[i] = connected ? pad : null;
    const prev = prevPad[i] || { buttons: [], stick: {} };
    const edge = {
      a: false, b: false, start: false, up: false, down: false, left: false, right: false,
    };
    if (connected) {
      edge.a = buttonDown(pad.buttons, 0) && !prev.buttons[0];
      edge.b = buttonDown(pad.buttons, 1) && !prev.buttons[1];
      edge.start = buttonDown(pad.buttons, 9) && !prev.buttons[9];
      const up = buttonDown(pad.buttons, 12) || (pad.axes?.[1] || 0) < -0.55;
      const down = buttonDown(pad.buttons, 13) || (pad.axes?.[1] || 0) > 0.55;
      const left = buttonDown(pad.buttons, 14) || (pad.axes?.[0] || 0) < -0.55;
      const right = buttonDown(pad.buttons, 15) || (pad.axes?.[0] || 0) > 0.55;
      edge.up = up && !prev.stick.up;
      edge.down = down && !prev.stick.down;
      edge.left = left && !prev.stick.left;
      edge.right = right && !prev.stick.right;
      prevPad[i] = {
        buttons: [0, 1, 9].reduce((map, index) => {
          map[index] = buttonDown(pad.buttons, index);
          return map;
        }, {}),
        stick: { up, down, left, right },
      };
      prevPad[i].buttons[12] = buttonDown(pad.buttons, 12);
      prevPad[i].buttons[13] = buttonDown(pad.buttons, 13);
      prevPad[i].buttons[14] = buttonDown(pad.buttons, 14);
      prevPad[i].buttons[15] = buttonDown(pad.buttons, 15);
    } else {
      prevPad[i] = { buttons: [], stick: {} };
    }
    ui.padEdges[i] = edge;
  }
}

function anyPad(field) {
  return ui.padEdges.some((edge) => edge && edge[field]);
}

function menuUp() {
  return edges.has('ArrowUp') || edges.has('KeyW') || anyPad('up');
}

function menuDown() {
  return edges.has('ArrowDown') || edges.has('KeyS') || anyPad('down');
}

function menuLeft() {
  return edges.has('ArrowLeft') || edges.has('KeyA') || anyPad('left');
}

function menuRight() {
  return edges.has('ArrowRight') || edges.has('KeyD') || anyPad('right');
}

function confirmKey() {
  return edges.has('Enter') || edges.has('NumpadEnter') || edges.has('Space') || anyPad('a');
}

function resolvedSlots() {
  return ui.slots.map((slot) => {
    if (slot === 'human' || slot === 'bot' || slot === 'off') return slot;
    return ui.settings.fillBots ? 'bot' : 'off';
  });
}

function startMatch(slots = resolvedSlots()) {
  if (!slots.some((slot) => slot === 'human' || slot === 'bot')) {
    flash('At least one ship has to leave the dock.');
    return;
  }
  ui.activeSlots = slots;
  ui.game = createMatch({
    seed: (Date.now() ^ (Math.random() * 0x100000000)) >>> 0 || 1,
    roundCount: ui.settings.roundCount,
    slots,
  });
  ui.paused = false;
  ui.screen = 'play';
  ui.particles = [];
  ui.slams = [];
  ui.shake = 0;
  ui.acc = 0;
  audio.unlock();
}

function goTitle() {
  ui.screen = 'title';
  ui.game = null;
  ui.paused = false;
  ui.capturing = false;
}

function cycleSlot(index) {
  const order = { open: 'bot', bot: 'off', off: 'open', human: 'open' };
  ui.slots[index] = order[ui.slots[index]] || 'open';
}

function spawnBurst(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const vel = speed * (0.35 + Math.random());
    ui.particles.push({
      x, y,
      vx: Math.cos(angle) * vel,
      vy: Math.sin(angle) * vel,
      life: 0.35 + Math.random() * 0.3,
      max: 0.65,
      color,
      r: 2 + Math.random() * 2.5,
    });
  }
  if (ui.particles.length > 220) ui.particles.splice(0, ui.particles.length - 220);
}

function absorbEvents(events) {
  for (const event of events) {
    if (event.type === 'fire') spawnBurst(event.x, event.y, '#ffd7a1', 6, 80);
    else if (event.type === 'hit') spawnBurst(event.x, event.y, '#fff1c4', 5, 70);
    else if (event.type === 'sink') spawnBurst(event.x, event.y, '#ff8d8d', 16, 120);
    else if (event.type === 'pickup') spawnBurst(event.x, event.y, '#ffd15c', 8, 60);
    else if (event.type === 'kraken') {
      ui.slams.push({ x: event.x, y: event.y, life: 1 });
      ui.shake = Math.max(ui.shake, 14);
      spawnBurst(event.x, event.y, '#c9a6ff', 20, 140);
    }
  }
}

function updateFx(dt) {
  ui.shake = Math.max(0, ui.shake - dt * 28);
  for (const particle of ui.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  }
  ui.particles = ui.particles.filter((particle) => particle.life > 0);
  for (const slam of ui.slams) slam.life -= dt * 1.4;
  ui.slams = ui.slams.filter((slam) => slam.life > 0);
}

function buildInputs() {
  return [0, 1, 2, 3].map((index) => {
    const ship = ui.game.ships[index];
    if (!ship || ship.kind !== 'human') return null;
    return readPlayerControl({
      keysDown: held,
      binding: ui.bindings[index],
      pad: ui.padList[index],
      padConnected: ui.pads[index],
    });
  });
}

function adjustOption(dir) {
  const settings = ui.settings;
  if (ui.optionIndex === 0) {
    settings.volume = Math.max(0, Math.min(1, Math.round((settings.volume + dir * 0.1) * 10) / 10));
    audio.setVolume(settings.volume);
  } else if (ui.optionIndex === 1) {
    const choices = [1, 3, 5];
    const at = choices.indexOf(settings.roundCount);
    settings.roundCount = choices[(at + dir + choices.length) % choices.length];
  } else if (ui.optionIndex === 2) {
    settings.fillBots = !settings.fillBots;
  }
  saveSettings();
}

function activateOption() {
  if (ui.optionIndex === 3) {
    ui.controlsFrom = 'options';
    ui.screen = 'controls';
    ui.capturing = false;
    return;
  }
  if (ui.optionIndex === 4) backFromOptions();
}

function backFromOptions() {
  ui.screen = ui.optionsFrom === 'pause' ? 'play' : 'title';
  if (ui.optionsFrom === 'pause') ui.paused = true;
}

function activatePause() {
  if (ui.pauseIndex === 0) ui.paused = false;
  else if (ui.pauseIndex === 1) {
    ui.paused = false;
    ui.optionsFrom = 'pause';
    ui.optionIndex = 0;
    ui.screen = 'options';
  } else {
    goTitle();
  }
}

function handleInput() {
  if (ui.capturing) return;
  if (ui.screen === 'title') {
    if (edges.has('KeyC')) {
      ui.controlsFrom = 'title';
      ui.screen = 'controls';
      return;
    }
    if (edges.has('KeyO')) {
      ui.optionsFrom = 'title';
      ui.optionIndex = 0;
      ui.screen = 'options';
      return;
    }
    const action = [0, 1, 2, 3].some((index) => edges.has(ui.bindings[index].action));
    if (confirmKey() || anyPad('start') || action) {
      ui.screen = 'join';
      audio.unlock();
    }
    return;
  }

  if (ui.screen === 'join') {
    if (edges.has('Escape')) {
      goTitle();
      return;
    }
    if (edges.has('KeyB')) {
      ui.settings.fillBots = !ui.settings.fillBots;
      saveSettings();
    }
    for (let i = 0; i < 4; i++) {
      if (edges.has(ui.bindings[i].action) || ui.padEdges[i]?.a) ui.slots[i] = 'human';
      else if (edges.has(ui.bindings[i].secondary) || ui.padEdges[i]?.b) cycleSlot(i);
    }
    // Numpad Enter is P4's secondary, so it cycles that slot instead of starting.
    if (edges.has('Enter') || edges.has('Space') || anyPad('start')) startMatch();
    return;
  }

  if (ui.screen === 'options') {
    if (edges.has('Escape') || anyPad('b')) {
      backFromOptions();
      return;
    }
    if (menuUp()) ui.optionIndex = (ui.optionIndex + 4) % 5;
    if (menuDown()) ui.optionIndex = (ui.optionIndex + 1) % 5;
    if (menuLeft()) adjustOption(-1);
    if (menuRight()) adjustOption(1);
    if (edges.has('Enter') || edges.has('NumpadEnter') || edges.has('Space') || anyPad('a') || anyPad('start')) {
      activateOption();
    }
    return;
  }

  if (ui.screen === 'controls') {
    if (edges.has('Escape') || anyPad('b')) {
      ui.screen = ui.controlsFrom === 'options' ? 'options' : 'title';
      return;
    }
    if (menuUp() || anyPad('up')) ui.controlIndex = (ui.controlIndex + 23) % 24;
    if (menuDown() || anyPad('down')) ui.controlIndex = (ui.controlIndex + 1) % 24;
    if (edges.has('Backspace') || edges.has('Delete')) {
      ui.bindings = defaultBindings();
      saveBindings();
      flash('Bindings restored.');
    }
    if (edges.has('Enter') || edges.has('NumpadEnter') || edges.has('Space') || anyPad('a')) {
      const player = Math.floor(ui.controlIndex / 6);
      const field = BINDING_FIELDS[ui.controlIndex % 6];
      ui.capturing = true;
      ui.captureLabel = `${['P1', 'P2', 'P3', 'P4'][player]} ${field[1]}`;
    }
    return;
  }

  if (ui.screen === 'play' && ui.game) handlePlay();
}

function handlePlay() {
  const matchOver = ui.game.phase === 'matchEnd';
  if (matchOver) {
    if (edges.has('Enter') || edges.has('NumpadEnter') || edges.has('Space') || anyPad('a') || anyPad('start')) {
      startMatch(ui.activeSlots);
    } else if (edges.has('Escape') || anyPad('b')) {
      goTitle();
    }
    return;
  }
  if (!ui.paused && (edges.has('Escape') || anyPad('start'))) {
    ui.paused = true;
    ui.pauseIndex = 0;
    return;
  }
  if (!ui.paused && ui.game.phase === 'roundEnd' && (edges.has('Enter') || edges.has('Space') || edges.has('NumpadEnter'))) {
    skipBanner(ui.game);
    return;
  }
  if (!ui.paused) return;
  if (menuUp()) ui.pauseIndex = (ui.pauseIndex + 2) % 3;
  if (menuDown()) ui.pauseIndex = (ui.pauseIndex + 1) % 3;
  if (edges.has('Escape') || anyPad('b') || anyPad('start')) {
    ui.paused = false;
    return;
  }
  if (edges.has('Enter') || edges.has('NumpadEnter') || edges.has('Space') || anyPad('a')) activatePause();
}

function assignBinding(code) {
  const player = Math.floor(ui.controlIndex / 6);
  const field = BINDING_FIELDS[ui.controlIndex % 6][0];
  const binding = ui.bindings[player];
  for (const [name] of BINDING_FIELDS) {
    if (binding[name] === code) binding[name] = '';
  }
  binding[field] = code;
  saveBindings();
}

window.addEventListener('keydown', (event) => {
  if (!['F5', 'F11', 'F12'].includes(event.code)) event.preventDefault();
  audio.unlock();
  if (ui.capturing) {
    if (event.repeat) return;
    if (event.code === 'Escape') {
      ui.capturing = false;
      return;
    }
    if (event.code === 'KeyM') return;
    assignBinding(event.code);
    ui.capturing = false;
    return;
  }
  if (event.repeat) return;
  if (!held.has(event.code)) edges.add(event.code);
  held.add(event.code);
  if (event.code === 'KeyM') {
    ui.settings.muted = audio.toggleMute();
    saveSettings();
  }
});

window.addEventListener('keyup', (event) => {
  held.delete(event.code);
});

window.addEventListener('pointerdown', () => {
  audio.unlock();
  if (ui.screen === 'title') ui.screen = 'join';
});

window.addEventListener('resize', resize);
window.addEventListener('blur', () => {
  held.clear();
  if (ui.screen === 'play' && ui.game && ui.game.phase !== 'matchEnd') ui.paused = true;
});

resize();

function frame(now) {
  const elapsed = Math.min(80, now - ui.last);
  ui.last = now;
  pollPads();
  handleInput();
  const events = [];
  if (ui.screen === 'play' && ui.game && !ui.paused) {
    ui.acc += elapsed;
    let steps = 0;
    while (ui.acc >= STEP_MS && steps < MAX_STEPS) {
      step(ui.game, buildInputs());
      events.push(...ui.game.events);
      ui.acc -= STEP_MS;
      steps += 1;
    }
    if (steps === MAX_STEPS) ui.acc = 0;
  } else {
    ui.acc = 0;
  }
  if (events.length) {
    audio.playEvents(events);
    absorbEvents(events);
  }
  updateFx(elapsed / 1000);
  const music = ui.screen !== 'play' || (ui.game && ui.game.phase !== 'matchEnd');
  audio.updateMusic(music && !ui.settings.muted);
  const message = now < ui.messageUntil ? ui.message : '';
  render(ctx, {
    w: canvas.width,
    h: canvas.height,
    screen: ui.screen,
    time: now,
    cover,
    icon,
    game: ui.game,
    paused: ui.paused,
    pauseIndex: ui.pauseIndex,
    slots: ui.slots,
    fillBots: ui.settings.fillBots,
    bindings: ui.bindings,
    settings: ui.settings,
    pads: ui.pads,
    optionIndex: ui.optionIndex,
    controlIndex: ui.controlIndex,
    capturing: ui.capturing,
    captureLabel: ui.captureLabel,
    message,
    particles: ui.particles,
    slams: ui.slams,
    shake: ui.shake,
    muted: ui.settings.muted || audio.isMuted(),
  });
  edges.clear();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
