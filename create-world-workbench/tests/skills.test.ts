import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {skillFileHash,matchesPreviousSkillFile} from '../packages/skill-adapters/skill-integrity.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageDefinitions, loadSkillInstructions, buildStagePrompt, resolveSkillsForStage, computeAffectedStages, classifyChange, validateStageOutput, validateJourneys, validateAssetPlan, isSafeRelativeAssetPath, getDeterministicSkillTools, validMiniGameInputs, type StageContext } from '../packages/skill-adapters/legacy-stage-adapter.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const context: StageContext = { project: { id: 'test-story', title: '测试作品' }, sourceDir: path.join(root, 'data/source'), workspaceDir: path.join(root, 'data/candidate'), configExamplePath: path.join(root, 'fixtures/harbor.json'), runtimeDocsPath: path.join(root, 'packages/runtime/README.md') };
const source = { records: [{ id: 'r1', path: 'source.txt', locator: '第1–4章' }], motives: [], causalChain: [], ending: { status: 'verified', summary: '原作结局', recordIds: ['r1'] }, canonLocks: [], gaps: [], originalAdditions: [], blocked: false };
const character = { id: 'hero', kind: 'character', entityId: 'player', prompt: '四向像素角色', path: 'hero.png', width: 192, height: 256, frameLayout: { columns: 4, rows: { up: 3, right: 2, left: 1, down: 0 }, idleFrame: 0, cellWidth: 48, cellHeight: 64 } };

test('skill integrity tolerates checkout line endings while preserving binary bytes and real changes', () => {
  const lf=Buffer.from('first\nsecond\n'),crlf=Buffer.from('first\r\nsecond\r\n');
  assert.equal(skillFileHash(lf),skillFileHash(crlf));
  assert.equal(matchesPreviousSkillFile(lf,createHash('sha256').update(crlf).digest('hex')),true);
  assert.notEqual(skillFileHash(Buffer.from('changed\n')),skillFileHash(lf));
  assert.equal(matchesPreviousSkillFile(Buffer.from('changed\n'),createHash('sha256').update(lf).digest('hex')),false);
  const binary=Buffer.from([0,13,10,255]);
  assert.equal(skillFileHash(binary),createHash('sha256').update(binary).digest('hex'));
  assert.notEqual(skillFileHash(binary),skillFileHash(Buffer.from([0,10,255])));
});

