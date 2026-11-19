import fs from 'node:fs';
import path from 'node:path';
import type { ContentDocument, SceneSlice, SliceRecord } from './types.js';
import { renderSliceBrief, renderSliceYaml, sliceRecord } from './slice.js';

function writeAtomic(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, text, 'utf8');
  fs.renameSync(temp, file);
}

/** Compact ID index so a full-game agent can plan without reading the full YAML. */
export function renderContentIndex(document: ContentDocument): Record<string, any> {
  const counts: Record<string, number> = {};
  for (const entity of document.entities) counts[entity.type] = (counts[entity.type] || 0) + 1;
  return {
    schemaVersion: 1,
    specVersion: document.specVersion,
    source: {
      path: document.sourcePath,
      sha256: document.sourceHash,
      chars: document.chars,
      lines: document.lines,
    },
    counts,
    mainline: document.mainline,
    entities: document.entities.map(entity => ({
      id: entity.id,
      type: entity.type,
      subtype: entity.subtype,
      name: entity.name,
      scenes: entity.type === 'event' ? (entity.data['场景引用'] || []) : undefined,
    })),
  };
}

export function writeContentIndex(workspace: string, document: ContentDocument): void {
  writeAtomic(path.join(workspace, 'sources', 'content-index.json'), JSON.stringify(renderContentIndex(document), null, 2) + '\n');
}

/** Write the three slice artifacts: machine record, content subset and brief. */
export function writeSceneSlice(workspace: string, slice: SceneSlice): SliceRecord {
  const sources = path.join(workspace, 'sources');
  fs.mkdirSync(sources, { recursive: true });
  writeAtomic(path.join(sources, 'scene-slice.yaml'), renderSliceYaml(slice));
  writeAtomic(path.join(sources, 'scene-slice.md'), renderSliceBrief(slice));
  const record = sliceRecord(slice);
  writeAtomic(path.join(workspace, 'slice.json'), JSON.stringify(record, null, 2) + '\n');
  return record;
}

export function readSliceRecord(workspace: string): SliceRecord | null {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(workspace, 'slice.json'), 'utf8')) as SliceRecord;
    return value && value.schemaVersion === 1 ? value : null;
  } catch {
    return null;
  }
}
