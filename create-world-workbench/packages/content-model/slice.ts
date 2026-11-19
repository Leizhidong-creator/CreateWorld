import { stringify } from 'yaml';
import type {
  ContentDocument,
  ContentEntity,
  EntityType,
  SceneSlice,
  SceneSliceRequest,
  SliceReference,
  SliceRecord,
} from './types.js';
import { clone, sha256, stableStringify } from './stable.js';

export const ENTITY_TYPES: EntityType[] = [
  'scene', 'character', 'object', 'information', 'state', 'rule', 'sound',
  'mechanic', 'event', 'checkpoint', 'ending', 'collectible', 'source',
  'design', 'decision',
];

const TYPE_ORDER: EntityType[] = [
  'character', 'scene', 'object', 'information', 'state', 'rule', 'sound',
  'mechanic', 'event', 'checkpoint', 'ending', 'collectible', 'source',
  'design', 'decision',
];

const SECTION_FOR_TYPE: Partial<Record<EntityType, string>> = {
  character: '角色',
  scene: '场景',
  object: '物件',
  information: '信息',
  state: '状态',
  rule: '规则',
  sound: '声音',
  mechanic: '玩法',
  event: '事件',
  checkpoint: '检查点',
  ending: '结局',
  collectible: '收集',
  source: '来源',
  design: '设计记录',
  decision: '用户决定',
};

function idsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
}

function isEventInScene(entity: ContentEntity, sceneId: string): boolean {
  return entity.type === 'event' && idsOf(entity.data['场景引用']).includes(sceneId);
}

function eventNextIds(entity: ContentEntity): string[] {
  return entity.refs.filter(ref => ref.kind === 'next').map(ref => ref.id);
}

function eventConditionIds(entity: ContentEntity): string[] {
  return entity.refs.filter(ref => ref.role === 'event' && ref.kind === 'condition').map(ref => ref.id);
}

function sortByMainline(document: ContentDocument): (a: ContentEntity, b: ContentEntity) => number {
  const index = new Map(document.mainline.map((id, position) => [id, position]));
  return (a, b) => (index.get(a.id) ?? 1_000_000) - (index.get(b.id) ?? 1_000_000) || a.id.localeCompare(b.id);
}

function isTitleEntry(entity: ContentEntity): boolean {
  const types = Array.isArray(entity.data['类型']) ? entity.data['类型'] : [];
  return idsOf(entity.data['场景引用']).includes('S_MENU') || types.includes('界面');
}

function reasonFor(id: string, document: ContentDocument, entryId: string, boundaryId: string, entryMode: string): string {
  if (id === entryId) return entryMode === 'runtime-title' ? 'entry-runtime-title' : 'entry-prior-summary';
  const entity = document.byId.get(id);
  if (!entity) return 'unknown-reference';
  if (entity.type === 'scene') return 'outside-scene';
  if (entity.type === 'event') {
    const index = new Map(document.mainline.map((value, position) => [value, position]));
    if ((index.get(id) ?? -1) > (index.get(boundaryId) ?? 1_000_000)) return 'future';
  }
  return 'not-in-slice';
}

