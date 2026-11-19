import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { composeGame, materializeGameConfig, resolveGame } from '../packages/orchestrator/game-config.js';

const fixture = JSON.parse(fs.readFileSync('fixtures/harbor.json', 'utf8'));

test('compose stays read-only and materialisation is explicit', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-game-config-'));
  try {
    const { scenes, ...base } = fixture;
    fs.writeFileSync(path.join(workspace, 'game.project.json'), JSON.stringify({ base, parts: ['scenes.json'] }));
    fs.writeFileSync(path.join(workspace, 'scenes.json'), JSON.stringify({ scenes }));
    const composed = composeGame(workspace);
    assert.deepEqual(composed, fixture);
    assert.equal(fs.existsSync(path.join(workspace, 'game.json')), false);
    assert.deepEqual(materializeGameConfig(workspace), fixture);
    assert.equal(fs.existsSync(path.join(workspace, 'game.json')), true);
    assert.deepEqual(resolveGame(workspace), fixture);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
