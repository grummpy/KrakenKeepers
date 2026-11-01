import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultBindings,
  gamepadActions,
  keyLabel,
  keyboardActions,
  readPlayerControl,
  sanitizeBindings,
} from '../src/core/input.js';

function keys(...codes) {
  return new Set(codes);
}

function pad(axes, pressed = []) {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  for (const index of pressed) buttons[index] = { pressed: true, value: 1 };
  return { axes, buttons };
}

test('default keyboard map for all four players', () => {
  const bindings = defaultBindings();
  const cases = [
    [0, ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyF', 'KeyG']],
    [1, ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash', 'Period']],
    [2, ['KeyI', 'KeyK', 'KeyJ', 'KeyL', 'Semicolon', 'Quote']],
    [3, ['Numpad8', 'Numpad5', 'Numpad4', 'Numpad6', 'Numpad0', 'NumpadEnter']],
  ];
  for (const [index, codes] of cases) {
    const [up, down, left, right, action, secondary] = codes;
    assert.deepEqual(bindings[index], { up, down, left, right, action, secondary });
    const forward = keyboardActions(keys(up, action), bindings[index]);
    assert.equal(forward.thrust, 1);
    assert.equal(forward.fireLeft, true);
    assert.equal(forward.fireRight, false);
    const back = keyboardActions(keys(down, left, secondary), bindings[index]);
    assert.equal(back.thrust, -1);
    assert.equal(back.turn, -1);
    assert.equal(back.fireRight, true);
  }
});

test('key labels for the awkward defaults', () => {
  assert.equal(keyLabel('Slash'), '/');
  assert.equal(keyLabel('Period'), '.');
  assert.equal(keyLabel('Semicolon'), ';');
  assert.equal(keyLabel('Quote'), "'");
  assert.equal(keyLabel('NumpadEnter'), 'Num Enter');
  assert.equal(keyLabel('Numpad0'), 'Num 0');
  assert.equal(keyLabel(''), '—');
});

test('gamepad stick, deadzone, d-pad, face buttons, and start', () => {
  const idle = gamepadActions(pad([0.1, -0.1]));
  assert.equal(idle.thrust, 0);
  assert.equal(idle.turn, 0);
  assert.equal(idle.pause, false);

  const stick = gamepadActions(pad([0.8, -0.9]));
  assert.ok(stick.turn > 0.7);
  assert.ok(stick.thrust > 0.8);

  const dpad = gamepadActions(pad([0.8, 0.8], [12, 14]));
  assert.equal(dpad.thrust, 1);
  assert.equal(dpad.turn, -1);

  const faces = gamepadActions(pad([0, 0], [0, 1, 9]));
  assert.equal(faces.fireLeft, true);
  assert.equal(faces.fireRight, true);
  assert.equal(faces.pause, true);

  const valued = gamepadActions({ axes: [0, 0], buttons: [{ value: 1 }] });
  assert.equal(valued.fireLeft, true);
});

test('a connected pad overrides that player keyboard', () => {
  const binding = defaultBindings()[0];
  const fromKeys = readPlayerControl({
    keysDown: keys('KeyW', 'KeyF'),
    binding,
    pad: null,
    padConnected: false,
  });
  assert.equal(fromKeys.thrust, 1);
  assert.equal(fromKeys.fireLeft, true);

  const overridden = readPlayerControl({
    keysDown: keys('KeyW', 'KeyF'),
    binding,
    pad: pad([0, 0.85], [1]),
    padConnected: true,
  });
  assert.ok(overridden.thrust < 0);
  assert.equal(overridden.fireLeft, false);
  assert.equal(overridden.fireRight, true);

  const missingPad = readPlayerControl({
    keysDown: keys('KeyW'),
    binding,
    pad: null,
    padConnected: true,
  });
  assert.equal(missingPad.thrust, 0);
  assert.equal(missingPad.pause, false);
});

test('saved bindings fall back when the stored value is junk', () => {
  const defaults = defaultBindings();
  assert.deepEqual(sanitizeBindings(null), defaults);
  assert.deepEqual(sanitizeBindings([{ up: 'KeyQ' }]), defaults);
  const custom = sanitizeBindings([
    { up: 'KeyQ', down: 5 },
    defaults[1],
    defaults[2],
    defaults[3],
  ]);
  assert.equal(custom[0].up, 'KeyQ');
  assert.equal(custom[0].down, defaults[0].down);
  assert.deepEqual(custom[1], defaults[1]);
});
