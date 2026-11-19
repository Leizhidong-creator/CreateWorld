import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildContentModel,
  buildSceneSlice,
  validateSliceAgainstGame,
  validateSliceDocument,
  validateSliceJourneys,
  writeSceneSlice,
} from '../packages/content-model/index.js';
import { checkProject, productionEvidenceErrors, productionPrompt } from '../packages/orchestrator/autonomous-contract.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceText = readFileSync(path.join(root, 'content-spec/high-wall-beyond.game.yaml'), 'utf8');
const document = buildContentModel(sourceText, 'content-spec/high-wall-beyond.game.yaml');
const slice = buildSceneSlice(document, { sceneId: 'S_LIVING' });

const scene = {
  id: 'S_LIVING', name: '客厅观影', width: 640, height: 360, spawn: { x: 80, y: 180 },
  collisions: [], objects: [], npcs: [], triggers: [], regions: [], landmarks: [], interactions: [], exits: [],
};
const game = {
  id: 'slice-test',
  start: { scene: 'S_LIVING', position: { x: 80, y: 180 } },
  scenes: [scene],
  endings: [{ id: 'SLICE_END', title: '场景切片完成', pages: [{ text: '切片完成' }] }],
  minigames: [], assets: [], characters: [], dialogues: [], quests: [], items: [], clues: [], achievements: [],
};

test('a minimal single-scene game satisfies the slice contract', () => {
  const report = validateSliceAgainstGame(slice, game);
  assert.deepEqual(report.errors, []);
  assert.equal(report.valid, true);
});

test('wrong start scene, missing boundary, extra scene, extra ending and out-of-slice exits are rejected', () => {
  assert.match(validateSliceAgainstGame(slice, { ...game, start: { scene: 'S_MENU', position: { x: 1, y: 1 } } }).errors.join('\n'), /起始场景/);
  assert.match(validateSliceAgainstGame(slice, { ...game, endings: [] }).errors.join('\n'), /边界结局/);
  assert.match(validateSliceAgainstGame(slice, { ...game, scenes: [...game.scenes, { ...scene, id: 'S_YARD' }] }).errors.join('\n'), /只能包含 1 个场景/);
  assert.match(validateSliceAgainstGame(slice, { ...game, endings: [...game.endings, { id: 'END01', pages: [{ text: 'x' }] }] }).errors.join('\n'), /额外结局/);
  const withExit = { ...game, scenes: [{ ...scene, exits: [{ id: 'to-yard', to: 'S_YARD', rect: { x: 1, y: 1, w: 10, h: 10 }, spawn: { x: 1, y: 1 } }] }] };
  assert.match(validateSliceAgainstGame(slice, withExit).errors.join('\n'), /切片外场景 S_YARD/);
});

test('slice journeys must declare the boundary ending', () => {
  assert.equal(validateSliceJourneys(slice, [{ id: 'slice', endingId: 'SLICE_END', steps: [{ action: 'interact', id: 'watch' }] }]).valid, true);
  assert.equal(validateSliceJourneys(slice, []).valid, false);
  assert.equal(validateSliceJourneys(slice, [{ id: 'wrong', endingId: 'END01', steps: [{ action: 'interact', id: 'watch' }] }]).valid, false);
});

test('slice document rejects dangling exits and next-event links', () => {
  const withExit = structuredClone(slice);
  withExit.document['场景'][0]['出口'] = [{ 场景引用: 'S_YARD', 条件: { 全部: [] } }];
  assert.match(validateSliceDocument(withExit).errors.join('\n'), /出口指向切片外场景 S_YARD/);

  const withNext = structuredClone(slice);
  withNext.document['事件'][0]['后续事件引用'] = ['P04'];
  assert.match(validateSliceDocument(withNext).errors.join('\n'), /后续事件 P04 不在切片内/);
});

test('scene-slice evidence requires the boundary ending, not five scenes or minigames', () => {
  const evidence = {
    checks: { 'ending:SLICE_END': true, midRunReload: true },
    journeys: [{ endingId: 'SLICE_END', status: 'passed', observations: [{ state: { run: { scene: 'S_LIVING' } } }] }],
  };
  assert.deepEqual(productionEvidenceErrors(game, evidence, { sceneSlice: true, sceneId: 'S_LIVING', boundaryEndingId: 'SLICE_END' }), []);

  const missingEnding = { ...evidence, checks: { midRunReload: true }, journeys: [{ endingId: 'SLICE_END', status: 'failed', observations: [] }] };
  assert.match(productionEvidenceErrors(game, missingEnding, { sceneSlice: true, sceneId: 'S_LIVING', boundaryEndingId: 'SLICE_END' }).join('\n'), /边界结局/);

  const missingReload = { ...evidence, checks: { 'ending:SLICE_END': true } };
  assert.match(productionEvidenceErrors(game, missingReload, { sceneSlice: true, sceneId: 'S_LIVING', boundaryEndingId: 'SLICE_END' }).join('\n'), /中途存档/);
});

