import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {minigameCatalog} from '../packages/orchestrator/autonomous-contract.js';

const skillsDir = path.resolve('skills');

test('minigame index matches the library body: 100 entries, 10 categories, six sections each', () => {
  const catalog = minigameCatalog(skillsDir);
  assert.equal(catalog.entries.length, 100);
  assert.equal(catalog.categories.length, 10);
  assert.equal(new Set(catalog.entries.map((e: any) => e.id)).size, 100);
  for (const category of catalog.categories) {
    assert.equal(catalog.entries.filter((e: any) => e.code === category.code).length, 10, category.code);
    assert.ok(category.question.length > 0, 'category ' + category.code + ' missing question');
  }
  const md = fs.readFileSync(catalog.file, 'utf8');
  for (const entry of catalog.entries) {
    const start = md.indexOf('### ' + entry.id + ' ');
    assert.ok(start >= 0, 'missing heading ' + entry.id);
    const next = md.indexOf('\n### ', start);
    const block = md.slice(start, next < 0 ? md.length : next);
    for (const field of ['玩法', '判定', '入戏', '落地', '界面', '验收']) {
      assert.ok(block.includes('**' + field + '**：'), entry.id + ' 缺少 ' + field);
    }
    assert.ok(Array.isArray(entry.inputs) && entry.inputs.length > 0, entry.id + ' 缺少输入');
    assert.ok(entry.duration.length > 0, entry.id + ' 缺少时长');
  }
});

test('minigame index exposes the library path and entry names to host tooling', () => {
  const catalog = minigameCatalog(skillsDir);
  assert.equal(catalog.entries.find((e: any) => e.id === 'A01')?.name, '找不同（双图比对）');
  assert.ok(catalog.library.endsWith('minigame-library.zh-CN.md'));
  assert.ok(catalog.file.endsWith(path.join('gameplay-design', 'references', 'minigame-library.zh-CN.md')));
  assert.ok(catalog.usage.includes('2'), 'usage must state the per-game cap');
});
