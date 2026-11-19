import {packSpriteGrid} from './sprites.js';
import { AssetCheckError, AssetRetryHistory, diagnoseAssetFailure, sceneReviewScope, type SceneContentOwnership } from './workflow.js';
import { CandidateCheckpoints } from './candidate-checkpoint.js';
import {skillFileHash} from '../skill-adapters/skill-integrity.js';
import { access, readFile, writeFile, mkdir, realpath, lstat, rename, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { isSafeRelativeAssetPath, validateAssetPlan, normalizeChange, ADAPTER_VERSION, type ChangeInput } from '../skill-adapters/index.js';

type Json = Record<string, any>;
export interface AssetTask {
  id: string; kind: 'scene' | 'character' | 'action' | 'prop'; prompt: string; path: string; width: number; height: number;
  entityId?: string; frameLayout?: Json; qaRequired?: string[]; [key: string]: unknown;
  sceneContent?: SceneContentOwnership;
  /** Revalidate an existing host-captured candidate; never invokes image generation. */
  resumeCandidate?: string;
}
export interface ModelAssetRequest { prompt: string; images?: string[]; logDir: string; imageDir?: string; }
export interface ProduceAssetsOptions {
  workspaceDir: string; skillsDir?: string; config: Json; plan: AssetTask[]; knownPlan?: AssetTask[];
  signal?: AbortSignal; onProgress?: (event: Json) => void | Promise<void>;
  runModel: (request: ModelAssetRequest) => Promise<unknown>;
  pythonExecutable?: string;
  /** Host-only durable evidence directory, outside every model-writable workspace. */
  hostEvidenceDir?: string;
  change?: ChangeInput;
}
export interface ProducedAsset {
  id: string; path: string; sha256: string; width: number; height: number; kind: string;
  inputFingerprint: string; sourceInputFingerprint?: string; qa: Json; source: Json; configPatch?: Json; reused?: boolean;
}
export interface AssetProductionResult { assets: ProducedAsset[]; config: Json; policyVersion: string; }
export class AssetProductionError extends Error {
  constructor(message: string, public failures: Json[], public partial: AssetProductionResult) { super(message); this.name = 'AssetProductionError'; }
}
export function isUsageLimitError(message: string): boolean {
  return /usageLimitExceeded|usage_limit_exceeded|you['’]ve hit your usage limit|insufficient_quota|额度(?:已)?(?:耗尽|用尽)/i.test(message);
}
const defaultSkillsDir = fileURLToPath(new URL('../../skills/', import.meta.url));
const json = async (filename: string) => JSON.parse(await readFile(filename, 'utf8'));
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const object = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
const array = (value: unknown): any[] => Array.isArray(value) ? value : [];
const relative = (root: string, filename: string) => path.relative(root, filename).split(path.sep).join('/');
function ensure(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const stable = (value: any): any => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
function aborted(signal?: AbortSignal) { if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('Asset task cancelled'); }
async function exists(filename: string) { try { await access(filename); return true; } catch { return false; } }

/** Reject links at every existing component, even links resolving back inside the project. */
export async function resolveAssetFile(root: string, filename: unknown, mustExist = true): Promise<string> {
  // Model output on Windows may use backslashes; the asset contract is always
  // POSIX-relative, so normalise at the boundary before validating.
  const relativeName = typeof filename === 'string' ? filename.replaceAll('\\', '/') : filename;
  ensure(typeof relativeName === 'string' && isSafeRelativeAssetPath(relativeName), `Unsafe local asset path: ${String(filename)}`);
  const resolvedRoot = path.resolve(root), destination = path.resolve(resolvedRoot, relativeName);
  ensure(!(await lstat(resolvedRoot)).isSymbolicLink(), 'Asset root cannot be a symbolic link');
  const segments = path.relative(resolvedRoot, destination).split(path.sep);
  let cursor = resolvedRoot;
  for (const segment of segments) {
    cursor = path.join(cursor, segment);
    try { ensure(!(await lstat(cursor)).isSymbolicLink(), `Symbolic links are not accepted: ${filename}`); }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  }
  if (mustExist) {
    const actual = await realpath(destination), base = await realpath(resolvedRoot);
    const rel = path.relative(base, actual);
    ensure(rel && !rel.startsWith('..') && !path.isAbsolute(rel), 'Asset escaped project workspace');
    ensure((await lstat(actual)).isFile(), 'Expected a regular asset file');
  }
  return destination;
}
async function jobFile(workspace: string, jobDir: string, value: unknown): Promise<string> {
  const filename = await resolveAssetFile(workspace, value);
  const rel = path.relative(jobDir, filename);
  ensure(rel && !rel.startsWith('..') && !path.isAbsolute(rel), 'Generated masters and specs must remain in the current asset job');
  return filename;
}
async function saveJson(filename: string, value: unknown) { await mkdir(path.dirname(filename), { recursive: true }); await writeFile(filename, JSON.stringify(value, null, 2) + '\n'); }
async function atomicImage(destination: string, buffer: Buffer) {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, buffer, { flag: 'wx' }); await rename(temporary, destination);
}
function pythonAvailable(command: string): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    const done = (value: boolean) => { if (!settled) { settled = true; resolve(value); } };
    try {
      const child = spawn(command, ['--version'], { stdio: 'ignore' });
      const timer = setTimeout(() => { child.kill('SIGTERM'); done(false); }, 5000); timer.unref();
      child.once('error', () => { clearTimeout(timer); done(false); });
      child.once('close', code => { clearTimeout(timer); done(code === 0); });
    } catch { done(false); }
  });
}
let selectedPython: Promise<string> | undefined;
/**
 * Resolve one interpreter for every asset task. `python3` is often only a
 * Microsoft Store alias on Windows, so probe candidates instead of assuming it.
 */
export function selectPython(override?: string): Promise<string> {
  if (override) return Promise.resolve(override);
  if (process.env.CREATE_WORLD_PYTHON) return Promise.resolve(process.env.CREATE_WORLD_PYTHON);
  selectedPython ??= (async () => {
    const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
    if (await exists(bundled)) return bundled;
    const candidates = process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python'];
    for (const candidate of candidates) if (await pythonAvailable(candidate)) return candidate;
    return candidates[0];
  })();
  return selectedPython;
}
async function runPython(python: string, script: string, args: string[], logPath: string, signal?: AbortSignal): Promise<Json> {
  aborted(signal);
  const startedAt = new Date().toISOString();
  const command = [python, '-B', script, ...args];
  let stdout = '', stderr = '';
  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(python, ['-B', script, ...args], { cwd: path.dirname(logPath), env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let settled = false;
    const finish = (error?: Error, code = 1) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel); error ? reject(error) : resolve(code); };
    const cancel = () => { child.kill('SIGTERM'); const forced = setTimeout(() => child.kill('SIGKILL'), 1000); forced.unref(); };
    const timer = setTimeout(() => { stderr += '\nHost timeout after 180 seconds'; cancel(); }, 180000); timer.unref();
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    child.stdout.on('data', data => { stdout += data; if (stdout.length > 4_000_000) { stderr += '\nOutput limit exceeded'; cancel(); } });
    child.stderr.on('data', data => { stderr += data; if (stderr.length > 1_000_000) cancel(); });
    child.once('error', error => finish(error)); child.once('close', code => finish(undefined, code ?? 1));
  });
  await saveJson(logPath, { command, scriptSha256: sha(await readFile(script)), startedAt, finishedAt: new Date().toISOString(), exitCode, stdout, stderr });
  aborted(signal);
  ensure(exitCode === 0, `Deterministic asset QA failed (${path.basename(script)}): ${(stderr || stdout).slice(-6000)}`);
  try { return JSON.parse(stdout); } catch { throw new Error(`Asset tool did not return JSON: ${path.basename(script)}`); }
}
async function verifySkillTree(skillsDir: string, skillId: string): Promise<Json> {
  const manifest = await json(path.join(skillsDir, 'manifest.json'));
  const record = array(manifest.skills).find(skill => skill.id === skillId);
  ensure(record, `Missing frozen skill: ${skillId}`);
  for (const file of array(record.files)) {
    const filename = await resolveAssetFile(path.join(skillsDir, skillId), file.path);
    ensure(skillFileHash(await readFile(filename),manifest.hashPolicy||'raw') === file.sha256, `Frozen skill changed: ${skillId}/${file.path}`);
  }
  return record;
}
function inputFingerprint(task: AssetTask, config: Json, artFingerprint = 'no-art-direction', skillHash = 'no-skill'): string {
  const { resumeCandidate: ignored, ...artTask } = task;
  const scene = array(config.scenes).find(s => s.id === task.entityId || s.background === task.id);
  const character = array(config.characters).find(c => c.id === task.entityId || c.asset === task.id);
  const characterBase=character?{...character,animations:undefined}:undefined;
  const relevant = task.kind === 'scene' ? scene && { id: scene.id, width: scene.width, height: scene.height, collisions: scene.collisions, walkPolygon: scene.walkPolygon, spawn: scene.spawn, exits: array(scene.exits).map(e => ({ id: e.id, rect: e.rect, spawn: e.spawn })), interactions: array(scene.interactions).map(i => ({ id: i.id, rect: i.rect })), objects: scene.objects } : characterBase;
  return sha(JSON.stringify(stable({ task: artTask, relevant, policy: ADAPTER_VERSION, art: artFingerprint, skill: skillHash })));
}

