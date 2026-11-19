import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import {
  buildContentModel,
  buildSceneSlice,
  queryEntity,
  readSliceRecord,
  renderSliceYaml,
  validateSliceDocument,
  writeSceneSlice,
} from '../packages/content-model/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourcePath = path.join(root, 'content-spec/high-wall-beyond.game.yaml');
const sourceText = readFileSync(sourcePath, 'utf8');
let cached: ReturnType<typeof buildContentModel> | null = null;
const model = () => (cached ??= buildContentModel(sourceText, 'content-spec/high-wall-beyond.game.yaml'));

test('content model indexes every scene and event with stable IDs', () => {
  const document = model();
  assert.equal(document.specVersion, '1.0');
  assert.equal(document.entities.filter(entity => entity.type === 'scene').length, 15);
  assert.equal(document.entities.filter(entity => entity.type === 'event').length, 69);
  assert.equal(new Set(document.entities.map(entity => entity.id)).size, document.entities.length);
  assert.ok(document.chars > 150_000);
  assert.ok(document.lines > 8_000);
  assert.equal(document.byId.get('S_LIVING')?.type, 'scene');
  assert.equal(document.byId.get('P03')?.type, 'event');
});

test('event references are typed and direction-aware', () => {
  const document = model();
  const p03 = document.byId.get('P03');
  assert.ok(p03);
  assert.ok(p03.refs.some(ref => ref.id === 'P02' && ref.role === 'event' && ref.kind === 'condition'));
  assert.ok(p03.refs.some(ref => ref.id === 'P04' && ref.role === 'event' && ref.kind === 'next'));
  assert.ok(p03.refs.some(ref => ref.id === 'I_PREMISE' && ref.role === 'information'));
  assert.ok(p03.refs.some(ref => ref.id === 'C_ANDY' && ref.role === 'character'));
  assert.ok(p03.refs.some(ref => ref.id === 'V_KNOW' && ref.role === 'state' && ref.kind === 'change'));
  assert.ok(p03.refs.some(ref => ref.id === 'SRC_PACK' && ref.role === 'source'));
  assert.ok(p03.refs.some(ref => ref.id === 'A02' && ref.role === 'sound'));
});

test('S_LIVING slice closes on P02/P03, uses the runtime title and a synthetic boundary', () => {
  const document = model();
  const slice = buildSceneSlice(document, { sceneId: 'S_LIVING' });

  assert.deepEqual(slice.events, ['P02', 'P03']);
  assert.equal(slice.entry.mode, 'runtime-title');
  assert.equal(slice.entry.eventId, 'P01');
  assert.equal(slice.entry.sceneId, 'S_MENU');
  assert.equal(slice.boundary.eventId, 'P03');
  assert.equal(slice.boundary.endingId, 'SLICE_END');
  assert.equal(slice.acceptance.startScene, 'S_LIVING');
  assert.equal(slice.acceptance.maxScenes, 1);
  assert.equal(slice.acceptance.minigamesRequired, false);

  assert.deepEqual(slice.included.scene, ['S_LIVING']);
  assert.deepEqual(slice.included.event, ['P02', 'P03']);
  assert.ok(slice.included.character.includes('C_ANDY'));
  assert.ok(slice.included.character.includes('C_RED'));
  assert.ok(slice.included.character.includes('C_BROOKS'));
  assert.ok(!slice.included.character.includes('C_MASTER'));
  assert.ok(slice.included.state.includes('V_KNOW'));
  assert.ok(slice.included.state.includes('V_DONE'));
  assert.ok(slice.included.sound.includes('A01'));
  assert.ok(slice.included.sound.includes('A02'));
  assert.deepEqual(slice.included.ending, ['SLICE_END']);
  assert.ok(slice.included.checkpoint.includes('CP_SLICE_END'));

  assert.deepEqual(slice.referenced.map(item => item.id).sort(), ['P01', 'P04', 'S_MENU', 'S_YARD']);
  assert.ok(!slice.referenced.some(item => item.id === 'C_MASTER'));
  assert.ok(!slice.absent.some(item => item.id === 'P01'));

  const scene = slice.document['场景'][0];
  assert.equal(scene.id, 'S_LIVING');
  assert.deepEqual(scene['出口'], []);
  const p03 = slice.document['事件'].find((event: any) => event.id === 'P03');
  assert.deepEqual(p03['后续事件引用'], []);
  const p02 = slice.document['事件'].find((event: any) => event.id === 'P02');
  assert.deepEqual(p02['场景引用'], ['S_LIVING']);
  assert.deepEqual(p02['后续事件引用'], ['P03']);

  const endings = slice.document['结局'];
  assert.equal(endings.length, 1);
  assert.equal(endings[0].id, 'SLICE_END');
  assert.equal(slice.document['主线'].includes('P04'), false);
  assert.deepEqual(slice.document['主线'], ['P02', 'P03']);
  assert.equal(slice.document['初始配置']['场景引用'], 'S_LIVING');
  assert.equal(slice.document['初始配置']['起始事件引用'], 'P02');
  assert.equal(slice.document['事件'].some((event: any) => event.id === 'P01'), false);
});

