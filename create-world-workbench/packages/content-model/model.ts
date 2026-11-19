import { parseContentYaml } from './parse.js';
import { extractEntities } from './extract.js';
import type { ContentDocument, ContentEntity, IncomingRef } from './types.js';

/**
 * Build the queryable model from a content document. The YAML string is kept
 * for hashing and for diagnostics; consumers should use entities and refs.
 */
export function buildContentModel(text: string, sourcePath = 'sources/game-content.yaml'): ContentDocument {
  const parsed = parseContentYaml(text, sourcePath);
  const warnings = [...parsed.warnings];
  const entities = extractEntities(parsed.raw, warnings);
  const byId = new Map<string, ContentEntity>();
  for (const entity of entities) byId.set(entity.id, entity);

  const incoming = new Map<string, IncomingRef[]>();
  const warned = new Set<string>();
  for (const entity of entities) {
    for (const ref of entity.refs) {
      if (ref.role === 'player') continue;
      const list = incoming.get(ref.id) || [];
      list.push({ from: entity.id, ref });
      incoming.set(ref.id, list);
      if (!byId.has(ref.id) && ref.role !== 'unknown') {
        const key = `${entity.id}:${ref.id}`;
        if (!warned.has(key)) {
          warned.add(key);
          warnings.push(`${entity.id} 引用了不存在的 ${ref.role} ${ref.id}（${ref.via}）`);
        }
      }
    }
  }

  const mainline = Array.isArray(parsed.raw['主线'])
    ? (parsed.raw['主线'] as unknown[]).filter((id): id is string => typeof id === 'string')
    : [];
  for (const id of mainline) {
    if (!byId.has(id)) warnings.push(`主线引用了不存在的 ID：${id}`);
  }

  return {
    specVersion: parsed.specVersion,
    sourcePath,
    sourceHash: parsed.hash,
    text,
    chars: parsed.chars,
    lines: parsed.lines,
    raw: parsed.raw,
    entities,
    byId,
    incoming,
    mainline,
    warnings,
  };
}

export function listByType(document: ContentDocument, type: ContentEntity['type']): ContentEntity[] {
  return document.entities.filter(entity => entity.type === type);
}

export function queryEntity(document: ContentDocument, id: string) {
  const entity = document.byId.get(id);
  if (!entity) {
    const normalized = id.trim();
    const suggestions = normalized
      ? document.entities.filter(item => item.id.includes(normalized) || item.name.includes(normalized)).slice(0, 5).map(item => item.id)
      : [];
    throw new Error(`内容档案中不存在 ID：${id}${suggestions.length ? `；相近 ID：${suggestions.join('、')}` : ''}`);
  }
  return {
    id: entity.id,
    type: entity.type,
    subtype: entity.subtype,
    name: entity.name,
    payload: entity.data,
    refs: entity.refs,
    incoming: document.incoming.get(entity.id) || [],
    hash: entity.hash,
  };
}
