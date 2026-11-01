import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function resolveLaunch(value) {
  return path.join(root, value.replace(/^\.\//, ''));
}

test('arcade.json matches the manifest and points at real files', () => {
  const manifest = JSON.parse(readFileSync(path.join(root, 'arcade.json'), 'utf8'));
  assert.deepEqual(manifest, {
    name: 'Kraken Keepers',
    id: 'krakenkeepers',
    icon: 'assets/icon.jpg',
    cover: 'assets/cover.jpg',
    launch: {
      mac: './launch-mac.command',
      windows: 'launch-windows.bat',
      linux: './launch-linux.sh',
      web: 'index.html',
    },
    players: 4,
    port: 8807,
    minPlayers: 1,
    input: ['keyboard', 'gamepad'],
    version: '1.0.0',
  });

  for (const relative of [manifest.icon, manifest.cover, manifest.launch.web, 'server.py', 'README.md', 'LICENSE']) {
    const file = path.join(root, relative);
    assert.equal(existsSync(file), true, relative);
    assert.ok(statSync(file).size > 0, relative);
  }
  for (const key of ['mac', 'windows', 'linux']) {
    const file = resolveLaunch(manifest.launch[key]);
    assert.equal(existsSync(file), true, key);
    assert.ok(statSync(file).size > 0, key);
  }
  for (const key of ['mac', 'linux']) {
    const mode = statSync(resolveLaunch(manifest.launch[key])).mode;
    assert.ok(mode & 0o111, `${key} launcher should be executable`);
  }
});