test('a mid-game scene enters by prior-summary instead of pretending to be a title', () => {
  const document = model();
  const slice = buildSceneSlice(document, { sceneId: 'S_CELL' });
  assert.equal(slice.entry.mode, 'prior-summary');
  assert.equal(slice.entry.eventId, 'P05');
  assert.deepEqual(slice.events, ['P06', 'P07', 'P08']);
  assert.equal(slice.boundary.eventId, 'P08');
  assert.equal(slice.document['初始配置']['起始事件引用'], 'P06');
  assert.ok(slice.referenced.some(item => item.id === 'S_CORRIDOR' && item.reason === 'outside-scene'));
});

test('the rendered slice is valid YAML and stays well below the source size', () => {
  const document = model();
  const slice = buildSceneSlice(document, { sceneId: 'S_LIVING' });
  const yaml = renderSliceYaml(slice);
  const parsed = parseYaml(yaml) as Record<string, any>;
  assert.equal(parsed['场景'].length, 1);
  assert.equal(parsed['场景'][0].id, 'S_LIVING');
  assert.deepEqual(parsed['场景'][0]['出口'], []);
  assert.equal(parsed['事件'].length, 2);
  assert.equal(parsed['结局'][0].id, 'SLICE_END');
  assert.equal(parsed['检查点'].some((checkpoint: any) => checkpoint.id === 'CP_SLICE_END'), true);
  assert.ok(slice.metrics.sliceChars < document.chars * 0.2);
  assert.ok(slice.metrics.ratio > 0 && slice.metrics.ratio < 0.2);
  assert.ok(slice.metrics.tokenEstimate > 0);
  const validation = validateSliceDocument(slice);
  assert.deepEqual(validation.errors, []);
});

test('slice generation is deterministic', () => {
  const document = model();
  const first = buildSceneSlice(document, { sceneId: 'S_LIVING' });
  const second = buildSceneSlice(document, { sceneId: 'S_LIVING' });
  assert.equal(first.hashes.slice, second.hashes.slice);
  assert.deepEqual(first.includedIds, second.includedIds);
  assert.equal(renderSliceYaml(first), renderSliceYaml(second));
});

test('bad input fails loudly instead of guessing', () => {
  assert.throws(() => buildContentModel('规范版本: "1.0"\n场景:\n  - id: S_X\n事件: []\n', 'bad.yaml'), /没有事件列表/);
  assert.throws(() => buildContentModel('规范版本: "9.9"\n场景: []\n事件: []\n', 'bad.yaml'), /不支持的内容规范版本/);
  assert.throws(() => buildContentModel('规范版本: "1.0"\nfoo: 1\nfoo: 2\n', 'bad.yaml'), /解析失败|重复/);
  const document = model();
  assert.throws(() => buildSceneSlice(document, { sceneId: 'S_NOT_FOUND' }), /不存在场景/);
});

test('query by ID returns the entity and rejects unknown IDs with suggestions', () => {
  const document = model();
  const state = queryEntity(document, 'V_KNOW');
  assert.equal(state.type, 'state');
  assert.equal(state.payload['名称'], '各方认知');
  assert.ok(Array.isArray(state.incoming) && state.incoming.length > 0);
  assert.throws(() => queryEntity(document, 'V_NOPE'), /不存在 ID/);
});

test('written slice artifacts expose a machine record and a matching hash', () => {
  const document = model();
  const slice = buildSceneSlice(document, { sceneId: 'S_LIVING' });
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'cw-slice-'));
  try {
    writeSceneSlice(workspace, slice);
    assert.equal(existsSync(path.join(workspace, 'slice.json')), true);
    assert.equal(existsSync(path.join(workspace, 'sources/scene-slice.yaml')), true);
    assert.equal(existsSync(path.join(workspace, 'sources/scene-slice.md')), true);
    const record = readSliceRecord(workspace);
    assert.ok(record);
    assert.equal(record.source.sha256, slice.source.sha256);
    const yaml = readFileSync(path.join(workspace, 'sources/scene-slice.yaml'), 'utf8');
    const brief = readFileSync(path.join(workspace, 'sources/scene-slice.md'), 'utf8');
    const recomputed = createHash('sha256').update(yaml + '\n' + brief).digest('hex');
    assert.equal(recomputed, record.hashes.slice);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