function renderBrief(slice: Omit<SceneSlice, 'brief' | 'metrics' | 'hashes' | 'document'>): string {
  const lines: string[] = [];
  lines.push(`# 场景切片：${slice.sceneId}`);
  lines.push('');
  lines.push('> 本文件由宿主按完整内容档案生成。切片是当前工作的唯一内容输入；完整档案只在缺失时按 ID 查询。');
  lines.push('');
  lines.push('## 范围');
  lines.push('');
  lines.push(`- 场景：\`${slice.sceneId}\``);
  lines.push(`- 入口：${slice.entry.mode === 'runtime-title' ? `运行时标题承担 \`${slice.entry.eventId}\`；不要另建菜单场景` : slice.entry.mode === 'prior-summary' ? `从 \`${slice.sceneId}\` 开始；前置 \`${slice.entry.eventId}\` 只作前情摘要，不制作其场景` : `场景事件 \`${slice.entry.eventId}\``}`);
  lines.push(`- 事件窗口：${slice.events.map(id => `\`${id}\``).join(' → ')}`);
  lines.push(`- 边界：\`${slice.boundary.eventId}\` 完成时进入结局 \`${slice.boundary.endingId}\`；不进入切片外场景`);
  lines.push(`- 起点：\`game.start.scene\` 必须是 \`${slice.sceneId}\``);
  lines.push('');
  lines.push('## 规范');
  lines.push('');
  lines.push('- 必读 `content-spec/2D-pixel-story-content-spec.md` 的 §2、§3、§4、§5、§13、§14、§15、§23、§24；其余章节按需，不需要通读全文。');
  lines.push('');
  lines.push('## 必须');
  lines.push('');
  lines.push(`1. 只实现 \`${slice.sceneId}\` 与事件窗口，不扩展其他场景、主线或结局。`);
  lines.push(`2. 在 \`${slice.boundary.eventId}\` 完成时显示结局 \`${slice.boundary.endingId}\`（切片完成页），不得跳转到切片外场景。`);
  lines.push('3. 对白按切片中的语义重新编写，保持人物知识边界与披露边界；不要新增原作事实。');
  lines.push('4. 暂停、继续、刷新恢复和重新开始必须实际可用；切片完成不是完整游戏通关。');
  lines.push('5. 只为画面在场角色生成行走包；仅叙事提及的角色不要求立绘或行走图。');
  lines.push('6. 按场景的“阻挡/用途”实现：不可探索的演出场景不要强行加入摇杆与自由移动；加入交互时必须有明确完成判定。');
  lines.push('');
  lines.push('## 不要');
  lines.push('');
  lines.push('- 不要按“至少 5 个场景 / 完整游戏 / 必须小游戏”的默认规则扩展范围。');
  lines.push('- 不要实现切片之外的场景、事件、玩法、结局或收集内容。');
  lines.push('- 不要把 `项目` / `共通系统` / `验收` 中的远期设定、结局或谜题答案写进对白；这些段落是制作约束，不是可展示文本。');
  lines.push('- 不要把切片中缺失的 ID 当作“没有发生”；需要时用 `cw_content_query` 查询，或记录阻塞。');
  lines.push('');
  lines.push('## 仅引用（不展开）');
  lines.push('');
  if (slice.referenced.length) {
    for (const item of slice.referenced) lines.push(`- \`${item.id}\` (${item.type})${item.name ? ` ${item.name}` : ''} — ${item.reason}`);
  } else {
    lines.push('- 无');
  }
  lines.push('');
  lines.push('## 包含实体');
  lines.push('');
  for (const type of TYPE_ORDER) {
    const ids = slice.included[type];
    if (ids?.length) lines.push(`- ${type}: ${ids.map(id => `\`${id}\``).join('、')}`);
  }
  lines.push('');
  lines.push('## 验收');
  lines.push('');
  lines.push(`- 从标题进入 \`${slice.sceneId}\`，完成事件窗口并到达 \`${slice.boundary.endingId}\`。`);
  lines.push('- 真实键鼠/触屏输入可复现；中途刷新后可继续；重新开始清空本轮切片状态。');
  lines.push('- 生成内容只引用切片内实体或明确列出的仅引用实体。');
  lines.push('- 自动通关时长不代表玩家阅读时长；不得宣称完整游戏已验收。');
  lines.push('');
  lines.push('## 查询');
  lines.push('');
  lines.push('- 完整档案：`sources/game-content.yaml`（只读）。只在切片缺少必要事实时，用 `cw_content_query` 按 ID 查询，不要通读。');
  lines.push('- 机器记录：`slice.json`；本说明：`sources/scene-slice.md`；内容子集：`sources/scene-slice.yaml`。');
  return lines.join('\n') + '\n';
}

/**
 * Compute the minimal closed set for one playable scene window.
 *
 * Closure rules:
 *  - scene/exit targets and next-event targets are references, never included;
 *  - event preconditions are included only when they belong to the same scene;
 *  - characters, objects, information, mechanics, sounds, states, sources and
 *    design notes referenced by included entities are included;
 *  - character relationships and stage-condition events stay references;
 *  - all rules are included as global constraints;
 *  - the boundary is a synthetic ending owned by the slice, not canon.
 */
