export const GAME_ASPECT_RATIO = 16 / 9;
export const GAME_ASPECT_RATIO_LABEL = '16:9';
export const VIEWPORT = Object.freeze({ width: 640, height: 360, aspectRatio: GAME_ASPECT_RATIO });

// All coordinates are logical pixels inside VIEWPORT. The host may scale the
// 640x360 game surface, but must preserve its aspect ratio.
export const CONTROL_LAYOUT = Object.freeze({
  joystick: Object.freeze({ x: 24, y: 264, size: 84 }),
  action: Object.freeze({ x: 544, y: 264, size: 72 }),
});

export const MAP_LAYOUT = Object.freeze({ inset: 10 });

export function is16x9(width, height, tolerance = 0.005) {
  return Number.isFinite(width) && Number.isFinite(height) && height > 0 && Math.abs(width / height - GAME_ASPECT_RATIO) <= tolerance;
}

export function assert16x9(width, height, label = '游戏画布') {
  if (!is16x9(width, height)) throw new Error(`${label}必须保持${GAME_ASPECT_RATIO_LABEL}比例，收到 ${width}×${height}`);
  return true;
}

export function worldToMap(point, scene, frame) {
  return {
    x: frame.x + point.x / scene.width * frame.w,
    y: frame.y + point.y / scene.height * frame.h,
  };
}

export function mapFrame(scene, width, height, inset = MAP_LAYOUT.inset) {
  const scale = Math.min((width - inset * 2) / scene.width, (height - inset * 2) / scene.height);
  return {
    x: (width - scene.width * scale) / 2,
    y: (height - scene.height * scale) / 2,
    w: scene.width * scale,
    h: scene.height * scale,
    scale,
  };
}

export function logicalPercent(value, axis) {
  return `${value / axis * 100}%`;
}