/**
 * The shared art specification and the actual reference pixels are cache
 * inputs: changing a reference image must invalidate cached art even when the
 * task and game config are unchanged.
 */
async function artDirectionFingerprint(workspace: string): Promise<string> {
  try {
    const design = await json(path.join(workspace, 'design.json'));
    const art = object(design.artDirection);
    const references: any[] = [];
    for (const reference of array(art.referencePaths)) {
      try {
        references.push([reference, sha(await readFile(await resolveAssetFile(workspace, reference)))]);
      } catch {
        references.push([reference, 'missing-or-invalid']);
      }
    }
    return sha(JSON.stringify(stable({ art, references })));
  } catch {
    return sha('no-art-direction');
  }
}

async function skillTreeHashes(skillsDir: string): Promise<(skillId: string) => string> {
  try {
    const manifest = await json(path.join(skillsDir, 'manifest.json'));
    return (skillId: string) => { const skill=array(manifest.skills).find(skill => skill.id === skillId);return String(skill?.productionRevision||skill?.treeSha256||'missing'); };
  } catch {
    return () => 'missing';
  }
}
/** Narrow visual edits cannot expand into an entire asset-plan regeneration. */
export function selectAssetTasks(plan: AssetTask[], change?: ChangeInput): AssetTask[] {
  if (!change) return plan;
  const normalized = normalizeChange(change);
  if (normalized.affectedStages.includes('source') || normalized.affectedStages.includes('design')) return plan;
  if (!normalized.affectedStages.includes('assets')) return [];
  const selected = plan.filter(task => normalized.assetIds.includes(task.id) || normalized.targetIds.includes(task.entityId || ''));
  if (normalized.kind !== 'audio') ensure(selected.length > 0, 'A local visual change must identify its exact existing asset IDs or entity IDs');
  if (normalized.kind === 'character-appearance' && !normalized.affectedStages.includes('content')) ensure(selected.every(task => task.kind === 'character'), 'A clothing-only change cannot regenerate scene artwork');
  return selected.map(task => ({ ...task, changeRequest: normalized.summary }));
}
function applyPatch(config: Json, patch?: Json) {
  if (!patch) return;
  if (patch.scene) {
    const scene = array(config.scenes).find(s => s.id === patch.scene.id);
    if (scene) {
      // A cached art result owns geometry, never current dialogue/actions/conditions.
      for (const key of ['background', 'sourceSize', 'collisions', 'walkPolygon', 'spawn']) if (key in patch.scene) scene[key] = structuredClone(patch.scene[key]);
      for (const key of ['interactions', 'exits']) for (const target of array(scene[key])) {
        const geometry = array(patch.scene[key]).find(item => item.id === target.id);
        if (geometry?.rect) target.rect = structuredClone(geometry.rect);
      }
    }
  }
  if (patch.start && config.start?.scene === patch.start.scene) config.start.position = structuredClone(patch.start.position);
  if(patch.action){const character=array(config.characters).find(c=>c.id===patch.action.characterId);if(character){character.animations={...(character.animations||{}),[patch.action.name]:patch.action.definition};}}
  if (patch.characters) for (const character of patch.characters) { const target = array(config.characters).find(c => c.id === character.id); if (target) Object.assign(target, structuredClone(character)); }
}

