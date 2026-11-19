import test from 'node:test';
import assert from 'node:assert/strict';
import { assert16x9, CONTROL_LAYOUT, GAME_ASPECT_RATIO, GAME_ASPECT_RATIO_LABEL, is16x9, MAP_LAYOUT, VIEWPORT, mapFrame, worldToMap } from '../packages/source-library/world-kit/layout.js';
import { KEY_BINDINGS } from '../packages/source-library/world-kit/keyboard.js';
import { nearestInteraction } from '../packages/source-library/world-kit/interaction.js';

test('world-kit exposes one fixed coordinate contract', () => {
  assert.deepEqual(VIEWPORT, { width: 640, height: 360, aspectRatio: GAME_ASPECT_RATIO });
  assert.equal(GAME_ASPECT_RATIO_LABEL, '16:9');
  assert.deepEqual(CONTROL_LAYOUT, {
    joystick: { x: 24, y: 264, size: 84 },
    action: { x: 544, y: 264, size: 72 },
  });
  assert.deepEqual(MAP_LAYOUT, { inset: 10 });
  assert.equal(KEY_BINDINGS.KeyE, 'interact');
  assert.equal(KEY_BINDINGS.Space, 'interact');
});

test('world-kit rejects non-16:9 surfaces', () => {
  assert.equal(is16x9(640, 360), true);
  assert.equal(is16x9(1280, 720), true);
  assert.equal(is16x9(800, 600), false);
  assert.equal(assert16x9(1920, 1080), true);
  assert.throws(() => assert16x9(1024, 768), /16:9/);
});

test('world-kit map projection preserves scene proportions', () => {
  const scene = { width: 1280, height: 720 };
  const frame = mapFrame(scene, 640, 360);
  assert.deepEqual(frame, { x: 17.77777777777777, y: 10, w: 604.4444444444445, h: 340, scale: 0.4722222222222222 });
  assert.deepEqual(worldToMap({ x: 0, y: 0 }, scene, frame), { x: 17.77777777777777, y: 10 });
  assert.deepEqual(worldToMap({ x: 1280, y: 720 }, scene, frame), { x: 622.2222222222222, y: 350 });
});

test('world-kit interaction selection is conditional, ranged and deterministic', () => {
  const point = { x: 100, y: 100 };
  const entries = [
    { id: 'far', rect: { x: 130, y: 100, w: 10, h: 10 }, range: 20 },
    { id: 'blocked', rect: { x: 100, y: 100, w: 10, h: 10 }, priority: 100, when: false },
    { id: 'near-b', rect: { x: 108, y: 100, w: 10, h: 10 }, priority: 1 },
    { id: 'near-a', rect: { x: 108, y: 100, w: 10, h: 10 }, priority: 1 },
  ];
  assert.equal(nearestInteraction(point, entries, (value: unknown) => value !== false)?.id, 'near-a');
});
