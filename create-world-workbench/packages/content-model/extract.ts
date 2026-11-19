import type { ContentEntity, ContentRef, EntityType, RefKind, RefRole } from './types.js';
import { hashEntity } from './stable.js';

const SECTION_TYPES: Record<string, EntityType> = {
  角色: 'character',
  场景: 'scene',
  物件: 'object',
  信息: 'information',
  状态: 'state',
  规则: 'rule',
  声音: 'sound',
  玩法: 'mechanic',
  事件: 'event',
  检查点: 'checkpoint',
  结局: 'ending',
  收集: 'collectible',
  来源: 'source',
  设计记录: 'design',
  用户决定: 'decision',
};

const SKIP_VALUES = new Set(['', '玩家', '无', '无操控', '未进入可见剧情', '旁白', '系统', '未出场']);

const CONDITION_ROLES: Array<[RegExp, RefRole]> = [
  [/事件/, 'event'],
  [/信息/, 'information'],
  [/物件|物品/, 'object'],
  [/场景/, 'scene'],
  [/状态/, 'state'],
  [/玩法|机制/, 'mechanic'],
  [/角色/, 'character'],
];

const ID_PATTERN = /^(?:S_[A-Z0-9_]+|C_[A-Z0-9_]+|O_[A-Z0-9_]+|I_[A-Z0-9_]+|V_[A-Z0-9_]+|R_[A-Z0-9_]+|CP_[A-Z0-9_]+|END\d+|COL\d+|SRC_[A-Z0-9_]+|D\d+|U\d+|A\d+|G\d+|K_[A-Z0-9_]+|P\d+[a-z]?|E\d+[a-z]?|F\d+[a-z]?|M\d+[a-z]?)$/;

const TOKEN_PATTERN = /(?:S_[A-Z0-9_]+|C_[A-Z0-9_]+|O_[A-Z0-9_]+|I_[A-Z0-9_]+|V_[A-Z0-9_]+|R_[A-Z0-9_]+|CP_[A-Z0-9_]+|END\d+|COL\d+|SRC_[A-Z0-9_]+|D\d+|U\d+|A\d+|G\d+|K_[A-Z0-9_]+|P\d+[a-z]?|E\d+[a-z]?|F\d+[a-z]?|M\d+[a-z]?)/g;

export function inferRole(id: string): RefRole {
  if (/^S_/.test(id)) return 'scene';
  if (/^C_/.test(id)) return 'character';
  if (/^O_/.test(id)) return 'object';
  if (/^I_/.test(id)) return 'information';
  if (/^V_/.test(id)) return 'state';
  if (/^R_/.test(id)) return 'rule';
  if (/^A\d+/.test(id)) return 'sound';
  if (/^(?:G\d+|K_)/.test(id)) return 'mechanic';
  if (/^CP_/.test(id)) return 'checkpoint';
  if (/^END\d+/.test(id)) return 'ending';
  if (/^COL\d+/.test(id)) return 'collectible';
  if (/^D\d+/.test(id)) return 'design';
  if (/^U\d+/.test(id)) return 'decision';
  if (/^SRC_/.test(id)) return 'source';
  if (/^(?:P|E|F|M)\d+[a-z]?$/.test(id)) return 'event';
  return 'unknown';
}

function addRef(out: ContentRef[], id: unknown, role: RefRole, kind: RefKind, via: string): void {
  if (typeof id !== 'string') return;
  const value = id.trim();
  if (!value || SKIP_VALUES.has(value)) return;
  if (!ID_PATTERN.test(value)) return;
  if (out.some(ref => ref.id === value && ref.kind === kind && ref.via === via)) return;
  out.push({ id: value, role, kind, via });
}

function addMany(out: ContentRef[], value: unknown, role: RefRole, kind: RefKind, via: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (typeof item === 'string') addRef(out, item, role, kind, `${via}[${index}]`);
      else if (item && typeof item === 'object') walk(item, `${via}[${index}]`, out, false);
    });
    return;
  }
  if (typeof value === 'string') addRef(out, value, role, kind, via);
}

function roleForCondition(type: unknown, id: string): RefRole {
  const text = String(type ?? '');
  for (const [pattern, role] of CONDITION_ROLES) if (pattern.test(text)) return role;
  return inferRole(id);
}