test('full-game evidence still requires five observed scenes and every minigame', () => {
  const evidence = {
    checks: { midRunReload: true },
    journeys: [{ id: 'one', status: 'passed', observations: [{ state: { run: { scene: 'S_LIVING' } } }], actions: [] }],
  };
  const errors = productionEvidenceErrors({ ...game, minigames: [{ id: 'pump' }] }, evidence);
  assert.match(errors.join('\n'), /至少5个场景/);
  assert.match(errors.join('\n'), /机制没有真实操作证据：pump/);
});

test('checkProject accepts a closed scene-slice workspace and invalidates it when the YAML changes', () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'cw-slice-project-'));
  const writeJson = (name: string, value: unknown) => writeFileSync(path.join(workspace, name), JSON.stringify(value, null, 2));
  try {
    mkdirSync(path.join(workspace, 'sources'), { recursive: true });
    writeFileSync(path.join(workspace, 'sources', 'game-content.yaml'), sourceText);
    writeSceneSlice(workspace, slice);

    const minimalGame = {
      id: 'slice-test',
      title: '客厅切片',
      description: '单场景切片验收夹具',
      theme: { accent: '#d6b36a', world: '#0b1016' },
      player: { speed: 120, radius: 7, character: 'hero' },
      start: { scene: 'S_LIVING', position: { x: 80, y: 180 } },
      assets: [
        { id: 'bg', type: 'image', src: 'bg.png' },
        { id: 'hero-art', type: 'image', src: 'hero.png' },
      ],
      characters: [{ id: 'hero', asset: 'hero-art', frameWidth: 16, frameHeight: 16, width: 16, height: 16 }],
      scenes: [{
        id: 'S_LIVING', name: '客厅观影', width: 640, height: 360, background: 'bg',
        spawn: { x: 80, y: 180 }, collisions: [], objects: [], npcs: [], triggers: [],
        regions: [], landmarks: [], exits: [],
        interactions: [{
          id: 'watch', name: '观看', label: '继续', rect: { x: 300, y: 150, w: 40, h: 40 }, range: 40,
          actions: [{ type: 'ending', id: 'SLICE_END' }],
        }],
      }],
      dialogues: [], quests: [], items: [], clues: [], achievements: [],
      endings: [{ id: 'SLICE_END', title: '场景切片完成', pages: [{ text: '切片完成' }] }],
      minigames: [],
    };
    writeJson('game.json', minimalGame);
    writeJson('project.json', { id: 'slice-test', title: '客厅切片' });
    writeJson('scope.json', { mode: 'scene-slice', sceneId: 'S_LIVING' });
    writeJson('source.json', {
      records: [{ id: 'r1', path: 'sources/game-content.yaml', locator: 'S_LIVING' }],
      motives: [], causalChain: [],
      ending: { status: 'verified', summary: '切片边界不是原作结局', recordIds: ['r1'] },
      canonLocks: [], gaps: [], originalAdditions: [], blocked: false,
    });
    writeFileSync(path.join(workspace,'sources','style.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>');
    writeJson('design.json', { mechanics: [], artDirection: {
      pixelPolicy:'640x360 native pixel clusters',camera:'orthographic top down',characterSize:'16x16 feet anchored',
      palette:['#334452','#9eafb5'],lighting:'cool upper-left light',detailDensity:'simple large clusters',
      assetReuse:'fixture assets share a palette',referencePaths:['sources/style.svg'],
    } });
    writeJson('journeys.json', [{ id: 'slice', endingId: 'SLICE_END', steps: [{ action: 'interact', id: 'watch' }] }]);

    const report = checkProject(workspace, true);
    assert.deepEqual(report.errors, []);
    assert.equal(report.valid, true);
    assert.equal(report.scope, 'scene-slice');
    assert.match(productionPrompt(process.cwd(),workspace,{},{}), /统一美术是正式交付条件/);
    const savedDesign=JSON.parse(readFileSync(path.join(workspace,'design.json'),'utf8'));
    writeJson('design.json',{mechanics:[]});
    assert.ok(checkProject(workspace,true).errors.some(error=>error.includes('统一美术规格')));
    assert.equal(checkProject(workspace,false).valid,true,'graybox remains available before art production');
    writeJson('design.json',savedDesign);

    writeFileSync(path.join(workspace, 'sources', 'game-content.yaml'), sourceText + '\n');
    const stale = checkProject(workspace, true);
    assert.equal(stale.valid, false);
    assert.match(stale.errors.join('\n'), /源哈希与当前内容 YAML 不一致/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
