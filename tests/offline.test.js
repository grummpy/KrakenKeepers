import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

test('the game does not reach out to a network', () => {
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /src\/ui\/main\.js/);
  assert.match(html, /<canvas/);
  assert.doesNotMatch(html, /https?:\/\//);
  const sources = walk(path.join(root, 'src')).filter((file) => file.endsWith('.js'));
  assert.ok(sources.length >= 8);
  for (const file of sources) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /https?:\/\//, path.relative(root, file));
  }
});

test('core modules do not touch the DOM or canvas', () => {
  const files = walk(path.join(root, 'src', 'core'));
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /\b(document|window|canvas|localStorage|HTMLCanvasElement)\b/, path.relative(root, file));
  }
});