function conditionRefs(node: unknown, via: string, out: ContentRef[]): void {
  if (Array.isArray(node)) {
    node.forEach((item, index) => conditionRefs(item, `${via}[${index}]`, out));
    return;
  }
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, any>;
  if (typeof record['引用'] === 'string') {
    const role = roleForCondition(record['类型'], record['引用']);
    addRef(out, record['引用'], role, 'condition', `${via}.引用`);
  }
  for (const key of ['全部', '任一', '非', '条件']) {
    if (key in record) conditionRefs(record[key], `${via}.${key}`, out);
  }
}

function sourceRefs(node: unknown, via: string, out: ContentRef[]): void {
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, any>;
  addMany(out, record['依据'], 'source', 'source', `${via}.依据`);
  addMany(out, record['设计引用'], 'design', 'design', `${via}.设计引用`);
}

function changeRefs(node: unknown, via: string, out: ContentRef[]): void {
  if (!Array.isArray(node)) return;
  node.forEach((change, index) => {
    if (!change || typeof change !== 'object') return;
    const record = change as Record<string, any>;
    if (typeof record['对象引用'] === 'string') {
      addRef(out, record['对象引用'], inferRole(record['对象引用']), 'change', `${via}[${index}].对象引用`);
    }
    conditionRefs(record['条件'], `${via}[${index}].条件`, out);
    const value = record['值'];
    if (value && typeof value === 'object') {
      addMany(out, value['信息引用'], 'information', 'reference', `${via}[${index}].值.信息引用`);
      addMany(out, value['主体引用'], 'character', 'reference', `${via}[${index}].值.主体引用`);
      addMany(out, value['角色引用'], 'character', 'reference', `${via}[${index}].值.角色引用`);
      addMany(out, value['物件引用'], 'object', 'reference', `${via}[${index}].值.物件引用`);
    }
  });
}

function walk(node: unknown, via: string, out: ContentRef[], parseStrings: boolean): void {
  if (Array.isArray(node)) {
    node.forEach((item, index) => walk(item, `${via}[${index}]`, out, parseStrings));
    return;
  }
  if (typeof node === 'string') {
    if (parseStrings) {
      for (const token of node.match(TOKEN_PATTERN) || []) addRef(out, token, inferRole(token), 'change', via);
    }
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node as Record<string, any>)) walk(value, `${via}.${key}`, out, false);
}

function eventRefs(data: Record<string, any>, out: ContentRef[]): void {
  addMany(out, data['场景引用'], 'scene', 'reference', '场景引用');
  addMany(out, data['角色引用'], 'character', 'reference', '角色引用');
  addMany(out, data['物件引用'], 'object', 'reference', '物件引用');
  addMany(out, data['信息引用'], 'information', 'reference', '信息引用');
  addMany(out, data['玩法引用'], 'mechanic', 'reference', '玩法引用');
  addMany(out, data['后续事件引用'], 'event', 'next', '后续事件引用');
  conditionRefs(data['前置条件'], '前置条件', out);
  changeRefs(data['变化'], '变化', out);
  sourceRefs(data['来源'], '来源', out);
  const expression = data['表达'];
  if (expression && typeof expression === 'object') {
    addMany(out, expression['声音引用'], 'sound', 'reference', '表达.声音引用');
    for (const line of expression['对话语义'] || []) {
      if (!line || typeof line !== 'object') continue;
      const speaker = line['说话者'];
      if (typeof speaker === 'string') addRef(out, speaker, 'character', 'reference', '表达.对话语义.说话者');
    }
  }
}

function sceneRefs(data: Record<string, any>, out: ContentRef[]): void {
  for (const [index, exit] of (data['出口'] || []).entries()) {
    if (!exit || typeof exit !== 'object') continue;
    addMany(out, exit['场景引用'], 'scene', 'exit', `出口[${index}].场景引用`);
    conditionRefs(exit['条件'], `出口[${index}].条件`, out);
  }
  for (const [index, change] of (data['阶段变化'] || []).entries()) {
    if (change && typeof change === 'object') conditionRefs(change['条件'], `阶段变化[${index}].条件`, out);
  }
  sourceRefs(data['来源'], '来源', out);
}

function characterRefs(data: Record<string, any>, out: ContentRef[]): void {
  for (const [index, change] of (data['阶段变化'] || []).entries()) {
    if (change && typeof change === 'object') conditionRefs(change['条件'], `阶段变化[${index}].条件`, out);
  }
  for (const [index, relation] of (data['关系'] || []).entries()) {
    if (relation && typeof relation === 'object') addMany(out, relation['角色引用'], 'character', 'reference', `关系[${index}].角色引用`);
  }
  sourceRefs(data['来源'], '来源', out);
}

