import { parseAllDocuments } from 'yaml';
import { sha256 } from './stable.js';

export const SUPPORTED_SPEC_VERSION = '1.0';
export const MAX_CONTENT_CHARS = 2_000_000;

const TOP_LEVEL_KEYS = new Set([
  '规范版本', '项目', '故事全貌', '用户决定', '来源', '设计记录', '共通系统',
  '初始配置', '角色', '场景', '物件', '信息', '状态', '规则', '声音', '玩法',
  '事件', '主线', '检查点', '结局', '收集', '行为记录', '验收',
]);

const REQUIRED_SECTIONS = ['项目', '角色', '场景', '状态', '事件', '主线'];

export interface ParsedContent {
  specVersion: string;
  raw: Record<string, any>;
  chars: number;
  lines: number;
  hash: string;
  warnings: string[];
}

function describeYamlError(error: any): string {
  const line = error?.linePos?.[0]?.line;
  const col = error?.linePos?.[0]?.col;
  const where = line ? `第 ${line} 行${col ? `第 ${col} 列` : ''}：` : '';
  return where + String(error?.message || error);
}

/**
 * Parse and sanity-check a content document. This deliberately rejects
 * ambiguous YAML (multiple documents, duplicate keys, aliases above a bound)
 * instead of silently guessing.
 */
export function parseContentYaml(text: string, sourcePath = 'sources/game-content.yaml'): ParsedContent {
  if (typeof text !== 'string' || !text.trim()) throw new Error('内容 YAML 为空');
  if (text.length > MAX_CONTENT_CHARS) throw new Error(`内容 YAML 超过 ${MAX_CONTENT_CHARS} 字符上限`);
  const documents = parseAllDocuments(text, { uniqueKeys: true, prettyErrors: true });
  if (documents.length !== 1) throw new Error(`内容 YAML 必须是单个文档，实际为 ${documents.length} 个`);
  const document = documents[0];
  if (document.errors.length) throw new Error('内容 YAML 解析失败：' + describeYamlError(document.errors[0]));
  const raw = document.toJS({ maxAliasCount: 100 }) as unknown;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('内容 YAML 根节点必须是映射');

  const record = raw as Record<string, any>;
  const specVersion = String(record['规范版本'] ?? '').trim();
  if (specVersion !== SUPPORTED_SPEC_VERSION) {
    throw new Error(`不支持的内容规范版本“${specVersion || '缺失'}”，当前只接受 ${SUPPORTED_SPEC_VERSION}`);
  }

  const warnings: string[] = [];
  for (const key of Object.keys(record)) {
    if (!TOP_LEVEL_KEYS.has(key)) warnings.push(`未知顶层字段“${key}”，切片不会使用它`);
  }
  for (const key of REQUIRED_SECTIONS) {
    if (record[key] === undefined) warnings.push(`缺少顶层字段“${key}”`);
  }
  if (!Array.isArray(record['场景']) || !record['场景'].length) throw new Error('内容 YAML 没有场景列表');
  if (!Array.isArray(record['事件']) || !record['事件'].length) throw new Error('内容 YAML 没有事件列表');

  return {
    specVersion,
    raw: record,
    chars: text.length,
    lines: text.split('\n').length,
    hash: sha256(text),
    warnings: warnings.map(message => `${sourcePath}: ${message}`),
  };
}
