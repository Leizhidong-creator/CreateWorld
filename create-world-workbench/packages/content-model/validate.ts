import type { SceneSlice, SliceRecord, SliceValidation } from './types.js';

function idsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
}

/**
 * Internal consistency of the generated slice. A slice must not contain a
 * scene exit or an event link that points outside its own closure.
 */
export function validateSliceDocument(slice: SceneSlice): SliceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const document = slice.document as Record<string, any>;
  const scenes = Array.isArray(document['场景']) ? document['场景'] : [];
  const events = Array.isArray(document['事件']) ? document['事件'] : [];
  const endings = Array.isArray(document['结局']) ? document['结局'] : [];

  if (scenes.length !== 1 || scenes[0]?.id !== slice.sceneId) {
    errors.push(`切片必须只包含场景 ${slice.sceneId}`);
  }
  const sceneIds = new Set(scenes.map((scene: any) => scene?.id).filter(Boolean));
  for (const scene of scenes) {
    for (const exit of scene?.['出口'] || []) {
      if (!sceneIds.has(exit?.['场景引用'])) errors.push(`场景 ${scene.id} 的出口指向切片外场景 ${exit?.['场景引用']}`);
    }
  }
  const eventIds = new Set(events.map((event: any) => event?.id).filter(Boolean));
  for (const event of events) {
    for (const next of idsOf(event?.['后续事件引用'])) {
      if (!eventIds.has(next)) errors.push(`事件 ${event.id} 的后续事件 ${next} 不在切片内`);
    }
    for (const scene of idsOf(event?.['场景引用'])) {
      if (!sceneIds.has(scene)) errors.push(`事件 ${event.id} 引用了切片外场景 ${scene}`);
    }
  }
  if (!eventIds.has(slice.boundary.eventId)) errors.push(`边界事件 ${slice.boundary.eventId} 不在切片事件内`);
  if (!endings.some((ending: any) => ending?.id === slice.boundary.endingId)) {
    errors.push(`切片缺少边界结局 ${slice.boundary.endingId}`);
  }
  if (slice.entry.mode === 'runtime-title' && eventIds.has(slice.entry.eventId)) {
    warnings.push(`入口事件 ${slice.entry.eventId} 被声明为运行时标题，却仍出现在切片事件中`);
  }
  if (new Set(slice.includedIds).size !== slice.includedIds.length) errors.push('切片 includedIds 存在重复');
  if (!/^[0-9a-f]{64}$/.test(slice.source.sha256)) errors.push('切片源哈希格式不正确');
  if (slice.metrics.sliceChars <= 0) errors.push('切片字符数无效');
  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Check the generated game project against the slice contract. This is the
 * scope-aware part that the full-game acceptance pipeline cannot express.
 */
export function validateSliceAgainstGame(slice: SliceRecord, game: any): SliceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!game || typeof game !== 'object') return { valid: false, errors: ['游戏配置无法读取'], warnings };
  if (game.start?.scene !== slice.sceneId) errors.push(`单场景切片的起始场景必须是 ${slice.sceneId}，实际为 ${game.start?.scene || '缺失'}`);
  const scenes = Array.isArray(game.scenes) ? game.scenes : [];
  if (scenes.length !== 1) errors.push(`单场景切片只能包含 1 个场景，实际为 ${scenes.length}`);
  if (scenes.length === 1 && scenes[0]?.id !== slice.sceneId) errors.push(`单场景切片只能包含 ${slice.sceneId}，实际为 ${scenes[0]?.id}`);
  for (const scene of scenes) {
    for (const exit of scene?.exits || []) {
      if (exit?.to !== slice.sceneId) errors.push(`场景 ${scene.id} 的出口 ${exit.id} 指向切片外场景 ${exit.to}`);
    }
  }
  const endings = Array.isArray(game.endings) ? game.endings : [];
  if (!endings.some((ending: any) => ending?.id === slice.boundary.endingId)) {
    errors.push(`游戏缺少切片边界结局 ${slice.boundary.endingId}`);
  }
  if (endings.length > 1) {
    const extras = endings.filter((ending: any) => ending?.id !== slice.boundary.endingId).map((ending: any) => ending?.id);
    errors.push(`单场景切片不应包含额外结局：${extras.join('、')}`);
  }
  if (Array.isArray(game.minigames) && game.minigames.length && !slice.included.mechanic.length) {
    warnings.push('切片未包含玩法档案，但游戏接入了小游戏；请确认不是越界扩展');
  }
  if (game.scope?.mode && game.scope.mode !== 'scene-slice') warnings.push('游戏配置的 scope 与切片不一致');
  return { valid: errors.length === 0, errors, warnings };
}

/** Real-input journeys must cover the slice terminal, not the whole game. */
export function validateSliceJourneys(slice: SliceRecord, journeys: unknown): SliceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(journeys) || !journeys.length) return { valid: false, errors: ['切片缺少真实输入旅程 journeys.json'], warnings };
  const boundary = journeys.filter((journey: any) => journey?.endingId === slice.boundary.endingId);
  if (!boundary.length) errors.push(`切片旅程没有声明边界结局 ${slice.boundary.endingId}`);
  for (const journey of boundary) {
    if (!Array.isArray(journey.steps) || !journey.steps.length) errors.push(`旅程 ${journey.id || '?'} 没有步骤`);
  }
  if (journeys.some((journey: any) => journey?.endingId && journey.endingId !== slice.boundary.endingId)) {
    warnings.push('切片旅程出现了边界结局之外的结局声明');
  }
  return { valid: errors.length === 0, errors, warnings };
}