async function nativeImageProof(task: AssetTask, record: Json, result: unknown, options: ProduceAssetsOptions, attemptDir: string): Promise<Json> {
  const returned = object(result), calls = array(returned.items).filter(item => item.type === 'imageGeneration');
  const maximum = task.method==='direct-grid'||task.kind==='action'||task.kind==='prop'?3:task.kind === 'character' ? 4 : 2;
  ensure(calls.length > 0 && calls.length <= maximum, `Native imageGeneration evidence required; ${task.kind} permits 1–${maximum} actual calls`);
  const captures = array(returned.images);
  ensure(captures.length > 0 && captures.length <= calls.length, 'Native image outputs are missing or inconsistent with actual calls');
  const captured: Json[] = [];
  for (const capture of captures) {
    ensure(typeof capture.path === 'string' && typeof capture.sha256 === 'string', 'Malformed native image capture');
    const filename = await jobFile(options.workspaceDir, path.join(attemptDir, 'generated'), relative(options.workspaceDir, capture.path));
    const bytes = await readFile(filename);
    ensure(sha(bytes) === capture.sha256, 'Native image bytes changed after provider capture');
    captured.push({ path: relative(options.workspaceDir, filename), sha256: capture.sha256 });
  }
  const raw = task.kind === 'scene'||task.kind==='action'||task.kind==='prop'||task.method==='direct-grid' ? [record.sourceImage] : [record.productionSheet, ...Object.values(object(record.directionOverrides)), ...array(record.frameOverrides).map(override => override.path)];
  if(task.method==='direct-grid')raw.push(...array(record.frameOverrides).map(override=>override.path));
  ensure(raw.length > 0 && raw.every(value => typeof value === 'string'), 'Every master/override needs an unmodified native source image');
  const masters: Json[] = [];
  for (const value of raw) {
    const filename = await jobFile(options.workspaceDir, attemptDir, value), digest = sha(await readFile(filename));
    ensure(captured.some(image => image.sha256 === digest), `Master/override is not an original native image from this task: ${value}`);
    masters.push({ path: relative(options.workspaceDir, filename), sha256: digest });
  }
  return { provider: 'codex-app-server-native-imageGeneration', threadId: returned.threadId || null, model: returned.model || null, callCount: calls.length, callIds: calls.map(item => item.id || null), captured, masters };
}
async function immutableFiles(paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  async function visit(filename: string) {
    const info = await lstat(filename); ensure(!info.isSymbolicLink(), 'QA inputs cannot be symbolic links');
    if (info.isDirectory()) for (const entry of await readdir(filename)) await visit(path.join(filename, entry));
    else if (info.isFile()) result.set(filename, sha(await readFile(filename)));
  }
  for (const filename of paths) await visit(filename);
  return result;
}
async function unchanged(snapshot: Map<string, string>) {
  for (const [filename, digest] of snapshot) ensure(await exists(filename) && (await lstat(filename)).isFile() && !(await lstat(filename)).isSymbolicLink() && sha(await readFile(filename)) === digest, `Visual reviewer modified immutable production/QA input: ${filename}`);
}
export async function verifiedReceipt(asset: ProducedAsset, evidenceDir: string): Promise<boolean> {
  try {
    const receiptId = asset.source?.hostReceipt;
    if (typeof receiptId !== 'string' || !/^[a-f0-9-]{36}$/.test(receiptId)) return false;
    const proof = await json(await resolveAssetFile(evidenceDir, `${receiptId}.json`));
    const { reused: ignored, ...candidate } = asset;
    return proof.version === 1 && JSON.stringify(stable(proof.asset)) === JSON.stringify(stable(candidate));
  } catch { return false; }
}
export function assetBindingErrors(config:Json,plan:AssetTask[]){const errors:string[]=[];for(const task of plan){if(!array(config.assets).some(a=>a.id===task.id&&a.src===task.path))errors.push(`Resource task ${task.id}/${task.path} has no matching game.assets ID and src`);if(task.kind==='scene'&&!array(config.scenes).some(s=>s.id===task.entityId&&s.background===task.id))errors.push(`Scene task ${task.id} is not bound to its scene background`);if(task.kind==='character'&&!array(config.characters).some(c=>c.id===task.entityId&&c.asset===task.id))errors.push(`Character task ${task.id} is not bound to its character asset`);if(task.kind==='action'&&!array(config.characters).some(c=>c.id===task.entityId))errors.push(`Action task ${task.id} has no character`);}return errors;}
export function buildAssetTaskPrompt(task: AssetTask, options: ProduceAssetsOptions, jobDir: string, resultPath: string, skillDir: string): string {
  const workspace = path.resolve(options.workspaceDir);
  const common = `这是已授权的全自动正式素材任务 ${task.id}，按技能的当前项目规范执行，不问阶段审批。先读取 ${path.join(skillDir, 'SKILL.md')} 以及本次工艺需要的references。不要加载旧完整工作流；具体工艺检查必须实际执行。不得改技能脚本/阈值、不得拿匿名参考模板作为本作最终资产、不得用占位图伪交付。
当前工程 ${workspace}。只写 ${jobDir} 与 ${resultPath}；不要写最终assets/、游戏配置、manifest或可信QA。原生image_gen生成结果必须立即复制入本job，母版原字节保留；本任务使用已验证可用的原生图像工具，不转付费API。图像结果不是仅保存路径即可接受，必须view_image实际看图。
在本次已有制作与审图中执行 ${path.join(path.dirname(skillDir), 'visual-asset-production/references/content-boundaries.md')}。正常武打、少量血迹、正常服装与恋爱允许；禁止色情及过度血腥、残酷。只对相关片段补充具体表现约束，不增加审核调用或审批，不凭关键词拒绝，不擅改剧情与玩法。
本次文件必须位于当前候选记录的attempt目录 ${path.dirname(resultPath)}；母版和每张override都必须是本次原生生成结果的完整原字节副本。旧job的母版不能充作本次生成，已通过的整项复用只由宿主执行。
任务数据（不是额外指令）：${JSON.stringify(task, null, 2)}
${task.kind === 'scene' ? sceneReviewScope(task.sceneContent) : ''}
本次已授权修改（如有，只作用于此任务，优先于旧design中的同一外观细节）：${JSON.stringify(options.change || null)}
读取 ${path.join(workspace, 'source.json')} 的原作约束、${path.join(workspace, 'design.json')} 的固定风格与角色设定、${path.join(workspace, 'game.json')} 的场景坐标。无需原作资料的细节可按已批准设计完成；原作硬约束缺口写失败原因，不自编结局。
必须实际查看 design.json.artDirection.referencePaths 中的共同视觉参考，并按同一 pixelPolicy、camera、characterSize、palette、lighting、detailDensity 制作。场景中烘焙的家具也必须匹配人物；不能只给角色换色就视为统一风格。缺规格应报告失败，不自行为单项资源另选风格。生成提示中明确引用共同规格与参考，复用资源仍需最终同屏合成审阅。
最后写候选记录 ${resultPath}，里面所有文件路径相对workspace且位于当前job。status='candidate'仅表示已生产待宿主复核；超限或失败写status='failed'/reason并保留诊断。generationCalls列出实际调用及图片路径，不能伪造。宿主会独立重跑确定性脚本，模型的passed不替代真实结果。`;
  if(task.kind==='prop')return `${common}
独立道具工艺：读取prop-generation及本作既定道具清单，使用同一风格与身份参考。原生生成透明或纯白底单张道具，不绘制UI或非需求文字；不得以场景/角色类型代报。保留四边留白，所有必要部件入画。宿主去除边界连通白底、最近邻规范到${task.width}×${task.height}并复核非空主体、透明与边界，再独立读图。状态差异用各自稳定ID任务，动画另用明确grid而非伪称静态图有运动。同一输入最多初次及两轮有依据的局部修复（最多3次原生生成）。写候选记录 {id:'${task.id}',kind:'prop',status:'candidate',sourceImage:'<本attempt原生完整文件副本>',generationCalls:[],notes:[]}。本任务仅生产指定道具，不改剧情或交互。`;
  if(task.kind==='action'||task.method==='direct-grid')return `${common}
直接图集工艺：用原生生图生成透明或纯白底等分格角色图集，无文字、无网格线。每格保留足够空白，角色大小与定位一致。基础行走为4行4列，行down/left/right/up，列站立/步态A/站立/步态B，非对称服饰各方向独立生成，不盲目镜像。特殊动作按任务grid与events生成，不套用行走相位要求。请实际读图，最多两轮定向修复，最多3次生成；保留原生母版，不用代码画人物。宿主负责去除边界连通白底、最近邻缩放、透明/帧/动作差异检查和独立视觉检查。写候选记录 {id:'${task.id}',kind:'${task.kind}',status:'candidate',sourceImage:'<本attempt原生完整图集副本>',generationCalls:[],notes:[]}。源图尺寸须能被列数和行数整除，不能自行修改母版像素或分格；将原始生图文件复制后引用。
定向修复支持可选frameOverrides:[{direction:'down'|'left'|'right'|'up',index:1|3,path:'<本attempt原生修复图完整副本>',sourceRect?:{left,top,width,height}}]，仅替换明确失败的步态槽。修复图须实际引用本作身份母版，并与基础图一样是本attempt原生工具捕获的完整原文件；sourceRect只声明从完整原生图取哪一格，不自行重画、镜像或组装母版。可在一张原生修复图生成若干有留白的独立姿态，并逐槽声明裁切。宿主核对每张来源后确定性裁切、等比最近邻置入并统一脚点，未替换的槽沿用基础图；独立读图仍检查全部方向的真实相位。基础与修复合计最多3次原生生成，不重置次数。`;
  if (task.kind === 'character') return `${common}
角色协议：虚构brief（character_name,role,appearance,canon_invariants,inferred_details,style_profile='create-world-fixed-v1'）→character_job.py init --brief ... --style-profile create-world-fixed-v1 →原生image_gen→record→build_character_pack.py。每个方向四帧neutral/gait-A/neutral/gait-B；productionSheet是白底3行4列、顺序down/up/right。使用实际项目风格参考；walk-layout-template只控制动作和版式，不能复制其角色。balanced模式保存通过方向，仅按诊断有界补失败方向/缺失动作。不用python画人物，不重涂腿、不变形凑动作。
以cell ${task.frameLayout?.cellWidth || 48}×${task.frameLayout?.cellHeight || 64}执行原pack完整QA，保留输出和diagnostics；不把4×4最终atlas当3×4母版。记录：{id:'${task.id}',kind:'character',status:'candidate',productionSheet:'<job内原始3x4母版>',directionOverrides:{down?,up?,right?},frameOverrides:[{direction:'down'|'up'|'right',index:1|3,path}],styleProfile:'create-world-fixed-v1',frameDurationMs:170,packDir:'<你实际通过的pack目录>',generationCalls:[{phase,path}],notes:[]}。不使用的overrides为空。宿主从相同原始图片重新生成pack并拼4×4 atlas，透明/脚点/相位不能省略。`;
  return `${common}
场景协议：先写collision.json并跑scene_collision.py validate/guide，原生image_gen只生成干净背景。背景无角色/NPC/UI/文字。使用游戏斜俯视正交视角，无地平线、天空或消失点，远近地砖同尺度；不能画成低机位透视庭院。几何引导保持主路线、出口与交互站位。只准按技能在硬性空间失败时有界重试，最多2次生图。可做最近邻分辨率规范化，母版另存并记录变换。最终scene.png必须严格 ${task.width}×${task.height}，coordinate_space相同；碰撞线沿物体地面接触面。
collision.json必须version:1，walkable恰好一个可走多边形（当前runtime仅接受一个walkPolygon，不能静默丢掉其它区域），obstacles支持rect/circle/polygon，foot_body有实际体积；anchors含spawn以及每个出口/交互ID的真实可站立点，id与game.json完全一致。主入口spawn保留原ID语义，不能把交互点藏在障碍中。读取game中player.radius并按源图/world比例设置碰撞体积；宿主还会按运行时居中圆形实体的保守方盒复验。
检查图像后调整几何而不重画碰撞版本，运行scene_collision.py render查看最终scene与红线overlay。记录：{id:'${task.id}',kind:'scene',status:'candidate',scenePath:'<job内最终scene.png>',collisionSpec:'<job内collision.json>',sourceImage:'<原生生成母版>',generationCalls:[{phase,path}],transforms:[],notes:[]}。宿主会独立validate/render并将几何映射回world坐标；若改变锚点会重新编译并真实通关。`;
}
async function visualReview(task: AssetTask, options: ProduceAssetsOptions, attemptDir: string, images: string[], protectedPaths: string[]): Promise<Json> {
  const output = path.join(attemptDir, 'visual-review.json');
  const contentBoundaries = path.join(options.skillsDir || defaultSkillsDir, 'visual-asset-production/references/content-boundaries.md');
  const checks = task.kind==='prop'?['identity','style','stateReadability','transparency','scale']:task.kind==='action'?['identity','style','actionReadability','transparency','anchorAlignment']:task.kind !== 'scene' ? ['identity', 'style', 'directions', 'animationReadability', 'transparency', 'footAlignment'] : ['style', 'projection', 'landmarks', 'routeReadability', 'overlayAlignment', 'noCharactersOrUI'];
  const snapshot = await immutableFiles([...images, ...protectedPaths]);
  let result: unknown;
  try { result = await options.runModel({ logDir: path.join(attemptDir, 'visual-model-log'), images, prompt: `对本次宿主处理后的正式${task.kind === 'prop' ? '道具' : task.kind !== 'scene' ? '角色' : '场景'}图片做独立视觉检查。用读图工具实际查看所附文件；仅凭文件名、QA数字不能回答。不得生图、修改图像/脚本/标准或修改游戏。任务设计：${JSON.stringify(task)}。${task.kind === 'scene' ? sceneReviewScope(task.sceneContent) : ''}。依次检查 ${checks.join(', ')}；逐项写基于实际像素的观察。场景红线需贴合可见地面接触面，门与路真实开放。闭合可走区域外框不是实体墙，本引擎的出口位于区域内部并通过情境键触发转场，不要求外框断口；不得把外框闭合判为出口不可用。数值可达性由宿主程序与真实通关核验，视觉只核对画面。把不妨碍识别和操作的细小瑕疵列为warnings，不据此判整图失败；issues只列需要修复的阻断问题。角色需身份服装一致、基线透明干净；基础行走四方向与两步态可辨，特殊动作按其任务语义核对接触/支撑和帧顺序，不要求四向步态。若未看见图片/无法判断，passed=false并注明原因，不能猜测。
在这同一次审图中读取并执行 ${contentBoundaries}，结合任务语境、图集帧序与已有预览判断色情及过度血腥/残酷；正常武打、少量血迹、普通亲吻和服装不因关键词或露肤拦截。不另起审核或增加固定检查项。普通通过结论简记在已有 evidence；具体越界写入 issues 并令总 passed=false，不伪报风格等检查失败。相关证据不足说明具体缺口，不把未查看当违规或通过，不对无依据联想追加检查。
只写 ${output}：{scope:'model-visual-review',assetId:'${task.id}',passed:boolean,checks:{${checks.map(k => `${k}:{passed:boolean,evidence:string}`).join(',')}},issues:[],warnings:[]}。这是模型视觉证据，不是玩家认可。` }); }
  finally { await unchanged(snapshot); }
  aborted(options.signal);
  ensure(!array(object(result).items).some(item => item.type === 'imageGeneration') && array(object(result).images).length === 0, 'Visual review cannot generate replacement images');
  const review = await json(output);
  ensure(review.scope === 'model-visual-review' && review.assetId === task.id, `Invalid visual review identity for ${task.id}`);
  const incomplete = checks.filter(key => review.checks?.[key]?.passed !== true || typeof review.checks[key].evidence !== 'string' || !review.checks[key].evidence.trim());
  if (review.passed !== true || incomplete.length || array(review.issues).length) throw new AssetCheckError(`Visual QA did not pass for ${task.id}: ${array(review.issues).join('; ')}${incomplete.length ? '; Missing actual visual check: ' + incomplete.join(', ') : ''}`, {
    code: 'visual-review-rejected', owner: 'review', nextAction: '先核对审阅是否越过素材归属、当前状态或把细小瑕疵升级为阻断。修审阅范围后使用 resumeCandidate 重验；确实是画面缺陷才局部修图。',
  });
  return { report: relative(options.workspaceDir, output), sha256: sha(await readFile(output)), passed: true, scope: review.scope };
}

