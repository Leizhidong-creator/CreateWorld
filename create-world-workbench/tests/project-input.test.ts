import test from 'node:test';
import assert from 'node:assert/strict';
import { projectInput } from '../packages/contracts/index.js';

test('text projects accept a short typed story without a file', () => {
  const result = projectInput.safeParse({ title: '短故事', inputKind: 'text', sourceText: '小猫出门寻找失踪的月亮。' });
  assert.equal(result.success, true);
});

test('text projects require a nonblank name and story', () => {
  for (const value of [
    { title: '   ', inputKind: 'text', sourceText: '一个故事' },
    { title: '短故事', inputKind: 'text', sourceText: ' \n ' },
  ]) assert.equal(projectInput.safeParse(value).success, false);
});

test('title search still works without story material', () => {
  assert.equal(projectInput.safeParse({ title: '作品名', inputKind: 'title' }).success, true);
});