function informationRefs(data: Record<string, any>, out: ContentRef[]): void {
  addMany(out, data['关联信息引用'], 'information', 'reference', '关联信息引用');
  addMany(out, data['获知事件引用'], 'event', 'reference', '获知事件引用');
  const update = data['认知更新'];
  if (update && typeof update === 'object') {
    addMany(out, update['主体引用'], 'character', 'reference', '认知更新.主体引用');
    addMany(out, update['信息引用'], 'information', 'reference', '认知更新.信息引用');
  }
  sourceRefs(data['来源'], '来源', out);
}

function mechanicRefs(data: Record<string, any>, out: ContentRef[]): void {
  addMany(out, data['入口事件引用'], 'event', 'reference', '入口事件引用');
  addMany(out, data['声音引用'], 'sound', 'reference', '声音引用');
  sourceRefs(data['来源'], '来源', out);
}

function checkpointRefs(data: Record<string, any>, out: ContentRef[]): void {
  conditionRefs(data['建立条件'], '建立条件', out);
  addMany(out, data['恢复场景引用'], 'scene', 'reference', '恢复场景引用');
  addMany(out, data['恢复目标事件引用'], 'event', 'reference', '恢复目标事件引用');
  sourceRefs(data['来源'], '来源', out);
}

function endingRefs(data: Record<string, any>, out: ContentRef[]): void {
  conditionRefs(data['进入条件'], '进入条件', out);
  addMany(out, data['事件引用'], 'event', 'reference', '事件引用');
  sourceRefs(data['来源'], '来源', out);
}

function designRefs(data: Record<string, any>, out: ContentRef[]): void {
  addMany(out, data['依据'], 'decision', 'reference', '依据');
  sourceRefs(data['来源'], '来源', out);
}

function stateRefs(data: Record<string, any>, out: ContentRef[]): void {
  if (typeof data['变化来源'] === 'string') walk(data['变化来源'], '变化来源', out, true);
  sourceRefs(data['来源'], '来源', out);
}

export function extractRefs(type: EntityType, data: Record<string, any>): ContentRef[] {
  const refs: ContentRef[] = [];
  switch (type) {
    case 'scene': sceneRefs(data, refs); break;
    case 'event': eventRefs(data, refs); break;
    case 'character': characterRefs(data, refs); break;
    case 'information': informationRefs(data, refs); break;
    case 'mechanic': mechanicRefs(data, refs); break;
    case 'checkpoint': checkpointRefs(data, refs); break;
    case 'ending': endingRefs(data, refs); break;
    case 'design': designRefs(data, refs); break;
    case 'state': stateRefs(data, refs); break;
    case 'object':
    case 'rule':
    case 'sound':
    case 'collectible':
    case 'decision':
      sourceRefs(data['来源'], '来源', refs);
      if (type === 'collectible') addMany(refs, data['事件引用'], 'event', 'reference', '事件引用');
      break;
    default:
      sourceRefs(data['来源'], '来源', refs);
      break;
  }
  return refs;
}

function eventSubtype(id: string): string | undefined {
  if (/^P\d/.test(id)) return 'main';
  if (/^M\d/.test(id)) return 'mechanic';
  if (/^E\d/.test(id)) return 'event';
  if (/^F\d/.test(id)) return 'ending';
  return undefined;
}

export function extractEntities(raw: Record<string, any>, warnings: string[]): ContentEntity[] {
  const entities: ContentEntity[] = [];
  const seen = new Set<string>();
  for (const [section, type] of Object.entries(SECTION_TYPES)) {
    const list = raw[section];
    if (!Array.isArray(list)) continue;
    for (const [index, item] of list.entries()) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        warnings.push(`${section}[${index}] 不是对象，已跳过`);
        continue;
      }
      const data = item as Record<string, any>;
      const id = typeof data['id'] === 'string' ? data['id'].trim() : '';
      if (!id) {
        warnings.push(`${section}[${index}] 缺少 id，已跳过`);
        continue;
      }
      if (!ID_PATTERN.test(id)) {
        warnings.push(`${section}[${index}] 的 id“${id}”不符合编号约定`);
      }
      if (seen.has(id)) throw new Error(`内容 YAML 存在重复 ID：${id}`);
      seen.add(id);
      entities.push({
        id,
        type,
        subtype: type === 'event' ? eventSubtype(id) : undefined,
        name: typeof data['名称'] === 'string' ? data['名称'] : id,
        data,
        refs: extractRefs(type, data),
        hash: hashEntity(data),
      });
    }
  }
  return entities;
}

export { SECTION_TYPES };
