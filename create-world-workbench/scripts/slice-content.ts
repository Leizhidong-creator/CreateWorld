#!/usr/bin/env node
/**
 * Build a scene slice from a content YAML without starting a production run.
 *
 *   npm run content:slice -- ../content-spec/high-wall-beyond.game.yaml S_LIVING
 *   npm run content:slice -- <yaml> <sceneId> <outDir>
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  buildContentModel,
  buildSceneSlice,
  validateSliceDocument,
  writeSceneSlice,
} from '../packages/content-model/index.js';

const [source, sceneId, out] = process.argv.slice(2);
if (!source || !sceneId) {
  console.error('用法：npm run content:slice -- <内容YAML> <场景ID> [输出目录]');
  process.exit(2);
}
const absolute = path.resolve(source);
if (!fs.existsSync(absolute)) {
  console.error(`找不到内容 YAML：${absolute}`);
  process.exit(2);
}
try {
  const document = buildContentModel(fs.readFileSync(absolute, 'utf8'), source);
  const slice = buildSceneSlice(document, { sceneId });
  const validation = validateSliceDocument(slice);
  if (!validation.valid) {
    console.error('切片校验失败：');
    for (const error of validation.errors) console.error('- ' + error);
    process.exit(1);
  }
  const target = path.resolve(out || path.join('data', 'slices', sceneId));
  fs.mkdirSync(target, { recursive: true });
  writeSceneSlice(target, slice);
  console.log(JSON.stringify({
    sceneId: slice.sceneId,
    entry: slice.entry,
    events: slice.events,
    boundary: slice.boundary,
    metrics: slice.metrics,
    included: Object.fromEntries(Object.entries(slice.included).filter(([, ids]) => ids.length).map(([type, ids]) => [type, ids.length])),
    referenced: slice.referenced.map(item => `${item.id}(${item.reason})`),
    warnings: slice.warnings,
    output: target,
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
