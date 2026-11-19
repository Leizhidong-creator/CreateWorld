import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { produceAssets, resolveAssetFile, sceneConfigPatch, selectAssetTasks, audiblePcmWav, selectPython, AssetProductionError, type AssetTask, type ModelAssetRequest } from '../packages/assets/index.js';

const exec = promisify(execFile), root = fileURLToPath(new URL('../', import.meta.url));
const skillsDir = path.join(root, 'skills');
const scenePlan: AssetTask = { id: 'room-art', kind: 'scene', entityId: 'room', prompt: '测试夹具场景，非生产美术', path: 'scenes/room.png', width: 96, height: 96, qaRequired: ['geometry', 'visual'] };
const charPlan: AssetTask = { id: 'hero-art', kind: 'character', entityId: 'hero', prompt: '测试夹具角色，非生产美术', path: 'hero.png', width: 192, height: 256, qaRequired: ['motion-phase', 'alpha'], frameLayout: { columns: 4, rows: { down: 0, left: 1, right: 2, up: 3 }, idleFrame: 0, cellWidth: 48, cellHeight: 64 } };
const sceneConfig = () => ({ player: { radius: 4 }, start: { scene: 'room', position: { x: 24, y: 72 } }, assets: [{ id: 'room-art', type: 'image', src: 'scenes/room.png' }], scenes: [{ id: 'room', background: 'room-art', width: 96, height: 96, collisions: [], interactions: [{ id: 'inspect', rect: { x: 60, y: 68, w: 8, h: 8 } }], exits: [{ id: 'door', rect: { x: 68, y: 68, w: 8, h: 8 } }] }] });
const sceneSpec = () => ({ version: 1, coordinate_space: { width: 96, height: 96 }, collision_model: 'footpoint', foot_body: { width: 8, height: 8 }, walkable: [{ id: 'floor', points: [[2, 2], [93, 2], [93, 93], [2, 93]] }], obstacles: [{ id: 'desk', shape: 'rect', x: 40, y: 20, width: 14, height: 26 }], anchors: [{ id: 'spawn', kind: 'spawn', x: 24, y: 72 }, { id: 'inspect', kind: 'interaction', x: 64, y: 72 }, { id: 'door', kind: 'exit', x: 72, y: 72 }] });
async function temporary(t: any) { const parent = await mkdtemp(path.join(os.tmpdir(), 'cw-assets-test-')), workspace = path.join(parent, 'workspace'); await mkdir(workspace); t.after(() => rm(parent, { recursive: true, force: true })); return workspace; }
/** Explicit fake Codex result; this is a protocol fixture, never native generation evidence. */
async function nativeFixture(request: ModelAssetRequest, source: string, callCount = 1) {
  const bytes = await readFile(source), digest = createHash('sha256').update(bytes).digest('hex');
  await mkdir(request.imageDir!, { recursive: true }); const capture = path.join(request.imageDir!, 'fixture-capture.png'); await writeFile(capture, bytes);
  return { threadId: 'test-fixture-only', model: 'fake-codex-result', status: 'completed', final: '', images: [{ path: capture, sha256: digest }], items: Array.from({ length: callCount }, (_, i) => ({ id: `fixture-${i}`, type: 'imageGeneration', fixture: true })) };
}
async function visualFixture(request: ModelAssetRequest, id: string, kind: 'scene' | 'character') {
  const keys = kind === 'scene' ? ['style', 'projection', 'landmarks', 'routeReadability', 'overlayAlignment', 'noCharactersOrUI'] : ['identity', 'style', 'directions', 'animationReadability', 'transparency', 'footAlignment'];
  // Stubbed model vision is only a validator fixture, never real player/production evidence.
  await writeFile(path.join(path.dirname(request.logDir), 'visual-review.json'), JSON.stringify({ scope: 'model-visual-review', assetId: id, passed: true, checks: Object.fromEntries(keys.map(key => [key, { passed: true, evidence: '自动测试夹具，仅测试宿主验收协议' }])), issues: [] }));
}
test('asset path resolution rejects symlinks and path traversal', async t => {
  const workspace = await temporary(t); await writeFile(path.join(workspace, 'safe.txt'), 'x');
  // A directory junction exercises the same lstat guard without requiring
  // Windows developer mode for file symlinks.
  await symlink(workspace, path.join(workspace, 'linked'), process.platform === 'win32' ? 'junction' : undefined);
  assert.equal(await resolveAssetFile(workspace, 'safe.txt'), path.join(workspace, 'safe.txt'));
  await assert.rejects(resolveAssetFile(workspace, '../secret'), /Unsafe/);
  await assert.rejects(resolveAssetFile(workspace, 'linked/safe.txt'), /Symbolic/);
  await assert.rejects(resolveAssetFile(workspace, 'safe.txt\\..\\secret'), /Unsafe/);
});
test('clothing edits select only the named character even if the model returns the whole plan', () => {
  const selected = selectAssetTasks([scenePlan, charPlan], { kind: 'character-appearance', summary: '主角外套改成蓝色', assetIds: ['hero-art'] });
  assert.deepEqual(selected.map(task => task.id), ['hero-art']); assert.equal(selected[0].changeRequest, '主角外套改成蓝色');
  assert.throws(() => selectAssetTasks([scenePlan, charPlan], { kind: 'character-appearance', summary: '服装修改', assetIds: ['room-art'] }), /clothing-only/);
  assert.deepEqual(selectAssetTasks([scenePlan, charPlan], '仅修改对白措辞'), []);
});
test('scene adapter maps shapes and anchors and refuses unsupported disconnected walkable regions', () => {
  const game = sceneConfig(), spec = sceneSpec(); game.scenes[0].width = 192; game.scenes[0].height = 192;
  const patch = sceneConfigPatch(spec, game.scenes[0], game);
  assert.deepEqual(patch.scene.collisions[0], { x: 80, y: 40, w: 28, h: 52 });
  assert.deepEqual(patch.start.position, { x: 48, y: 144 });
  assert.equal(patch.scene.interactions[0].rect.x, 124);
  assert.throws(() => sceneConfigPatch({ ...spec, walkable: [...spec.walkable, spec.walkable[0]] }, game.scenes[0], game), /silently dropped/);
});
test('host reruns scene geometry, body and overlay QA then reuses the identical verified result', async t => {
  const workspaceDir = await temporary(t); let calls = 0;
  const runModel = async (request: ModelAssetRequest) => {
    calls++;
    if (!request.imageDir) return visualFixture(request, scenePlan.id, 'scene');
    const attempt = path.dirname(request.logDir), image = path.join(attempt, 'scene.png'), spec = path.join(attempt, 'collision.json');
    await sharp({ create: { width: 96, height: 96, channels: 3, background: '#43555d' } }).png().toFile(image);
    await writeFile(spec, JSON.stringify(sceneSpec()));
    await writeFile(path.join(attempt, 'candidate.json'), JSON.stringify({ id: scenePlan.id, kind: 'scene', status: 'candidate', scenePath: path.relative(workspaceDir, image), collisionSpec: path.relative(workspaceDir, spec), sourceImage: path.relative(workspaceDir, image), generationCalls: [{ phase: 'fixture', path: path.relative(workspaceDir, image) }] }));
    return nativeFixture(request, image);
  };
  const result = await produceAssets({ workspaceDir, skillsDir, config: sceneConfig(), plan: [scenePlan], runModel });
  assert.equal(calls, 2); assert.equal(result.assets[0].qa.deterministic.executedBy, 'host'); assert.equal(result.assets[0].qa.passed, true);
  assert.equal(result.config.scenes[0].collisions.length, 1);
  assert.equal((await sharp(path.join(workspaceDir, 'assets/scenes/room.png')).metadata()).width, 96);
  result.config.scenes[0].interactions[0].actions = [{ type: 'flag', key: 'revised-story', value: true }];
  result.config.scenes[0].exits[0].when = { flag: 'revised-condition' };
  // Simulate interruption before the batch manifest was kept: individual host receipts survive.
  await rm(path.join(workspaceDir, 'asset-production.partial.json'));
  const reused = await produceAssets({ workspaceDir, skillsDir, config: result.config, plan: [scenePlan], runModel });
  assert.equal(calls, 2); assert.equal(reused.assets[0].reused, true);
  assert.deepEqual(reused.config.scenes[0].interactions[0].actions, [{ type: 'flag', key: 'revised-story', value: true }]);
  assert.deepEqual(reused.config.scenes[0].exits[0].when, { flag: 'revised-condition' });
});
test('model claims do not bypass failing geometry or preserve a production output', async t => {
  const workspaceDir = await temporary(t); let calls = 0;
  await assert.rejects(produceAssets({ workspaceDir, skillsDir, config: sceneConfig(), plan: [scenePlan], runModel: async request => {
    calls++; const attempt = path.dirname(request.logDir), image = path.join(attempt, 'scene.png'), spec = path.join(attempt, 'collision.json');
    await sharp({ create: { width: 96, height: 96, channels: 3, background: '#43555d' } }).png().toFile(image);
    const invalid = sceneSpec(); invalid.anchors[0].x = 42; invalid.anchors[0].y = 30;
    await writeFile(spec, JSON.stringify(invalid)); await writeFile(path.join(attempt, 'candidate.json'), JSON.stringify({ id: scenePlan.id, kind: 'scene', status: 'candidate', qaPassed: true, scenePath: path.relative(workspaceDir, image), sourceImage: path.relative(workspaceDir, image), collisionSpec: path.relative(workspaceDir, spec), generationCalls: [{ phase: 'fixture' }] }));
    return nativeFixture(request, image);
  } }), AssetProductionError);
  assert.equal(calls, 1); await assert.rejects(access(path.join(workspaceDir, 'assets/scenes/room.png')));
});
async function characterModelFixture(workspaceDir: string, request: ModelAssetRequest, invalid = false) {
  if (!request.imageDir) return visualFixture(request, charPlan.id, 'character');
  const attempt = path.dirname(request.logDir), source = path.join(attempt, 'production.png');
  await exec(await selectPython(), ['-B', '-c', 'import sys; from pathlib import Path; sys.path.insert(0,sys.argv[1]); from test_build_character_pack import make_production_sheet; make_production_sheet(Path(sys.argv[2]),same_leg_directions=("down","up","right") if sys.argv[3]=="bad" else ())', path.join(skillsDir, 'character-generation/scripts'), source, invalid ? 'bad' : 'good'], { env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  await writeFile(path.join(attempt, 'candidate.json'), JSON.stringify({ id: charPlan.id, kind: 'character', status: 'candidate', qaPassed: true, productionSheet: path.relative(workspaceDir, source), styleProfile: 'create-world-fixed-v1', generationCalls: [{ phase: 'test-fixture' }] }));
  return nativeFixture(request, source);
}
test('host rebuilds original character pack then assembles 4x4 atlas and imports the actual foot anchor', async t => {
  const workspaceDir = await temporary(t), config = { assets: [{ id: charPlan.id, type: 'image', src: 'hero.png' }], characters: [{ id: 'hero', asset: charPlan.id, width: 24, height: 32 }] };
  const result = await produceAssets({ workspaceDir, skillsDir, config, plan: [charPlan], runModel: request => characterModelFixture(workspaceDir, request) });
  const metadata = await sharp(path.join(workspaceDir, 'assets/hero.png')).metadata();
  assert.equal(metadata.width, 192); assert.equal(metadata.height, 256); assert.equal(metadata.hasAlpha, true);
  assert.deepEqual(result.config.characters[0].atlas.rows, { down: 0, left: 1, right: 2, up: 3 });
  assert.equal(result.config.characters[0].anchor.y, 61 / 64); assert.equal(result.assets[0].qa.passed, true);
});
test('duplicated gait phases fail the unchanged original character QA despite model pass claims', async t => {
  const workspaceDir = await temporary(t), config = { assets: [{ id: charPlan.id, type: 'image', src: 'hero.png' }], characters: [{ id: 'hero', asset: charPlan.id }] };
  await assert.rejects(produceAssets({ workspaceDir, skillsDir, config, plan: [charPlan], runModel: request => characterModelFixture(workspaceDir, request, true) }), /MOTION_PHASE_FAILED/);
  await assert.rejects(access(path.join(workspaceDir, 'assets/hero.png')));
});
test('basic original WAVs are copied as real sounds and digital silence is rejected', async t => {
  const workspaceDir = await temporary(t); const original = await readFile(path.join(root, 'fixtures/assets/tap.wav'));
  assert.equal(audiblePcmWav(original), true);
  const silent = Buffer.from(original); const data = silent.indexOf(Buffer.from('data')); silent.fill(0, data + 8); assert.equal(audiblePcmWav(silent), false);
  const result = await produceAssets({ workspaceDir, skillsDir, config: { assets: [{ id: 'tap', type: 'audio', src: 'tap.wav' }] }, plan: [], runModel: async () => { throw new Error('audio must not invoke generation'); } });
  assert.equal(result.assets[0].kind, 'audio'); assert.equal(result.assets[0].source.origin, 'workbench-original-basic-audio');
  assert.deepEqual(await readFile(path.join(workspaceDir, 'assets/tap.wav')), original);
});
async function sceneModelFixture(workspaceDir: string, request: ModelAssetRequest, callCount = 1) {
  if (!request.imageDir) return visualFixture(request, scenePlan.id, 'scene');
  const attempt = path.dirname(request.logDir), image = path.join(attempt, 'scene.png'), spec = path.join(attempt, 'collision.json');
  await sharp({ create: { width: 96, height: 96, channels: 3, background: '#43555d' } }).png().toFile(image);
  await writeFile(spec, JSON.stringify(sceneSpec()));
  await writeFile(path.join(attempt, 'candidate.json'), JSON.stringify({ id: scenePlan.id, kind: 'scene', status: 'candidate', scenePath: path.relative(workspaceDir, image), sourceImage: path.relative(workspaceDir, image), collisionSpec: path.relative(workspaceDir, spec), generationCalls: [{ phase: 'fixture-untrusted-model-claim' }] }));
  return nativeFixture(request, image, callCount);
}
test('model-written generation claims cannot replace a native provider result', async t => {
  const workspaceDir = await temporary(t);
  await assert.rejects(produceAssets({ workspaceDir, skillsDir, config: sceneConfig(), plan: [scenePlan], runModel: async request => {
    await sceneModelFixture(workspaceDir, request); return { images: [], items: [] };
  } }), /Native imageGeneration evidence required/);
  await assert.rejects(access(path.join(workspaceDir, 'assets/scenes/room.png')));
});
test('actual provider call count enforces the original scene retry bound', async t => {
  const workspaceDir = await temporary(t);
  await assert.rejects(produceAssets({ workspaceDir, skillsDir, config: sceneConfig(), plan: [scenePlan], runModel: request => sceneModelFixture(workspaceDir, request, 3) }), /permits 1–2 actual calls/);
});
test('a master changed after native capture is rejected even when the candidate claims success', async t => {
  const workspaceDir = await temporary(t);
  await assert.rejects(produceAssets({ workspaceDir, skillsDir, config: sceneConfig(), plan: [scenePlan], runModel: async request => {
    const result = await sceneModelFixture(workspaceDir, request);
    await sharp({ create: { width: 96, height: 96, channels: 3, background: '#abcdef' } }).png().toFile(path.join(path.dirname(request.logDir), 'scene.png'));
    return result;
  } }), /not an original native image/);
});
test('visual reviewer cannot overwrite images or host QA after deterministic validation', async t => {
  const workspaceDir = await temporary(t);
  await assert.rejects(produceAssets({ workspaceDir, skillsDir, config: sceneConfig(), plan: [scenePlan], runModel: async request => {
    const result = await sceneModelFixture(workspaceDir, request);
    if (!request.imageDir) await writeFile(path.join(path.dirname(request.logDir), 'host-scene-qa.json'), JSON.stringify({ ok: true, forged: true }));
    return result;
  } }), /modified immutable production\/QA input/);
  await assert.rejects(access(path.join(workspaceDir, 'assets/scenes/room.png')));
});
test('cache needs the external host receipt and does not trust a modified workspace manifest', async t => {
  const workspaceDir = await temporary(t);
  const result = await produceAssets({ workspaceDir, skillsDir, config: sceneConfig(), plan: [scenePlan], runModel: request => sceneModelFixture(workspaceDir, request) });
  const cached = JSON.parse(await readFile(path.join(workspaceDir, 'asset-production.partial.json'), 'utf8'));
  cached.assets[0].source.nativeEvidence.callCount = 999;
  await writeFile(path.join(workspaceDir, 'asset-production.partial.json'), JSON.stringify(cached));
  let regeneration = 0;
  await assert.rejects(produceAssets({ workspaceDir, skillsDir, config: result.config, plan: [scenePlan], runModel: async () => { regeneration++; throw new Error('fixture: untrusted cache must regenerate'); } }), /untrusted cache must regenerate/);
  assert.equal(regeneration, 1);
});

test('two consecutive service failures stop an asset batch without spending every remaining request',async t=>{
 const workspaceDir=await temporary(t);let calls=0;const plan=['one','two','three'].map(id=>({...scenePlan,id,entityId:id,path:`scenes/${id}.png`}));const config=sceneConfig();config.assets=plan.map(t=>({id:t.id,src:t.path,type:'image'}));config.scenes=plan.map(t=>({...config.scenes[0],id:t.id,background:t.id}));
 await assert.rejects(produceAssets({workspaceDir,skillsDir,config,plan,runModel:async()=>{calls++;throw Error('Codex 连续10分钟没有返回进展；fixture');}}),/没有返回进展/);
 assert.equal(calls,2);const partial=JSON.parse(await readFile(path.join(workspaceDir,'asset-production.partial.json'),'utf8'));assert.equal(partial.status,'failed');assert.ok(partial.failures.some((f:any)=>f.assetId==='one'));
});

test('asset IDs and entity bindings are checked before spending a model request',async t=>{const workspaceDir=await temporary(t);let calls=0;await assert.rejects(produceAssets({workspaceDir,skillsDir,config:sceneConfig(),plan:[{...scenePlan,id:'wrong-id'}],runModel:async()=>{calls++;return {};}}),/no matching game.assets/);assert.equal(calls,0);});

test('an explicit usage limit stops immediately and preserves completed asset receipts',async t=>{
 const workspaceDir=await temporary(t);
 const first=await produceAssets({workspaceDir,skillsDir,config:sceneConfig(),plan:[scenePlan],runModel:request=>sceneModelFixture(workspaceDir,request)});
 const plan=['one','two'].map(id=>({...scenePlan,id,entityId:id,path:`scenes/${id}.png`}));
 const config=structuredClone(first.config);config.assets.push(...plan.map(t=>({id:t.id,src:t.path,type:'image'})));config.scenes.push(...plan.map(t=>({...config.scenes[0],id:t.id,background:t.id})));
 let calls=0;
 await assert.rejects(produceAssets({workspaceDir,skillsDir,config,plan,runModel:async()=>{calls++;throw Error('Codex 未完成: {"codexErrorInfo":"usageLimitExceeded"}');}}),/usageLimitExceeded/);
 assert.equal(calls,1);
 const partial=JSON.parse(await readFile(path.join(workspaceDir,'asset-production.partial.json'),'utf8'));
 assert.equal(partial.status,'failed');assert.equal(partial.assets[0].source.hostReceipt,first.assets[0].source.hostReceipt);assert.equal(partial.assets[0].reused,true);
});

test('changing only a shared art reference invalidates cached artwork',async t=>{
 const workspaceDir=await temporary(t);let calls=0;
 await writeFile(path.join(workspaceDir,'design.json'),JSON.stringify({artDirection:{referencePaths:['art/style.svg']}}));
 await mkdir(path.join(workspaceDir,'art'),{recursive:true});
 await writeFile(path.join(workspaceDir,'art/style.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#334452"/></svg>');
 const run=()=>produceAssets({workspaceDir,skillsDir,config:sceneConfig(),plan:[scenePlan],runModel:request=>{calls++;return sceneModelFixture(workspaceDir,request);}});
 const first=await run();assert.equal(calls,2);assert.notEqual(first.assets[0].reused,true);
 await writeFile(path.join(workspaceDir,'art/style.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#9eafb5"/></svg>');
 const changed=await run();assert.equal(calls,4);assert.notEqual(changed.assets[0].reused,true);
 const unchanged=await run();assert.equal(calls,4);assert.equal(unchanged.assets[0].reused,true);
});

test('static props retain their own kind, native provenance and host receipt without character bindings',async t=>{
 const workspaceDir=await temporary(t);
 const task:AssetTask={id:'poster-art',kind:'prop',entityId:'O_POSTER',path:'props/poster.png',width:32,height:48,prompt:'Protocol fixture only'};
 const config={assets:[{id:task.id,type:'image',src:task.path}],characters:[],scenes:[]};
 let generations=0;
 const runModel=async(request:ModelAssetRequest)=>{
  const attempt=path.dirname(request.logDir);
  if(!request.imageDir){
   await writeFile(path.join(attempt,'visual-review.json'),JSON.stringify({scope:'model-visual-review',assetId:task.id,passed:true,checks:Object.fromEntries(['identity','style','stateReadability','transparency','scale'].map(k=>[k,{passed:true,evidence:'Protocol fixture, not production visual evidence'}])),issues:[]}));
   return {};
  }
  generations++;
  const master=path.join(attempt,'master.png');
  await sharp({create:{width:64,height:96,channels:4,background:'#00000000'}}).composite([{input:await sharp({create:{width:40,height:60,channels:4,background:'#826447'}}).png().toBuffer(),left:12,top:18}]).png().toFile(master);
  await writeFile(path.join(attempt,'candidate.json'),JSON.stringify({id:task.id,kind:'prop',status:'candidate',sourceImage:path.relative(workspaceDir,master),generationCalls:[{phase:'fixture'}]}));
  return nativeFixture(request,master);
 };
 const result=await produceAssets({workspaceDir,skillsDir,config,plan:[task],runModel});
 const asset=result.assets[0];assert.equal(asset.kind,'prop');assert.equal(asset.source.skill,'prop-generation');assert.ok(asset.source.hostReceipt);assert.equal(asset.source.nativeEvidence.callCount,1);
 assert.equal(asset.width,32);assert.equal(asset.height,48);assert.deepEqual(result.config.characters,[]);
 const rgba=await sharp(path.join(workspaceDir,'assets',task.path)).ensureAlpha().raw().toBuffer();assert.equal(rgba[3],0);assert.ok(rgba.some((v,i)=>i%4===3&&v>0));
 const reused=await produceAssets({workspaceDir,skillsDir,config,plan:[task],runModel});assert.equal(generations,1);assert.equal(reused.assets[0].reused,true);
});

test('selected asset batches do not fail for images scheduled in a later batch',async t=>{
 const workspaceDir=await temporary(t),config=sceneConfig();
 config.assets.push({id:'later-art',type:'image',src:'scenes/later.png'});
 const later={...scenePlan,id:'later-art',entityId:'later',path:'scenes/later.png'};
 const result=await produceAssets({workspaceDir,skillsDir,config,plan:[scenePlan],knownPlan:[scenePlan,later],runModel:request=>sceneModelFixture(workspaceDir,request)});
 assert.deepEqual(result.assets.map(a=>a.id),['room-art']);
 assert.ok(result.config.assets.some((a:any)=>a.id==='later-art'));
 const partial=JSON.parse(await readFile(path.join(workspaceDir,'asset-production.partial.json'),'utf8'));
 assert.deepEqual(partial.failures,[]);
});

test('a directed gait override without its own native capture cannot enter a formal atlas',async t=>{
 const workspaceDir=await temporary(t),task={...charPlan,method:'direct-grid'};
 const config={assets:[{id:task.id,type:'image',src:task.path}],characters:[{id:'hero',asset:task.id}],scenes:[]};
 await assert.rejects(produceAssets({workspaceDir,skillsDir,config,plan:[task],runModel:async request=>{
  const attempt=path.dirname(request.logDir),master=path.join(attempt,'master.png'),override=path.join(attempt,'untrusted.png');
  await sharp({create:{width:96,height:128,channels:4,background:'#435460'}}).png().toFile(master);
  await sharp({create:{width:24,height:32,channels:4,background:'#826447'}}).png().toFile(override);
  await writeFile(path.join(attempt,'candidate.json'),JSON.stringify({id:task.id,kind:'character',status:'candidate',sourceImage:path.relative(workspaceDir,master),frameOverrides:[{direction:'left',index:3,path:path.relative(workspaceDir,override)}],generationCalls:[{phase:'fixture'}]}));
  return nativeFixture(request,master);
 }}),/Master\/override is not an original native image/);
});

test('geometry failures repair the captured candidate without spending another image request', async t => {
  const workspaceDir = await temporary(t);
  let generations = 0, reviews = 0, candidate = '';
  const runModel = async (request: ModelAssetRequest) => {
    if (!request.imageDir) { reviews++; return visualFixture(request, scenePlan.id, 'scene'); }
    generations++;
    const result = await sceneModelFixture(workspaceDir, request);
    candidate = path.join(path.dirname(request.logDir), 'candidate.json');
    const specFile = path.join(path.dirname(request.logDir), 'collision.json');
    const spec = sceneSpec(); spec.anchors[0].x = 42; spec.anchors[0].y = 30;
    await writeFile(specFile, JSON.stringify(spec));
    return result;
  };
  const run = (plan: AssetTask[]) => produceAssets({ workspaceDir, skillsDir, config: sceneConfig(), plan, runModel });
  await assert.rejects(run([scenePlan]), (error: any) => {
    assert.equal(error.failures.length, 1); // no duplicate “declared asset missing” failure
    assert.equal(error.failures[0].owner, 'geometry');
    assert.equal(error.failures[0].resumeCandidate, path.relative(workspaceDir, candidate).replaceAll('\\', '/'));
    return true;
  });
  await assert.rejects(run([scenePlan]), (error: any) => error.failures[0].code === 'existing-candidate-needs-repair');
  assert.equal(generations, 1);
  const repairTask = { ...scenePlan, resumeCandidate: path.relative(workspaceDir, candidate) };
  await assert.rejects(run([repairTask]), (error: any) => error.failures[0].owner === 'geometry');
  const specPath = path.join(path.dirname(candidate), 'collision.json');
  await writeFile(specPath, JSON.stringify(JSON.parse(await readFile(specPath, 'utf8')), null, 2));
  const unchanged = JSON.parse(await readFile(candidate, 'utf8')); unchanged.notes = ['Only diagnostic wording changed'];
  await writeFile(candidate, JSON.stringify(unchanged, null, 2));
  await assert.rejects(run([repairTask]), (error: any) => error.failures[0].owner === 'geometry');
  await assert.rejects(run([repairTask]), (error: any) => error.failures[0].code === 'repeated-asset-failure');
  await writeFile(path.join(path.dirname(candidate), 'collision.json'), JSON.stringify(sceneSpec()));
  const repaired = await run([{ ...scenePlan, resumeCandidate: path.relative(workspaceDir, candidate) }]);
  assert.equal(generations, 1); assert.equal(reviews, 1);
  assert.equal(repaired.assets[0].qa.passed, true);
  // render already includes source validate; only the runtime adapter needs a separate check.
  await assert.rejects(access(path.join(path.dirname(candidate), 'host-validate-command.json')));
  const cached = await run([scenePlan]);
  assert.equal(cached.assets[0].reused, true); assert.equal(generations, 1); assert.equal(reviews, 1);
});

test('a rejected visual review can be corrected in scope and rerun on the same original pixels', async t => {
  const workspaceDir = await temporary(t);
  let generations = 0, candidate = '', reject = true;
  const runModel = async (request: ModelAssetRequest) => {
    if (request.imageDir) {
      generations++; candidate = path.join(path.dirname(request.logDir), 'candidate.json');
      return sceneModelFixture(workspaceDir, request);
    }
    if (reject) {
      await visualFixture(request, scenePlan.id, 'scene');
      const file = path.join(path.dirname(request.logDir), 'visual-review.json');
      const review = JSON.parse(await readFile(file, 'utf8'));
      review.passed = false; review.issues = ['fixture: runtime item incorrectly demanded in background'];
      await writeFile(file, JSON.stringify(review)); return {};
    }
    assert.match(request.prompt, /运行时叠加元素：\["poster"\]/);
    return visualFixture(request, scenePlan.id, 'scene');
  };
  const run = (task: AssetTask) => produceAssets({ workspaceDir, skillsDir, config: sceneConfig(), plan: [task], runModel });
  await assert.rejects(run(scenePlan), (error: any) => error.failures[0].owner === 'review');
  reject = false;
  const repaired = await run({ ...scenePlan, sceneContent: { baked: ['desk'], runtime: ['poster'] }, resumeCandidate: path.relative(workspaceDir, candidate) });
  assert.equal(generations, 1); assert.equal(repaired.assets[0].qa.passed, true);
});

test('candidate repair cannot replace native pixels or bypass missing host provenance', async t => {
  const workspaceDir = await temporary(t); let candidate = '', calls = 0;
  const runModel = async (request: ModelAssetRequest) => {
    calls++;
    const result = await sceneModelFixture(workspaceDir, request);
    candidate = path.join(path.dirname(request.logDir), 'candidate.json');
    const spec = sceneSpec(); spec.anchors[0].x = 42; spec.anchors[0].y = 30;
    await writeFile(path.join(path.dirname(candidate), 'collision.json'), JSON.stringify(spec));
    return result;
  };
  const run = (task: AssetTask) => produceAssets({ workspaceDir, skillsDir, config: sceneConfig(), plan: [task], runModel });
  await assert.rejects(run(scenePlan), AssetProductionError);
  const record = JSON.parse(await readFile(candidate, 'utf8'));
  await sharp({ create: { width: 96, height: 96, channels: 3, background: '#ffffff' } }).png().toFile(path.join(workspaceDir, record.sourceImage));
  await assert.rejects(run({ ...scenePlan, resumeCandidate: path.relative(workspaceDir, candidate) }), /Native image evidence changed before validation/);
  assert.equal(calls, 1);
  const forged = path.join(path.dirname(candidate), 'forged.json');
  await writeFile(forged, JSON.stringify(record));
  await assert.rejects(run({ ...scenePlan, resumeCandidate: path.relative(workspaceDir, forged) }), AssetProductionError);
  assert.equal(calls, 1);
});
