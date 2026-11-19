import test from 'node:test';
import assert from 'node:assert/strict';
import { saveUploadedGame } from '../apps/web/src/site/upload-store.js';

test('reject invalid uploads before opening browser storage', async () => {
  await assert.rejects(saveUploadedGame(' ', '', new File(['game'], 'game.html')), /名称/);
  await assert.rejects(saveUploadedGame('Game', '', new File(['code'], 'game.exe')), /HTML/);
  await assert.rejects(saveUploadedGame('Game', '', new File([], 'game.zip')), /非空/);
  const oversized = new File(['game'], 'game.html');
  Object.defineProperty(oversized, 'size', { value: 101 * 1024 * 1024 });
  await assert.rejects(saveUploadedGame('Game', '', oversized), /100 MB/);
});
