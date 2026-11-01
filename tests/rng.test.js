import assert from 'node:assert/strict';
import test from 'node:test';
import { createRng } from '../src/core/rng.js';

function take(seed, count) {
  const rng = createRng(seed);
  const values = [];
  for (let i = 0; i < count; i++) values.push(rng.next());
  return values;
}

test('seeded rng repeats and stays inside the unit interval', () => {
  const first = take(42, 12);
  const second = take(42, 12);
  assert.deepEqual(first, second);
  for (const value of first) {
    assert.ok(value >= 0 && value < 1);
  }
  assert.notDeepEqual(take(42, 8), take(43, 8));
});

test('seed 0 is still deterministic', () => {
  assert.deepEqual(take(0, 6), take(0, 6));
});

test('int stays inside the requested range', () => {
  const rng = createRng(7);
  for (let i = 0; i < 40; i++) {
    const value = rng.int(5);
    assert.ok(Number.isInteger(value));
    assert.ok(value >= 0 && value < 5);
  }
  assert.equal(createRng(1).int(1), 0);
});
