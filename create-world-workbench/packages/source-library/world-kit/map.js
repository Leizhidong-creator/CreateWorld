import { MAP_LAYOUT, mapFrame, worldToMap } from './layout.js';

function drawShape(ctx, shape, scene, frame, color) {
  ctx.fillStyle = color;
  if (shape.type === 'circle') {
    const center = worldToMap(shape, scene, frame);
    ctx.beginPath(); ctx.arc(center.x, center.y, shape.r * frame.scale, 0, Math.PI * 2); ctx.fill(); return;
  }
  if (shape.type === 'polygon') {
    ctx.beginPath(); shape.points.forEach((point, index) => { const p = worldToMap(point, scene, frame); index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.closePath(); ctx.fill(); return;
  }
  const point = worldToMap(shape, scene, frame); ctx.fillRect(point.x, point.y, shape.w * frame.scale, shape.h * frame.scale);
}

function questTarget(scene, config, quest, state, test) {
  if (!quest?.target) return null;
  if (quest.target.scene === scene.id) {
    const region = scene.regions?.find(value => value.id === quest.target.region);
    if (region && !(
      state.player.x >= region.x && state.player.x <= region.x + region.w &&
      state.player.y >= region.y && state.player.y <= region.y + region.h
    )) return region;
    return null;
  }
  const visited = new Set([scene.id]);
  const queue = [{ id: scene.id, first: null }];
  while (queue.length) {
    const next = queue.shift();
    const current = config.scenes.find(value => value.id === next.id);
    for (const exit of current?.exits || []) {
      if (!test(exit.when) || visited.has(exit.to)) continue;
      const first = next.first || exit;
      if (exit.to === quest.target.scene) return first.rect;
      visited.add(exit.to); queue.push({ id: exit.to, first });
    }
  }
  return null;
}

/** Draw a read-only map in a canvas. State is supplied as a snapshot. */
export function drawWorldMap(canvas, options) {
  const { scene, config, quest, expanded = false, test = () => true } = options;
  const state = options.state || { player: options.player, explored: options.explored };
  const player = state.player || { x: 0, y: 0 };
  const ctx = canvas.getContext('2d');
  const frame = mapFrame(scene, canvas.width, canvas.height, MAP_LAYOUT.inset);
  const palette = scene.palette || config.theme.world;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0d1820'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawShape(ctx, { x: 0, y: 0, w: scene.width, h: scene.height }, scene, frame, palette.floorAlt);
  for (const shape of scene.collisions || []) drawShape(ctx, shape, scene, frame, palette.wallTop);
  for (const object of scene.objects || []) {
    if (!test(object.when) || object.kind === 'lamp') continue;
    drawShape(ctx, { x: object.x, y: object.y, w: object.w || 32, h: object.h || 32 }, scene, frame, object.kind === 'water' ? palette.water : '#506364');
  }
  if (config.features?.fog) {
    const explored = new Set(state.explored?.[scene.id] || []);
    for (let y = 0; y < scene.height; y += 64) for (let x = 0; x < scene.width; x += 64) {
      if (!explored.has(`${Math.floor(x / 64)},${Math.floor(y / 64)}`)) {
        drawShape(ctx, { x, y, w: Math.min(64, scene.width - x), h: Math.min(64, scene.height - y) }, scene, frame, '#0d1820');
      }
    }
  }
  for (const landmark of scene.landmarks || []) {
    if (landmark.when && !test(landmark.when)) continue;
    const point = worldToMap(landmark, scene, frame);
    ctx.fillStyle = '#c1c9c0'; ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
    if (expanded) { ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(landmark.label, point.x, point.y - 8); }
  }
  const target = questTarget(scene, config, quest, state, test);
  if (target) {
    const point = worldToMap({ x: target.x + target.w / 2, y: target.y + target.h / 2 }, scene, frame);
    ctx.strokeStyle = config.theme.accent; ctx.lineWidth = 2; ctx.strokeRect(point.x - 8, point.y - 8, 16, 16);
  }
  const current = worldToMap(player, scene, frame);
  ctx.fillStyle = '#8be3d4'; ctx.beginPath(); ctx.arc(current.x, current.y, expanded ? 5 : 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff4cf'; ctx.lineWidth = 1; ctx.strokeRect(frame.x, frame.y, frame.w, frame.h);
}

