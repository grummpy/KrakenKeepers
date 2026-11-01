// Pure input mapping. Keyboard state is a Set of KeyboardEvent.code values
// or a plain object keyed by code. A connected gamepad replaces that
// player's keyboard for ship control.

export const BINDING_FIELDS = [
  ['up', 'Forward'],
  ['down', 'Reverse'],
  ['left', 'Port turn'],
  ['right', 'Starboard turn'],
  ['action', 'Port cannons'],
  ['secondary', 'Starboard cannons'],
];

export const IDLE_INPUT = Object.freeze({
  thrust: 0,
  turn: 0,
  fireLeft: false,
  fireRight: false,
  pause: false,
});

const DEADZONE = 0.2;

export function defaultBindings() {
  return [
    { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', action: 'KeyF', secondary: 'KeyG' },
    { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', action: 'Slash', secondary: 'Period' },
    { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', action: 'Semicolon', secondary: 'Quote' },
    { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', action: 'Numpad0', secondary: 'NumpadEnter' },
  ];
}

export function keyLabel(code) {
  if (!code) return '—';
  const named = {
    Slash: '/',
    Period: '.',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Minus: '-',
    Equal: '=',
    Space: 'Space',
    Enter: 'Enter',
    NumpadEnter: 'Num Enter',
    NumpadAdd: 'Num +',
    NumpadSubtract: 'Num -',
    NumpadMultiply: 'Num *',
    NumpadDivide: 'Num /',
    NumpadDecimal: 'Num .',
  };
  if (named[code]) return named[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  if (code.startsWith('Arrow')) return code.slice(5);
  return code;
}

function isDown(keys, code) {
  if (!keys || !code) return false;
  if (typeof keys.has === 'function') return keys.has(code);
  return !!keys[code];
}

function buttonDown(buttons, index) {
  const button = buttons?.[index];
  if (!button) return false;
  if (typeof button === 'object') return !!(button.pressed || (button.value ?? 0) > 0.5);
  return !!button;
}

function applyDeadzone(value) {
  if (Math.abs(value) < DEADZONE) return 0;
  return value;
}

export function keyboardActions(keys, binding) {
  const bind = binding || {};
  return {
    thrust: (isDown(keys, bind.up) ? 1 : 0) - (isDown(keys, bind.down) ? 1 : 0),
    turn: (isDown(keys, bind.right) ? 1 : 0) - (isDown(keys, bind.left) ? 1 : 0),
    fireLeft: isDown(keys, bind.action),
    fireRight: isDown(keys, bind.secondary),
    pause: false,
  };
}

export function gamepadActions(pad) {
  const axes = pad?.axes || [];
  const buttons = pad?.buttons || [];
  const stickX = Number.isFinite(axes[0]) ? axes[0] : 0;
  const stickY = Number.isFinite(axes[1]) ? axes[1] : 0;
  let thrust = -applyDeadzone(stickY);
  let turn = applyDeadzone(stickX);
  const up = buttonDown(buttons, 12);
  const down = buttonDown(buttons, 13);
  const left = buttonDown(buttons, 14);
  const right = buttonDown(buttons, 15);
  if (up || down) thrust = (up ? 1 : 0) - (down ? 1 : 0);
  if (left || right) turn = (right ? 1 : 0) - (left ? 1 : 0);
  // Negating a deadzone of 0 yields -0. Callers compare with Object.is, so store a plain 0.
  if (thrust === 0) thrust = 0;
  if (turn === 0) turn = 0;
  return {
    thrust,
    turn,
    fireLeft: buttonDown(buttons, 0),
    fireRight: buttonDown(buttons, 1),
    pause: buttonDown(buttons, 9),
  };
}

export function readPlayerControl({ keysDown, binding, pad, padConnected }) {
  if (padConnected) return gamepadActions(pad);
  return keyboardActions(keysDown, binding);
}

export function sanitizeBindings(raw) {
  const defaults = defaultBindings();
  if (!Array.isArray(raw) || raw.length !== 4) return defaults;
  return defaults.map((base, i) => {
    const incoming = raw[i] || {};
    const next = { ...base };
    for (const [field] of BINDING_FIELDS) {
      const value = incoming[field];
      if (typeof value === 'string' && value.length > 0 && value.length < 40) next[field] = value;
    }
    return next;
  });
}