test('integrated skill entries and available legacy assets match the manifest', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'skills/manifest.json'), 'utf8'));
  assert.equal(manifest.skills.length, 18);
  for (const id of ['visual-asset-production', 'prop-generation', 'game-ui-styling']) assert.ok(manifest.skills.some((s: any) => s.id === id));
  for (const skill of manifest.skills) {
    for (const record of skill.files) {
      const raw = await readFile(path.join(root, 'skills', skill.id, record.path));
      assert.equal(skillFileHash(raw,manifest.hashPolicy||'raw'), record.sha256, `${skill.id}/${record.path}`);
    }
    if (skill.originalSkillSha256) {
      const original = await readFile(path.join(root, 'skills', skill.id, 'LEGACY_SKILL.md'));
      assert.equal(skillFileHash(original,manifest.hashPolicy||'raw'), skill.originalSkillSha256);
    }
  }
});
test('stage selection is grouped and only enables optional branches and eggs when needed', () => {
  assert.equal(stageDefinitions.length, 6);
  assert.deepEqual(resolveSkillsForStage('source', context), ['content-understanding']);
  assert.equal(resolveSkillsForStage('content', context).includes('narrative-branch'), false);
  const enabled = resolveSkillsForStage('content', { ...context, project: { features: { branches: true, easterEggs: true } } });
  assert.ok(enabled.includes('narrative-branch')); assert.ok(enabled.includes('easter-egg'));
  assert.deepEqual(resolveSkillsForStage('assets', { ...context, change: '把衣服改成红色' }), ['visual-asset-production', 'character-generation']);
});
test('loaded instructions are actual versioned files and prompts enforce write ownership', async () => {
  const result = await loadSkillInstructions('content', context);
  assert.equal(result.skills.length, 3); assert.equal(result.instructionsHash.length, 64);
  const prompt = await buildStagePrompt('content', context);
  assert.match(prompt, /journeys\.json/); assert.match(prompt, /extensions\/\*\.js/); assert.match(prompt, /禁止复制示例人物/); assert.match(prompt, /不设置逐阶段人工审批/);
  assert.doesNotMatch(prompt, /技能 easter-egg \//);
  await assert.rejects(buildStagePrompt('source', { ...context, outputPaths: { source: '../escape.json' } }), /inside/);
});
test('unknown canon ending is a valid blocked artifact, never a pass', () => {
  const result = validateStageOutput('source', { ...source, ending: { status: 'unknown', summary: '', recordIds: [] }, blocked: true });
  assert.equal(result.valid, true); assert.equal(result.blocked, true); assert.equal(result.passed, false);
  const fabricated = validateStageOutput('source', { ...source, ending: { status: 'unknown' }, blocked: false });
  assert.equal(fabricated.valid, false);
  const unrelatedRecord = validateStageOutput('source', { ...source, ending: { status: 'verified', summary: '结局', recordIds: ['missing'] } });
  assert.equal(unrelatedRecord.valid, false);
});
test('downstream output cannot bypass a blocked source', () => {
  const result = validateStageOutput('review', { scope: 'model-semantic-review', passed: true, canonPreserved: true, issues: [] }, { ...context, bundle: { source: { ...source, blocked: true } } });
  assert.equal(result.blocked, true); assert.equal(result.passed, false);
});
test('safe local asset paths reject traversal, URL, encoded scheme and absolute paths', () => {
  assert.equal(isSafeRelativeAssetPath('scenes/room.png'), true);
  for (const unsafe of ['../secret', 'https://example.com/x', '/tmp/a', 'C:\\a', '%2e%2e/a', 'file%3Atest.png', 'a/%00.png', 'a//b', 'a?x=1']) assert.equal(isSafeRelativeAssetPath(unsafe), false, unsafe);
});
test('asset plans require actual four-frame metadata, regardless of JSON key order', () => {
  assert.equal(validateAssetPlan([character]).valid, true);
  assert.equal(validateAssetPlan([{ ...character, width: 144 }]).valid, false);
  assert.equal(validateAssetPlan([{ ...character, frameLayout: { ...character.frameLayout, columns: 3 } }]).valid, false);
});
test('every ending must have a real-input journey and state-write shortcuts are rejected', () => {
  const game = { endings: [{ id: 'end' }], scenes: [{ interactions: [{ id: 'talk' }], exits: [{ id: 'door' }] }] };
  assert.equal(validateJourneys([{ id: 'main', endingId: 'end', steps: [{ action: 'interact', id: 'talk' }, { action: 'exit', id: 'door' }] }], game).valid, true);
  assert.equal(validateJourneys([{ id: 'bad', endingId: 'end', steps: [{ action: 'setState', value: true }] }], game).valid, false);
  assert.equal(validateJourneys([], game).valid, false);
});
test('semantic reviews cannot impersonate trusted host acceptance', () => {
  assert.equal(validateStageOutput('review', { scope: 'model-semantic-review', passed: true, canonPreserved: true, issues: [], runtimePassed: true }).valid, false);
  assert.equal(validateStageOutput('review', { scope: 'model-semantic-review', passed: true, canonPreserved: false, issues: [] }).valid, false);
});
test('custom mechanism journeys accept bounded real inputs and reject execution shortcuts', () => {
  assert.equal(validMiniGameInputs([{ type: 'click', label: '旋转' }, { type: 'key', key: 'ArrowLeft', durationMs: 300 }, { type: 'drag', from: { x: 2, y: 3 }, to: { x: 30, y: 40 } }]), true);
  assert.equal(validMiniGameInputs([{type:'key',key:'Enter',durationMs:3000}]),true,'the real browser runner supports a neutral Enter input without substituting movement');
  for (const inputs of [[{ type: 'evaluate', code: 'finish()' }], [{ type: 'key', key: 'Control+L' }], [{ type: 'key', key: 'Space', durationMs: 60000 }], [{ type: 'drag', from: { x: -1, y: 0 }, to: { x: 0, y: 0 } }]]) assert.equal(validMiniGameInputs(inputs), false);
});
test('incremental invalidation preserves unrelated assets, but combines multi-intent changes', () => {
  assert.equal(classifyChange('修改场景二的对白措辞'), 'dialogue');
  assert.deepEqual(computeAffectedStages('修改对白措辞'), ['content', 'assembly', 'review']);
  assert.deepEqual(computeAffectedStages('把衣服改红'), ['assets', 'assembly', 'review']);
  assert.deepEqual(computeAffectedStages('移动房门'), ['content', 'assets', 'assembly', 'review']);
  assert.deepEqual(computeAffectedStages('把对白改短，衣服改红'), ['content', 'assets', 'assembly', 'review']);
  assert.deepEqual(computeAffectedStages('更换原作结局'), ['source', 'design', 'content', 'assets', 'assembly', 'review']);
});
test('deterministic script recipes point to real local executables without invoking them', async () => {
  for (const tool of Object.values(getDeterministicSkillTools())) await access(tool.script);
});