export async function assembleCharacterAtlas(packDir: string, targetPath: string): Promise<{ width: number; height: number; metadata: Json; qa: Json }> {
  const metadata = await json(path.join(packDir, 'character.json')), qa = await json(path.join(packDir, 'qa-report.json'));
  ensure(qa.passed === true && metadata.frame_count === 4, 'Character pack has not passed the original deterministic QA');
  const { width, height } = metadata.cell;
  ensure(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0, 'Invalid character cell metadata');
  const composites: sharp.OverlayOptions[] = [];
  for (const [row, direction] of ['down', 'left', 'right', 'up'].entries()) {
    const filename = await resolveAssetFile(packDir, metadata.directions?.[direction]?.sheet_png);
    const measured = await sharp(filename).metadata();
    ensure(measured.width === width * 4 && measured.height === height && measured.hasAlpha, `Invalid direction sheet: ${direction}`);
    composites.push({ input: filename, left: 0, top: row * height });
  }
  const bytes = await sharp({ create: { width: width * 4, height: height * 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(composites).png().toBuffer();
  await atomicImage(targetPath, bytes);
  return { width: width * 4, height: height * 4, metadata, qa };
}
export function audiblePcmWav(bytes: Buffer): boolean {
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') return false;
  let encoding = 0, bits = 0, data: Buffer | undefined;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(offset + 4), start = offset + 8, end = start + size;
    if (end > bytes.length) return false;
    const chunk = bytes.toString('ascii', offset, offset + 4);
    if (chunk === 'fmt ' && size >= 16) { encoding = bytes.readUInt16LE(start); bits = bytes.readUInt16LE(start + 14); }
    if (chunk === 'data') data = bytes.subarray(start, end);
    offset = end + (size % 2);
  }
  if (encoding !== 1 || !data?.length || ![8, 16, 24, 32].includes(bits)) return false;
  if (bits === 8) return data.some(value => value !== 128);
  return data.some(value => value !== 0);
}
async function provideBasicAudio(options: ProduceAssetsOptions, config: Json, assets: ProducedAsset[]): Promise<void> {
  const originals = fileURLToPath(new URL('../../fixtures/assets/', import.meta.url));
  for (const declared of array(config.assets).filter(asset => asset.type === 'audio')) {
    if (assets.some(asset => asset.id === declared.id)) continue;
    ensure(isSafeRelativeAssetPath(declared.src) && declared.src.endsWith('.wav'), `Audio ${declared.id} needs a local .wav asset; no remote audio generator is configured`);
    const destination = await resolveAssetFile(path.join(options.workspaceDir, 'assets'), declared.src, false);
    const basename = path.basename(declared.src), known = ['ambient.wav', 'tap.wav', 'notice.wav', 'success.wav'];
    let bytes: Buffer | undefined, provenance: Json;
    if (known.includes(basename)) {
      const original = path.join(originals, basename); bytes = await readFile(original);
      provenance = { origin: 'workbench-original-basic-audio', file: `fixtures/assets/${basename}`, sha256: sha(bytes) };
    } else if (await exists(destination)) {
      bytes = await readFile(await resolveAssetFile(path.join(options.workspaceDir, 'assets'), declared.src));
      provenance = { origin: 'provided-local-audio', file: declared.src, sha256: sha(bytes) };
    } else throw new Error(`Missing audio ${declared.id}: supply a local WAV or use ambient.wav/tap.wav/notice.wav/success.wav`);
    ensure(audiblePcmWav(bytes), `Audio ${declared.id} is missing, malformed or digital silence; graybox silence is not a production sound`);
    await atomicImage(destination, bytes);
    assets.push({ id: declared.id, path: declared.src, kind: 'audio', width: 0, height: 0, sha256: sha(bytes), inputFingerprint: sha(JSON.stringify({ id: declared.id, src: declared.src, original: sha(bytes) })), qa: { passed: true, deterministic: { executedBy: 'host', checks: ['riff-wave-structure', 'pcm-data', 'non-silent-samples'] }, scope: 'Basic sound decoded/non-silence check; final browser audio loading still required' }, source: provenance });
  }
}
async function produceCharacter(task: AssetTask, record: Json, options: ProduceAssetsOptions, config: Json, jobDir: string, attemptDir: string, skillDir: string, python: string): Promise<ProducedAsset> {
  const source = await jobFile(options.workspaceDir, jobDir, record.productionSheet);
  const frame = object(task.frameLayout), cellWidth = frame.cellWidth, cellHeight = frame.cellHeight;
  const args = ['--character-id', task.id, '--production-sheet', source, '--output-dir', path.join(attemptDir, 'host-pack'), '--cell-size', `${cellWidth}x${cellHeight}`, '--frame-duration', String(record.frameDurationMs || 170), '--style-profile', 'create-world-fixed-v1', '--diagnostics', path.join(attemptDir, 'host-motion-diagnostics.json')];
  const sourceFiles = [source];
  for (const direction of ['down', 'up', 'right']) if (record.directionOverrides?.[direction]) { const filename = await jobFile(options.workspaceDir, jobDir, record.directionOverrides[direction]); args.push(`--walk-${direction}`, filename); sourceFiles.push(filename); }
  for (const override of array(record.frameOverrides)) {
    ensure(['down', 'up', 'right'].includes(override.direction) && [1, 3].includes(override.index), 'Invalid frame override; only existing failed action slots may be replaced');
    const filename = await jobFile(options.workspaceDir, jobDir, override.path); args.push('--frame-override', `${override.direction}:${override.index}:${filename}`); sourceFiles.push(filename);
  }
  const result = await runPython(python, path.join(skillDir, 'scripts/build_character_pack.py'), args, path.join(attemptDir, 'host-pack-command.json'), options.signal);
  ensure(typeof result.output_dir === 'string', 'Builder did not return an output directory');
  const builtRelative = path.relative(await realpath(path.join(attemptDir, 'host-pack')), await realpath(result.output_dir));
  ensure(builtRelative && !builtRelative.startsWith('..') && !path.isAbsolute(builtRelative), 'Builder returned unexpected output directory');
  const packDir = result.output_dir;
  const candidate = path.join(attemptDir, 'atlas.png');
  const built = await assembleCharacterAtlas(packDir, candidate);
  ensure(built.width === task.width && built.height === task.height, 'Atlas dimensions disagree with the asset plan');
  const visual = await visualReview(task, options, attemptDir, [candidate, await resolveAssetFile(packDir, built.metadata.turnaround.sheet_png)], [packDir, ...sourceFiles, ...record._hostNativeImages, path.join(attemptDir, 'host-pack-command.json')]);
  const final = await resolveAssetFile(path.join(options.workspaceDir, 'assets'), task.path, false);
  await atomicImage(final, await readFile(candidate));
  const characters = array(config.characters).filter(c => c.id === task.entityId || c.asset === task.id).map(c => ({ id: c.id, asset: task.id, frameWidth: cellWidth, frameHeight: cellHeight, atlas: { columns: 4, rows: { down: 0, left: 1, right: 2, up: 3 }, fps: 1000 / (record.frameDurationMs || 170), idleFrame: 0 }, anchor: { x: built.metadata.foot_anchor.x / cellWidth, y: built.metadata.foot_anchor.y / cellHeight } }));
  ensure(characters.length > 0, `Character asset ${task.id} is not bound to a game character`);
  const patch = { characters }; applyPatch(config, patch);
  return { id: task.id, path: task.path, sha256: sha(await readFile(final)), width: built.width, height: built.height, kind: 'character', inputFingerprint: '', configPatch: patch,
    qa: { passed: true, deterministic: { report: relative(options.workspaceDir, path.join(packDir, 'qa-report.json')), sha256: sha(await readFile(path.join(packDir, 'qa-report.json'))), executedBy: 'host', checks: ['alpha', 'palette', 'dimensions', 'foot-anchor', 'motion-phase', 'animations'] }, visual },
    source: { skill: 'character-generation', job: relative(options.workspaceDir, jobDir), packDir: relative(options.workspaceDir, packDir), masters: await Promise.all(sourceFiles.map(async p => ({ path: relative(options.workspaceDir, p), sha256: sha(await readFile(p)) }))), generationCalls: record.generationCalls, providerLogs: relative(options.workspaceDir, path.join(attemptDir, 'generation-model-log')), mirrorLeft: true } };
}
function point(value: any) { return Array.isArray(value) ? { x: value[0], y: value[1] } : { x: value.x, y: value.y }; }
export function sceneConfigPatch(spec: Json, scene: Json, config: Json): Json {
  ensure(array(spec.walkable).length === 1, 'Runtime supports one walkPolygon; multiple regions cannot be silently dropped');
  const sx = scene.width / spec.coordinate_space.width, sy = scene.height / spec.coordinate_space.height;
  ensure(Number.isFinite(sx) && Number.isFinite(sy) && sx > 0 && sy > 0, 'Scene coordinate mapping is invalid');
  const convert = (p: any) => { const q = point(p); return { x: q.x * sx, y: q.y * sy }; };
  const collisions = array(spec.obstacles).map(obstacle => {
    if (obstacle.shape === 'rect') return { x: obstacle.x * sx, y: obstacle.y * sy, w: obstacle.width * sx, h: obstacle.height * sy };
    if (obstacle.shape === 'circle') { ensure(Math.abs(sx - sy) < 1e-6, 'Nonuniform scaling turns a circle into an unsupported ellipse'); return { type: 'circle', x: obstacle.cx * sx, y: obstacle.cy * sy, r: obstacle.radius * sx }; }
    if (obstacle.shape === 'polygon') return { type: 'polygon', points: array(obstacle.points).map(convert) };
    throw new Error(`Unsupported collision shape ${obstacle.shape}`);
  });
  const anchors = new Map(array(spec.anchors).map(a => [a.id, a]));
  const spawn = array(spec.anchors).find(a => a.kind === 'spawn'); ensure(spawn, 'Scene needs a spawn anchor');
  const moveTarget = (target: Json, kind: string) => { const anchor = anchors.get(target.id); ensure(anchor && anchor.kind === kind, `Missing ${kind} anchor ${target.id}`); const p = convert(anchor); const rect = target.rect || { w: 16, h: 16 }; return { ...target, rect: { ...rect, x: p.x - rect.w / 2, y: p.y - rect.h / 2 } }; };
  const updated = { id: scene.id, sourceSize: { width: spec.coordinate_space.width, height: spec.coordinate_space.height }, collisions, walkPolygon: array(spec.walkable[0].points).map(convert), spawn: convert(spawn), interactions: array(scene.interactions).map(i => moveTarget(i, 'interaction')), exits: array(scene.exits).map(e => moveTarget(e, 'exit')) };
  return { scene: updated, ...(config.start?.scene === scene.id ? { start: { ...config.start, position: convert(spawn) } } : {}) };
}
async function produceScene(task: AssetTask, record: Json, options: ProduceAssetsOptions, config: Json, jobDir: string, attemptDir: string, skillDir: string, python: string): Promise<ProducedAsset> {
  const image = await jobFile(options.workspaceDir, jobDir, record.scenePath), specPath = await jobFile(options.workspaceDir, jobDir, record.collisionSpec), spec = await json(specPath);
  const master = await jobFile(options.workspaceDir, jobDir, record.sourceImage);
  const nativePixels = await sharp(master).resize(task.width, task.height, { fit: 'fill', kernel: 'nearest' }).ensureAlpha().raw().toBuffer();
  const candidatePixels = await sharp(image).ensureAlpha().raw().toBuffer();
  ensure(nativePixels.equals(candidatePixels), 'Scene candidate must preserve native image pixels; only nearest-neighbour size normalization is allowed');
  const measured = await sharp(image).metadata();
  ensure(measured.width === task.width && measured.height === task.height && spec.coordinate_space?.width === task.width && spec.coordinate_space?.height === task.height, 'Final scene image, collision coordinates and planned dimensions must match; preserve and normalize master before QA');
  ensure(spec.foot_body?.width > 0 && spec.foot_body?.height > 0, 'Scene body-clearance QA requires foot_body');
  const scene = array(config.scenes).find(s => s.id === task.entityId || s.background === task.id); ensure(scene, `Scene asset ${task.id} is not bound to a scene`);
  const validateScript = path.join(skillDir, 'scripts/scene_collision.py');
  const reportPath = path.join(attemptDir, 'host-scene-qa.json'), overlayPath = path.join(attemptDir, 'collision-overlay.png');
  const checkGeometry = async (args: string[], log: string) => {
    try { return await runPython(python, validateScript, args, path.join(attemptDir, log), options.signal); }
    catch (error) {
      if (options.signal?.aborted || diagnoseAssetFailure(error).owner === 'environment') throw error;
      throw new AssetCheckError(error instanceof Error ? error.message : String(error), {
        code: 'scene-geometry', owner: 'geometry', nextAction: '沿已有画面修正碰撞、入口或锚点，再用 resumeCandidate 重验；无需重新生图。',
      });
    }
  };
  // render already validates the source geometry and body; do not run it twice.
  await checkGeometry(['render', '--spec', specPath, '--scene', image, '--output', overlayPath, '--report', reportPath], 'host-overlay-command.json');
  // Legacy scene QA anchors the body to its bottom edge. Shift the host-only anchors
  // down by r so its 2r box conservatively contains our runtime's centred circle.
  const bodySpec = structuredClone(spec), radius = config.player?.radius || 7;
  const rx = radius * task.width / scene.width, ry = radius * task.height / scene.height;
  bodySpec.foot_body = { width: rx * 2, height: ry * 2 };
  bodySpec.anchors = array(spec.anchors).map(a => ({ ...a, y: a.y + ry }));
  for (const from of array(config.scenes)) for (const exit of array(from.exits)) if (exit.to === scene.id && exit.spawn) {
    bodySpec.anchors.push({ id: `incoming:${from.id}:${exit.id}`, kind: 'spawn', x: exit.spawn.x * task.width / scene.width, y: exit.spawn.y * task.height / scene.height + ry });
  }
  const bodySpecPath = path.join(attemptDir, 'host-runtime-body-spec.json'); await saveJson(bodySpecPath, bodySpec);
  await checkGeometry(['validate', '--spec', bodySpecPath, '--scene', image, '--report', path.join(attemptDir, 'host-runtime-body-qa.json')], 'host-body-command.json');
  const qa = await json(reportPath), bodyQA = await json(path.join(attemptDir, 'host-runtime-body-qa.json'));
  ensure(qa.ok === true && qa.alignment?.passed === true && bodyQA.body_clearance?.passed === true, 'Scene deterministic geometry/alignment/body QA did not pass');
  const patch = sceneConfigPatch(spec, scene, config);
  const visual = await visualReview(task, options, attemptDir, [image, overlayPath], [master, ...record._hostNativeImages, specPath, bodySpecPath, reportPath, path.join(attemptDir, 'host-runtime-body-qa.json'), path.join(attemptDir, 'host-body-command.json'), path.join(attemptDir, 'host-overlay-command.json')]);
  const final = await resolveAssetFile(path.join(options.workspaceDir, 'assets'), task.path, false);
  await atomicImage(final, await sharp(image).png().toBuffer());
  patch.scene.background = task.id; applyPatch(config, patch);
  return { id: task.id, path: task.path, sha256: sha(await readFile(final)), width: task.width, height: task.height, kind: 'scene', inputFingerprint: '', configPatch: patch,
    qa: { passed: true, deterministic: { executedBy: 'host', report: relative(options.workspaceDir, reportPath), sha256: sha(await readFile(reportPath)), runtimeBodyReport: relative(options.workspaceDir, path.join(attemptDir, 'host-runtime-body-qa.json')), checks: ['geometry', 'body-clearance', 'overlay-pixel-invariants'] }, visual },
    source: { skill: 'scene-generation', job: relative(options.workspaceDir, jobDir), master: { path: relative(options.workspaceDir, master), sha256: sha(await readFile(master)) }, collisionSpec: { path: relative(options.workspaceDir, specPath), sha256: sha(await readFile(specPath)) }, transforms: record.transforms || [], generationCalls: record.generationCalls, providerLogs: relative(options.workspaceDir, path.join(attemptDir, 'generation-model-log')) } };
}
async function produceProp(task:AssetTask,record:Json,options:ProduceAssetsOptions,attemptDir:string):Promise<ProducedAsset>{
 const master=await jobFile(options.workspaceDir,attemptDir,record.sourceImage);
 const packed=await packSpriteGrid(master,{columns:1,rows:1,cellWidth:task.width,cellHeight:task.height,kind:'static',anchor:{x:.5,y:.5}});
 const processed=path.join(attemptDir,'processed.png'),qaFile=path.join(attemptDir,'prop-qa.json');
 await writeFile(processed,packed.bytes);await saveJson(qaFile,packed.qa);
 const visual=await visualReview(task,options,attemptDir,[processed],[master,...record._hostNativeImages,qaFile]);
 const target=await resolveAssetFile(path.join(options.workspaceDir,'assets'),task.path,false);await atomicImage(target,packed.bytes);
 return{id:task.id,path:task.path,sha256:sha(packed.bytes),width:task.width,height:task.height,kind:'prop',inputFingerprint:'',qa:{passed:true,deterministic:packed.qa,visual},source:{skill:'prop-generation',master:{path:relative(options.workspaceDir,master),sha256:sha(await readFile(master))},method:'static-prop'}};
}
async function produceGrid(task:AssetTask,record:Json,options:ProduceAssetsOptions,config:Json,attemptDir:string):Promise<ProducedAsset>{
 const master=await jobFile(options.workspaceDir,attemptDir,record.sourceImage);const grid=object(task.grid),action=task.kind==='action';
 const overrides=[];
 for(const override of array(record.frameOverrides)){
  ensure(!action,'Action overrides require a separately declared action task');
  const row=['down','left','right','up'].indexOf(override.direction);
  ensure(row>=0&&[1,3].includes(override.index),'Only specified walking gait slots may be repaired');
  overrides.push({row,column:override.index,source:await jobFile(options.workspaceDir,attemptDir,override.path),rect:override.sourceRect});
 }
 const packed=await packSpriteGrid(master,{columns:action?grid.columns:4,rows:action?(grid.rows||1):4,cellWidth:grid.cellWidth||48,cellHeight:grid.cellHeight||64,kind:action?'action':'walk',anchor:grid.anchor,fps:grid.fps||8,events:array(task.events)},overrides);
 const processed=path.join(attemptDir,'processed.png');await writeFile(processed,packed.bytes);const qaFile=path.join(attemptDir,'grid-qa.json');await saveJson(qaFile,packed.qa);
 const visual=await visualReview(task,options,attemptDir,[processed],[master,...record._hostNativeImages,qaFile]);const target=await resolveAssetFile(path.join(options.workspaceDir,'assets'),task.path,false);await atomicImage(target,packed.bytes);
 let configPatch:Json;if(action){ensure(typeof task.actionName==='string'&&task.actionName,'Action needs actionName');configPatch={action:{characterId:task.entityId,name:task.actionName,definition:{asset:task.id,frames:packed.metadata.frames,fps:packed.metadata.fps,anchor:packed.metadata.anchor,events:packed.metadata.events||[],loop:false}}};}else{const character=array(config.characters).find(c=>c.id===task.entityId||c.asset===task.id);ensure(character,'Character missing');configPatch={characters:[{id:character.id,asset:task.id,frameWidth:packed.metadata.cellWidth,frameHeight:packed.metadata.cellHeight,atlas:{columns:4,rows:{down:0,left:1,right:2,up:3},idleFrame:0,fps:8},anchor:packed.metadata.anchor}]};}
 applyPatch(config,configPatch);return{id:task.id,path:task.path,sha256:sha(packed.bytes),width:packed.metadata.columns*packed.metadata.cellWidth,height:packed.metadata.rows*packed.metadata.cellHeight,kind:task.kind,inputFingerprint:'',qa:{passed:true,deterministic:packed.qa,visual},source:{skill:'character-generation',master:{path:relative(options.workspaceDir,master),sha256:sha(await readFile(master))},method:'direct-grid'},configPatch};
}
export async function produceAssets(options: ProduceAssetsOptions): Promise<AssetProductionResult> {
  const workspace = path.resolve(options.workspaceDir), skillsDir = options.skillsDir ? path.resolve(options.skillsDir) : defaultSkillsDir;
  // Validate the declared plan before starting any model or image work. This
  // prevents provider metadata (for example agents/openai.yaml) from being
  // mistaken for a writable asset path later in the pipeline.
  const preflight = validateAssetPlan(options.plan);
  ensure(preflight.valid, preflight.errors.join('\n'));
  for (const task of options.plan) ensure(isSafeRelativeAssetPath(task.path), `素材计划路径无效：${task.id} -> ${task.path}`);
  const evidenceDir = path.resolve(options.hostEvidenceDir || path.join(workspace, '..', '.asset-host-evidence'));
  await mkdir(evidenceDir, { recursive: true });
  const evidenceRelative = path.relative(await realpath(workspace), await realpath(evidenceDir));
  ensure(evidenceRelative.startsWith(`..${path.sep}`) || evidenceRelative === '..' || path.isAbsolute(evidenceRelative), 'Host asset evidence must be outside the model-writable workspace');
  ensure(!(await lstat(evidenceDir)).isSymbolicLink(), 'Host asset evidence directory cannot be a symbolic link');
  const plan = selectAssetTasks(options.plan, options.change);
  const bindingErrors=assetBindingErrors(options.config,plan);ensure(!bindingErrors.length,bindingErrors.join('; '));
  const config = structuredClone(options.config), produced: ProducedAsset[] = [], failures: Json[] = [];
  const artFingerprint = await artDirectionFingerprint(workspace), skillHash = await skillTreeHashes(skillsDir);
  const fingerprintFor = (task: AssetTask) => inputFingerprint(task, config, artFingerprint, skillHash(task.kind === 'prop' ? 'prop-generation' : task.kind === 'scene' ? 'scene-generation' : 'character-generation'));
  await mkdir(path.join(workspace, 'assets'), { recursive: true }); await mkdir(path.join(workspace, 'asset-results'), { recursive: true });
  const previous: ProducedAsset[] = [];
  for (const filename of ['assets-manifest.json', 'asset-production.partial.json']) if (await exists(path.join(workspace, filename))) previous.push(...array((await json(path.join(workspace, filename))).assets));
  // A cancelled batch may already have completed individual assets. Recover only their host-verified records.
  for(const file of await readdir(path.join(workspace,'asset-results')))if(file.endsWith('.json')){try{const record=await json(path.join(workspace,'asset-results',file));if(record.status==='passed'&&record.hostAsset)previous.push(record.hostAsset);}catch{}}
  // Carry only intact, previously host-verified assets not regenerated in this call.
  for (const asset of previous) {
    if (produced.some(a => a.id === asset.id) || plan.some(t => t.id === asset.id)) continue;
    const currentTask=options.knownPlan?.find(t=>t.id===asset.id);if(options.knownPlan&&asset.kind!=='audio'&&(!currentTask||![asset.inputFingerprint,asset.sourceInputFingerprint].includes(fingerprintFor(currentTask))))continue;
    try { const filename = await resolveAssetFile(path.join(workspace, 'assets'), asset.path); if (asset.qa?.passed === true && await verifiedReceipt(asset, evidenceDir) && sha(await readFile(filename)) === asset.sha256) { produced.push({ ...asset, reused: true }); applyPatch(config, asset.configPatch); } } catch { /* Changed assets must not enter the accepted manifest. */ }
  }
  const python = await selectPython(options.pythonExecutable);
  const checkpoints = new CandidateCheckpoints(evidenceDir, workspace);
  const verifiedSkills = new Map<string, Promise<Json>>();
  let consecutiveServiceFailures=0;
  for (const task of plan) {
    aborted(options.signal);
    ensure(/^[a-z0-9][a-z0-9._-]{0,80}$/i.test(task.id), 'Asset ID must be a stable filename-safe identifier');
    const fingerprint = fingerprintFor(task);
    const reusable = previous.find(a => a.id === task.id && a.path === task.path && [a.inputFingerprint,a.sourceInputFingerprint].includes(fingerprint) && a.qa?.passed === true);
    if (reusable) {
      try { const filename = await resolveAssetFile(path.join(workspace, 'assets'), task.path); if (await verifiedReceipt(reusable, evidenceDir) && sha(await readFile(filename)) === reusable.sha256) { produced.push({ ...reusable, reused: true }); applyPatch(config, reusable.configPatch); await options.onProgress?.({ assetId: task.id, status: 'reused' }); continue; } } catch { /* Rebuild an unavailable or tampered artifact. */ }
    }
    const skillId = task.kind === 'prop' ? 'prop-generation' : task.kind !== 'scene' ? 'character-generation' : 'scene-generation', skillDir = path.join(skillsDir, skillId);
    const jobDir = path.join(workspace, 'asset-jobs', task.id), resultPath = path.join(workspace, 'asset-results', `${task.id}.json`);
    let attemptDir = path.join(jobDir, `attempt-${Date.now()}-${randomUUID().slice(0, 8)}`);
    const history = await AssetRetryHistory.open(evidenceDir, workspace, task.id, artFingerprint);
    let repairInput = fingerprint;
    let resumableCandidate: string | undefined;
    let generationStarted = false;
    try {
      verifiedSkills.set(skillId, verifiedSkills.get(skillId) || verifySkillTree(skillsDir, skillId));
      const skill = await verifiedSkills.get(skillId)!;
      const identity = { id: task.id, kind: task.kind, path: task.path, width: task.width, height: task.height };
      let candidateRecord: string, record: Json, nativeEvidence: Json;
      if (task.resumeCandidate) {
        candidateRecord = await jobFile(workspace, jobDir, task.resumeCandidate);
        const proof = await checkpoints.read(relative(workspace, candidateRecord));
        ensure(JSON.stringify(proof.identity) === JSON.stringify(identity) && proof.artFingerprint === artFingerprint, 'Candidate checkpoint does not match the resource identity, size or shared art specification');
        record = await json(candidateRecord);
        // Geometry and normalization metadata may be repaired; native sources cannot be swapped.
        for (const key of ['sourceImage', 'productionSheet', 'directionOverrides', 'frameOverrides'])
          ensure(JSON.stringify(stable(record[key])) === JSON.stringify(stable(proof.record[key])), `Candidate repair changed native source: ${key}`);
        nativeEvidence = proof.nativeEvidence;
        resumableCandidate = relative(workspace, candidateRecord);
        const spec = record.collisionSpec ? await jobFile(workspace, path.dirname(candidateRecord), record.collisionSpec) : undefined;
        const output = record.scenePath ? await jobFile(workspace, path.dirname(candidateRecord), record.scenePath) : undefined;
        repairInput = sha(JSON.stringify(stable({ fingerprint, collision: spec ? await json(spec) : null,
          processing: { scenePath: record.scenePath, transforms: record.transforms, styleProfile: record.styleProfile, frameDurationMs: record.frameDurationMs },
          output: output ? sha(await readFile(output)) : null })));
        const blocked = history.decision(repairInput, 'validate');
        if (blocked) throw new AssetCheckError(blocked.nextAction, blocked);
        attemptDir = path.dirname(candidateRecord);
        await options.onProgress?.({ assetId: task.id, status: 'revalidating', candidate: task.resumeCandidate });
      } else {
        const blocked = history.decision(repairInput, 'generate');
        if (blocked) throw new AssetCheckError(blocked.nextAction, blocked);
        await mkdir(attemptDir, { recursive: true });
        await saveJson(path.join(attemptDir, 'task.json'), { task, fingerprint, skill: { id: skillId, version: skill.version, treeSha256: skill.treeSha256 } });
        await history.beginGeneration();
        generationStarted = true;
        await options.onProgress?.({ assetId: task.id, status: 'running', kind: task.kind });
        candidateRecord = path.join(attemptDir, 'candidate.json');
        const modelResult = await options.runModel({ prompt: buildAssetTaskPrompt(task, options, jobDir, candidateRecord, skillDir), logDir: path.join(attemptDir, 'generation-model-log'), imageDir: path.join(attemptDir, 'generated') });
        aborted(options.signal);
        record = await json(candidateRecord);
        ensure(record.id === task.id && record.kind === task.kind && record.status === 'candidate', `Asset model did not complete candidate ${task.id}: ${record.reason || 'missing/wrong identity or status'}`);
        nativeEvidence = await nativeImageProof(task, record, modelResult, options, attemptDir);
        await checkpoints.save(relative(workspace, candidateRecord), { identity, artFingerprint, record, nativeEvidence });
        resumableCandidate = relative(workspace, candidateRecord);
      }
      ensure(record.id === task.id && record.kind === task.kind && record.status === 'candidate', `Asset model did not complete candidate ${task.id}: ${record.reason || 'missing/wrong identity or status'}`);
      for (const raw of [...nativeEvidence.captured, ...nativeEvidence.masters]) ensure(sha(await readFile(await resolveAssetFile(workspace, raw.path))) === raw.sha256, 'Native image evidence changed before validation');
      record._hostNativeImages = nativeEvidence.captured.map((item: Json) => path.join(workspace, item.path));
      await saveJson(resultPath, { ...record, attempt: relative(workspace, attemptDir), status: 'validating' });
      const asset = task.kind==='prop' ? await produceProp(task,record,options,attemptDir) : task.kind==='action'||task.method==='direct-grid' ? await produceGrid(task,record,options,config,attemptDir) : task.kind === 'character' ? await produceCharacter(task, record, options, config, jobDir, attemptDir, skillDir, python) : await produceScene(task, record, options, config, jobDir, attemptDir, skillDir, python);
      for (const raw of [...nativeEvidence.captured, ...nativeEvidence.masters]) ensure(sha(await readFile(await resolveAssetFile(workspace, raw.path))) === raw.sha256, 'Native image evidence changed during validation');
      asset.sourceInputFingerprint = fingerprint;
      asset.inputFingerprint = fingerprintFor(task);
      asset.source.nativeEvidence = nativeEvidence;
      asset.source.hostReceipt = randomUUID();
      await saveJson(path.join(evidenceDir, `${asset.source.hostReceipt}.json`), { version: 1, verifiedAt: new Date().toISOString(), asset });
      produced.push(asset);consecutiveServiceFailures=0;
      await history.succeeded();
      await saveJson(resultPath, { ...record, status: 'passed', hostAsset: asset });
      await options.onProgress?.({ assetId: task.id, status: 'passed', path: asset.path, qa: asset.qa });
    } catch (error) {
      const diagnostic = diagnoseAssetFailure(error);
      if (resumableCandidate) diagnostic.resumeCandidate = resumableCandidate;
      if (options.signal?.aborted && generationStarted) await history.cancelGeneration();
      const failure = { assetId: task.id, kind: task.kind, message: error instanceof Error ? error.message : String(error), attempt: relative(workspace, attemptDir), ...diagnostic };
      if (!options.signal?.aborted && !['repeated-asset-failure', 'generation-budget-exhausted', 'existing-candidate-needs-repair'].includes(diagnostic.code)) await history.fail(repairInput, diagnostic, failure.message);
      failures.push(failure); await saveJson(path.join(attemptDir, 'failure.json'), failure); await saveJson(resultPath, { id: task.id, status: options.signal?.aborted ? 'cancelled' : 'failed', ...failure });
      await options.onProgress?.({ ...failure, status: options.signal?.aborted ? 'cancelled' : 'failed' });
      aborted(options.signal);
      if(isUsageLimitError(failure.message)){await options.onProgress?.({status:'blocked',message:'Codex 额度不足，立即停止本批请求；已完成资源保留，额度恢复后可继续原任务。'});break;}
      // A path-safety violation is deterministic for this batch. Retrying all
      // remaining assets only repeats the same provider/path mistake.
      if(/Unsafe local asset path|Generated masters and specs must remain|Native image outputs are missing/i.test(failure.message)){
        await options.onProgress?.({status:'failed',message:'检测到素材路径或原生图片回传格式错误，已停止本批请求，避免重复消耗。'});
        break;
      }
      consecutiveServiceFailures=/超时|没有返回进展|EPIPE|ECONN|Codex 进程结束/.test(failure.message)?consecutiveServiceFailures+1:0;
      if(consecutiveServiceFailures>=2){await options.onProgress?.({status:'failed',message:'连续两项服务失败，停止本批素材请求；已完成资源保留。'});break;}
    }
  }
  const result = { assets: produced, config, policyVersion: ADAPTER_VERSION };
  try { await provideBasicAudio(options, config, produced); }
  catch (error) { failures.push({ assetId: 'audio', kind: 'audio', message: error instanceof Error ? error.message : String(error) }); }
  // A selected batch is not a release. Unselected images may legitimately be
  // produced by later calls; only cw_finish checks the complete declared set.
  // Charging those missing images to every batch falsely trips the retry breaker.
  const requestedIds=new Set(plan.map(task=>task.id));
  for (const declared of array(config.assets).filter(asset=>requestedIds.has(asset.id)||asset.type==='audio')) if (!produced.some(asset => asset.id === declared.id && asset.path === declared.src) && !failures.some(failure => failure.assetId === declared.id)) failures.push({ assetId: declared.id, message: `Declared asset ${declared.id} lacks a matching host-verified artifact; a graybox or undeclared file is not accepted` });
  for (const asset of produced.filter(asset => asset.kind === 'audio' && !asset.source.hostReceipt)) {
    asset.source.hostReceipt = randomUUID(); await saveJson(path.join(evidenceDir, `${asset.source.hostReceipt}.json`), { version: 1, verifiedAt: new Date().toISOString(), asset });
  }
  await saveJson(path.join(workspace, 'asset-production.partial.json'), { ...result, failures, status: failures.length ? 'failed' : 'passed' });
  if (failures.length) throw new AssetProductionError(`${failures.length} asset task(s) failed strict QA: ${failures.map(f => `${f.assetId}: ${f.message}`).join('; ')}`, failures, result);
  return result;
}
