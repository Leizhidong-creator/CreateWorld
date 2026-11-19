import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AssetRetryHistory, diagnoseAssetFailure, sceneReviewScope } from '../packages/assets/workflow.js';

test('asset repair budgets survive sessions and changing error text, without blocking other assets', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cw-repair-history-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const open = (id = 'scene') => AssetRetryHistory.open(root, root + '/work', id, 'art-v1');
  let history = await open();
  const diagnostic = { code: 'scene-geometry', owner: 'geometry' as const, nextAction: 'repair', resumeCandidate: 'asset-jobs/scene/attempt/candidate.json' };
  await history.beginGeneration();
  await history.fail('same-input', diagnostic, 'anchor A is unreachable');
  history = await open('SCENE');
  assert.equal(history.decision('same-input', 'generate')?.code, 'existing-candidate-needs-repair');
  await history.fail('same-input', diagnostic, 'anchor B is unreachable; new attempt path');
  history = await open();
  assert.equal(history.decision('same-input', 'validate')?.code, 'repeated-asset-failure');
  assert.equal(history.decision('fixed-input', 'validate'), undefined);
  assert.equal((await open('other')).decision('same-input', 'generate'), undefined);
});

test('changing task text cannot reset the resource generation budget; cancellations do not consume it', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cw-generation-budget-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const open = () => AssetRetryHistory.open(root, root + '/work', 'hero', 'art-v1');
  const history = await open();
  await history.beginGeneration(); await history.cancelGeneration();
  for (let i = 0; i < 3; i++) { assert.equal(history.decision('prompt-' + i, 'generate'), undefined); await history.beginGeneration(); }
  const reloaded = await open();
  assert.equal(reloaded.decision('new-prompt', 'generate')?.code, 'generation-budget-exhausted');
  assert.equal(reloaded.decision('fixed-candidate', 'validate'), undefined);
  await reloaded.succeeded();
  assert.equal((await open()).decision('later-authorized-change', 'generate'), undefined);
});

test('scene review separates baked assets from runtime state and numeric reachability', () => {
  const prompt = sceneReviewScope({ baked: ['bed'], runtime: ['poster'], state: 'before acquisition' });
  assert.match(prompt, /明确烘焙元素：\["bed"\]/);
  assert.match(prompt, /运行时叠加元素：\["poster"\]/);
  assert.match(prompt, /未明确锁定的像素坐标与家具尺寸是布局估计/);
  assert.match(prompt, /数值可达性由宿主负责/);
  assert.equal(diagnoseAssetFailure(Error('unable to create process: permission denied')).owner, 'environment');
});