export function buildSceneSlice(document: ContentDocument, request: SceneSliceRequest): SceneSlice {
  if (!request.sceneId || !request.sceneId.trim()) throw new Error('场景切片缺少 sceneId');
  const scene = document.byId.get(request.sceneId);
  if (!scene || scene.type !== 'scene') throw new Error(`内容档案中不存在场景：${request.sceneId}`);

  const order = sortByMainline(document);
  const sceneEvents = document.entities.filter(entity => isEventInScene(entity, scene.id)).sort(order);
  if (!sceneEvents.length) throw new Error(`场景 ${scene.id} 没有绑定事件，无法生成切片`);

  const hasSameScenePredecessor = (entity: ContentEntity) =>
    eventConditionIds(entity).some(id => {
      const predecessor = document.byId.get(id);
      return predecessor ? isEventInScene(predecessor, scene.id) : false;
    });

  let windowStart = request.entryEventId ? document.byId.get(request.entryEventId) : undefined;
  if (request.entryEventId && (!windowStart || windowStart.type !== 'event')) throw new Error(`入口事件不存在：${request.entryEventId}`);
  if (!windowStart) windowStart = sceneEvents.find(entity => !hasSameScenePredecessor(entity)) || sceneEvents[0];

  let cursor: ContentEntity | undefined = windowStart;
  const visited = new Set<string>();
  while (cursor && !isEventInScene(cursor, scene.id) && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    const next: ContentEntity | undefined = eventNextIds(cursor).map(id => document.byId.get(id)).find(entity => entity && isEventInScene(entity, scene.id));
    cursor = next;
  }
  if (!cursor || !isEventInScene(cursor, scene.id)) throw new Error(`入口事件 ${windowStart.id} 无法到达场景 ${scene.id}`);
  windowStart = cursor;

  const window: string[] = [];
  let current: ContentEntity | undefined = windowStart;
  while (current && !window.includes(current.id)) {
    if (!isEventInScene(current, scene.id)) break;
    window.push(current.id);
    if (request.boundaryEventId && current.id === request.boundaryEventId) break;
    const next: ContentEntity | undefined = eventNextIds(current).map(id => document.byId.get(id)).find(entity => entity && isEventInScene(entity, scene.id));
    current = next;
  }
  if (!window.length) throw new Error(`场景 ${scene.id} 的事件窗口为空`);
  if (request.boundaryEventId && !window.includes(request.boundaryEventId)) {
    throw new Error(`边界事件 ${request.boundaryEventId} 不在场景 ${scene.id} 的连续事件窗口中`);
  }

  const includedEvents = new Set(window);
  const externalEvents = new Set<string>();
  const queue = [...window];
  while (queue.length) {
    const entity = document.byId.get(queue.shift()!);
    if (!entity) continue;
    for (const id of eventConditionIds(entity)) {
      const predecessor = document.byId.get(id);
      if (!predecessor) {
        externalEvents.add(id);
        continue;
      }
      if (!isEventInScene(predecessor, scene.id)) {
        externalEvents.add(predecessor.id);
        continue;
      }
      if (!includedEvents.has(predecessor.id)) {
        includedEvents.add(predecessor.id);
        queue.push(predecessor.id);
      }
    }
  }

  const externalOrdered = [...externalEvents]
    .map(id => document.byId.get(id))
    .filter((entity): entity is ContentEntity => Boolean(entity && entity.type === 'event'))
    .sort(order);
  const entryEvent = request.entryEventId
    ? (document.byId.get(request.entryEventId) as ContentEntity)
    : (externalOrdered[0] || windowStart);
  const entryMode: 'scene' | 'runtime-title' | 'prior-summary' = isEventInScene(entryEvent, scene.id) ? 'scene' : isTitleEntry(entryEvent) ? 'runtime-title' : 'prior-summary';

  const boundaryEventId = request.boundaryEventId || window[window.length - 1];
  const boundaryEvent = document.byId.get(boundaryEventId);
  if (!boundaryEvent) throw new Error(`边界事件不存在：${boundaryEventId}`);
  const endingId = (request.endingId || 'SLICE_END').trim();

  const included = Object.fromEntries(ENTITY_TYPES.map(type => [type, new Set<string>()])) as Record<EntityType, Set<string>>;
  const processQueue: string[] = [];
  const referencedIds = new Set<string>();

  const include = (id: string): boolean => {
    const entity = document.byId.get(id);
    if (!entity || included[entity.type].has(entity.id)) return false;
    included[entity.type].add(entity.id);
    processQueue.push(entity.id);
    return true;
  };

  include(scene.id);
  for (const id of includedEvents) include(id);

  while (processQueue.length) {
    const entity = document.byId.get(processQueue.shift()!);
    if (!entity) continue;
    for (const ref of entity.refs) {
      const target = document.byId.get(ref.id);
      if (!target) {
        referencedIds.add(ref.id);
        continue;
      }
      if (ref.kind === 'exit' || ref.kind === 'next') {
        referencedIds.add(ref.id);
        continue;
      }
      if (entity.type === 'character' && (ref.kind === 'condition' || ref.via.startsWith('关系'))) {
        continue;
      }
      if (entity.type === 'information' && ref.role === 'event') continue;
      if ((entity.type === 'state' || entity.type === 'mechanic' || entity.type === 'collectible') && ref.role === 'event') {
        continue;
      }
      if (ref.role === 'event' || ref.role === 'checkpoint' || ref.role === 'ending') {
        referencedIds.add(ref.id);
        continue;
      }
      if (['character', 'object', 'information', 'mechanic', 'sound', 'state', 'rule', 'collectible', 'source', 'design', 'decision'].includes(ref.role)) {
        include(ref.id);
      }
    }
  }

  // The entry event is not built as a scene, but its sources, design notes and
  // sounds are still part of the slice's context.
  for (const ref of entryEvent.refs) {
    if (ref.role === 'source' || ref.role === 'design' || ref.role === 'sound') include(ref.id);
    else if (ref.role === 'event' || ref.role === 'scene') referencedIds.add(ref.id);
  }

  // Global constraints: every rule applies to the runtime regardless of scene.
  for (const rule of document.entities.filter(entity => entity.type === 'rule')) include(rule.id);
  for (const id of ['V_PHASE', 'V_DONE', 'V_KNOW']) include(id);
  include('CP_START');
  include('SRC_AGENT');

  referencedIds.add(entryEvent.id);
  referencedIds.add(scene.id);
  for (const id of includedEvents) referencedIds.add(id);
  const includedIds = new Set<string>();
  for (const type of ENTITY_TYPES) for (const id of included[type]) includedIds.add(id);

  const referenced: SliceReference[] = [...referencedIds]
    .filter(id => !includedIds.has(id))
    .map(id => {
      const entity = document.byId.get(id);
      return {
        id,
        type: entity?.type || ('unknown' as const),
        name: entity?.name,
        reason: reasonFor(id, document, entryEvent.id, boundaryEventId, entryMode),
      };
    })
    .sort((a, b) => a.reason.localeCompare(b.reason) || a.id.localeCompare(b.id));

  const warnings: string[] = [...document.warnings];
  if (document.raw['初始配置']?.['受控角色引用'] === '无操控') {
    warnings.push('初始配置标记为无操控：本切片按演出/推进实现，不要为了“可玩”强行加入自由移动');
  }
  if (!included.mechanic.size) warnings.push('本切片没有玩法机制，只能验证叙事、转场、存档与构建链路，不能证明交互或素材生产能力');
  if (included.character.size) warnings.push('切片中的角色按叙事提及或演出处理；只有画面在场角色才需要行走包，不要为提及角色生成素材');
  if (entryMode === 'runtime-title') warnings.push(`入口 ${entryEvent.id} 由运行时标题承担，不制作 S_MENU 场景`);
  else if (entryMode === 'prior-summary') warnings.push(`切片从 ${scene.id} 开始；前置事件 ${entryEvent.id} 只作为前情摘要，不制作其场景`);
  if (referenced.some(item => item.type === 'scene')) warnings.push('切片保留了场景出口的仅引用信息；实现时不得进入这些场景');
  warnings.push('完整故事背景未注入切片；需要切片外事实时使用 cw_content_query 查询具体 ID，不得自行补写');

  const ending: Record<string, any> = {
    id: endingId,
    名称: '场景切片完成',
    含义: `完成 ${scene.name} 的场景切片；不是完整游戏结局，也不代表后续主线已完成。`,
    进入条件: { 全部: [{ 类型: '事件完成', 引用: boundaryEventId }] },
    事件引用: [boundaryEventId],
    控制例外: '结束后返回标题或重新开始，不进入切片外场景。',
    结束后: '显示切片完成页；可返回标题、查看已获得信息或重新开始本切片。',
    重播: '可重新开始本切片；不得宣称完成整部游戏。',
    来源: { 依据: ['SRC_AGENT'], 定位: '切片边界', 设计引用: [] },
  };
  const checkpoint: Record<string, any> = {
    id: 'CP_SLICE_END',
    名称: '切片完成',
    建立条件: { 全部: [{ 类型: '事件完成', 引用: boundaryEventId }] },
    恢复场景引用: scene.id,
    恢复目标事件引用: boundaryEventId,
    保留: [],
    重置: [],
    落点说明: '切片事件窗口完成；不进入后续场景。',
    来源: { 依据: ['SRC_AGENT'], 定位: '切片边界', 设计引用: [] },
  };
  included.ending.add(endingId);
  included.checkpoint.add('CP_SLICE_END');
  includedIds.add(endingId);
  includedIds.add('CP_SLICE_END');

  const entityList = (type: EntityType): ContentEntity[] =>
    [...included[type]]
      .filter(id => document.byId.has(id))
      .map(id => document.byId.get(id)!)
      .sort(order);

  const cleanScene = (entity: ContentEntity) => {
    const copy = clone(entity.data);
    copy['出口'] = (Array.isArray(copy['出口']) ? copy['出口'] : []).filter(
      (exit: any) => exit && typeof exit === 'object' && included.scene.has(exit['场景引用']),
    );
    return copy;
  };
  const cleanEvent = (entity: ContentEntity) => {
    const copy = clone(entity.data);
    copy['场景引用'] = idsOf(copy['场景引用']).filter(id => included.scene.has(id));
    copy['后续事件引用'] = idsOf(copy['后续事件引用']).filter(id => included.event.has(id));
    const stripEntry = (node: any): any => {
      if (Array.isArray(node)) return node.map(stripEntry).filter(value => value !== null);
      if (node && typeof node === 'object') {
        if (node['引用'] === entryEvent.id) return null;
        const output: Record<string, any> = {};
        for (const [key, value] of Object.entries(node)) {
          const next = stripEntry(value);
          if (next !== null) output[key] = next;
        }
        return output;
      }
      return node;
    };
    if (copy['前置条件']) copy['前置条件'] = stripEntry(copy['前置条件']);
    return copy;
  };
  const hasOutsideEventCondition = (node: unknown): boolean => {
    if (Array.isArray(node)) return node.some(hasOutsideEventCondition);
    if (node && typeof node === 'object') {
      const record = node as Record<string, any>;
      const reference = record['引用'];
      if (typeof reference === 'string' && /^(?:P|E|F|M)\d/.test(reference) && !included.event.has(reference)) return true;
      return Object.values(record).some(hasOutsideEventCondition);
    }
    return false;
  };
  const cleanCharacter = (entity: ContentEntity) => {
    const copy = clone(entity.data);
    if (Array.isArray(copy['关系'])) {
      copy['关系'] = copy['关系'].filter((relation: any) => relation && included.character.has(relation['角色引用']));
    }
    if (Array.isArray(copy['阶段变化'])) {
      copy['阶段变化'] = copy['阶段变化'].filter((change: any) => !hasOutsideEventCondition(change?.['条件']));
    }
    return copy;
  };
  const cleanState = (entity: ContentEntity) => {
    const copy = clone(entity.data);
    if (typeof copy['变化来源'] === 'string' && /(?:P|E|F|M)\d/.test(copy['变化来源'])) {
      const writers = copy['变化来源'].match(/(?:P|E|F|M)\d+[a-z]?/g) || [];
      if (writers.some((id: string) => !included.event.has(id))) {
        copy['变化来源'] = '切片内仅使用初值；其他阶段变化不在本次范围';
      }
    }
    return copy;
  };

  const initial = clone((document.raw['初始配置'] || {}) as Record<string, any>);
  initial['起始事件引用'] = window[0];
  initial['场景引用'] = scene.id;
  if (Array.isArray(initial['角色在场'])) {
    initial['角色在场'] = initial['角色在场'].filter((item: any) => item && included.character.has(item['角色引用']));
  }
  if (initial['物件归属'] && typeof initial['物件归属'] === 'object') {
    initial['物件归属'] = Object.fromEntries(Object.entries(initial['物件归属']).filter(([id]) => included.object.has(id)));
  }
  if (initial['状态值'] && typeof initial['状态值'] === 'object') {
    initial['状态值'] = Object.fromEntries(Object.entries(initial['状态值']).filter(([id]) => included.state.has(id)));
    const knowledge = initial['状态值']['V_KNOW'];
    if (Array.isArray(knowledge)) {
      initial['状态值']['V_KNOW'] = knowledge.filter((entry: any) =>
        entry && included.information.has(entry['信息引用']) && (entry['主体引用'] === '玩家' || included.character.has(entry['主体引用'])));
    }
  }
  if (initial['认知'] && typeof initial['认知'] === 'object' && Array.isArray(initial['认知']['角色既有知识'])) {
    initial['认知']['角色既有知识'] = initial['认知']['角色既有知识'].filter((entry: any) =>
      entry && included.information.has(entry['信息引用']) && (entry['主体引用'] === '玩家' || included.character.has(entry['主体引用'])));
  }
  initial['事件完成记录'] = [];
  initial['收集记录'] = [];

  const mainline = (Array.isArray(document.raw['主线']) ? document.raw['主线'] : [])
    .filter((id: unknown): id is string => typeof id === 'string' && included.event.has(id));

  const startCheckpoint = document.byId.get('CP_START');
  const checkpoints = startCheckpoint
    ? [{
        ...clone(startCheckpoint.data),
        恢复场景引用: scene.id,
        恢复目标事件引用: window[0],
        落点说明: '切片开始；由运行时标题进入指定场景。',
      }, checkpoint]
    : [checkpoint];

  const sliceAcceptance = {
    范围: `仅 ${scene.id} 场景切片（事件窗口 ${window.join('、')}）；完整游戏验收不适用`,
    必查: [
      `game.start.scene 必须是 ${scene.id}`,
      `完成 ${boundaryEventId} 后进入结局 ${endingId}`,
      '真实键鼠/触屏输入可复现；中途刷新可继续；重新开始清空本轮切片状态',
      '不得引用切片外场景、事件、结局或玩法',
    ],
    不宣称: [
      '不宣称完整游戏已完成',
      '不宣称整部剧情、全部场景或全部结局已验收',
      '自动通关时长不代表玩家阅读和思考时长',
    ],
  };
  const projectSection = clone((document.raw['项目'] || {}) as Record<string, any>);
  projectSection['读取要求'] = '只读取 sources/scene-slice.md 与 sources/scene-slice.yaml；完整内容档案只在 cw_content_query 按 ID 查询时使用，不要通读。';
  if (projectSection['受控角色']) {
    projectSection['受控角色'] = {
      主体引用: projectSection['受控角色']['主体引用'] || '无操控',
      切片说明: '本切片按演出/推进实现，不加入自由移动；切片外的控制例外和结局演出不在本次范围。',
    };
  }
  const sliceDocument: Record<string, any> = {
    规范版本: document.specVersion,
    项目: projectSection,
    用户决定: entityList('decision').map(entity => clone(entity.data)),
    来源: entityList('source').map(entity => clone(entity.data)),
    设计记录: entityList('design').map(entity => clone(entity.data)),
    共通系统: clone(document.raw['共通系统'] || {}),
    初始配置: initial,
    角色: entityList('character').map(cleanCharacter),
    场景: entityList('scene').map(cleanScene),
    物件: entityList('object').map(entity => clone(entity.data)),
    信息: entityList('information').map(entity => clone(entity.data)),
    状态: entityList('state').map(cleanState),
    规则: entityList('rule').map(entity => clone(entity.data)),
    声音: entityList('sound').map(entity => clone(entity.data)),
    玩法: entityList('mechanic').map(entity => clone(entity.data)),
    事件: entityList('event').map(cleanEvent),
    主线: mainline,
    检查点: checkpoints,
    结局: [ending],
    收集: entityList('collectible').map(entity => clone(entity.data)),
    行为记录: clone(document.raw['行为记录'] || {}),
    验收: sliceAcceptance,
  };

  const includedForRecord = Object.fromEntries(
    ENTITY_TYPES.map(type => [type, [...included[type]].filter(id => document.byId.has(id) || id === endingId || id === 'CP_SLICE_END').sort()]),
  ) as Record<EntityType, string[]>;
  includedForRecord.ending = [endingId];
  includedForRecord.checkpoint = [...new Set([...includedForRecord.checkpoint, 'CP_SLICE_END'])].sort();

  const sliceBase: Omit<SceneSlice, 'brief' | 'metrics' | 'hashes' | 'document'> = {
    schemaVersion: 1,
    specVersion: document.specVersion,
    sceneId: scene.id,
    source: {
      path: document.sourcePath,
      sha256: document.sourceHash,
      chars: document.chars,
      lines: document.lines,
    },
    entry: {
      mode: entryMode,
      eventId: entryEvent.id,
      sceneId: entryMode === 'scene' ? scene.id : (idsOf(entryEvent.data['场景引用'])[0] || ''),
      payload: clone(entryEvent.data),
    },
    events: [...includedEvents].sort((a, b) => {
      const index = new Map(document.mainline.map((id, position) => [id, position]));
      return (index.get(a) ?? 1_000_000) - (index.get(b) ?? 1_000_000) || a.localeCompare(b);
    }),
    included: includedForRecord,
    includedIds: [...includedIds].sort(),
    referenced,
    absent: referenced.filter(item => !item.reason.startsWith('entry-')),
    boundary: {
      sceneId: scene.id,
      eventId: boundaryEventId,
      mode: 'ending',
      endingId,
      label: '场景切片完成',
      note: `完成后显示结局 ${endingId}；不进入切片外场景。`,
    },
    acceptance: {
      startScene: scene.id,
      boundaryEventId,
      boundaryEndingId: endingId,
      minScenes: 1,
      maxScenes: 1,
      minigamesRequired: false,
      saveReload: true,
      noOutOfSliceRefs: true,
    },
    warnings,
  };

  const yamlText = stringify(sliceDocument, { lineWidth: 0, aliasDuplicateObjects: false });
  const brief = renderBrief(sliceBase);
  const hashes: Record<string, string> = {};
  for (const id of includedIds) {
    const entity = document.byId.get(id);
    if (entity) hashes[id] = entity.hash;
  }
  hashes[endingId] = sha256(stableStringify(ending));
  hashes['CP_SLICE_END'] = sha256(stableStringify(checkpoint));

  const sliceChars = yamlText.length + brief.length;
  return {
    ...sliceBase,
    brief,
    metrics: {
      fullChars: document.chars,
      sliceChars,
      ratio: Number((sliceChars / document.chars).toFixed(4)),
      tokenEstimate: Math.ceil(sliceChars / 1.6),
      includedEntities: includedIds.size,
      referencedEntities: referenced.length,
    },
    hashes: {
      slice: sha256(yamlText + '\n' + brief),
      entities: hashes,
    },
    document: sliceDocument,
  };
}

export function renderSliceYaml(slice: SceneSlice): string {
  return stringify(slice.document, { lineWidth: 0, aliasDuplicateObjects: false });
}

export function renderSliceBrief(slice: SceneSlice): string {
  return slice.brief;
}

export function sliceRecord(slice: SceneSlice): SliceRecord {
  const { document: _document, brief: _brief, ...record } = slice;
  return record;
}
