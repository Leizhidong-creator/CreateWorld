import fs from 'node:fs';
import path from 'node:path';
import { safePath, hashFile, hash } from '../shared/files.js';
import { PRODUCTION_POLICY } from './production-policy.js';

/** Reference pixels are candidate inputs too, even when outside assets/. */
export function artReferenceFingerprint(workspace: string): string {
  try {
    const design = JSON.parse(fs.readFileSync(path.join(workspace, 'design.json'), 'utf8'));
    const refs = design.artDirection?.referencePaths;
    if (!Array.isArray(refs)) return hash('no-art-references');
    return hash(JSON.stringify(refs.map(reference => {
      try { return [reference, hashFile(safePath(workspace, reference))]; }
      catch { return [reference, 'missing-or-invalid']; }
    })));
  } catch { return hash('no-art-direction'); }
}

export const VISUAL_CHECKS = ['pixelScale', 'projection', 'proportions', 'palette', 'lighting', 'detailDensity'] as const;
const described = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Structure and reference existence only; actual visual quality requires image review. */
export function artDirectionErrors(design: any, workspace: string): string[] {
  const errors: string[] = [], art = design?.artDirection;
  if (!art || typeof art !== 'object') return ['缺少统一美术规格 design.json.artDirection；先使用 art-direction'];
  for (const key of ['pixelPolicy', 'camera', 'characterSize', 'lighting', 'detailDensity', 'assetReuse']) {
    if (!described(art[key])) errors.push('artDirection.' + key + ' 需要具体说明');
  }
  if (!Array.isArray(art.palette) || art.palette.length < 2 || !art.palette.every((c: unknown) => typeof c === 'string' && /^#[\da-f]{6}$/i.test(c))) {
    errors.push('artDirection.palette 需要至少两个 #RRGGBB 色值');
  }
  if (!Array.isArray(art.referencePaths) || !art.referencePaths.length) errors.push('artDirection.referencePaths 缺少共同视觉参考图片');
  else for (const reference of art.referencePaths) {
    try {
      if (!described(reference) || !/\.(png|jpe?g|webp|svg)$/i.test(reference)) throw Error();
      const file = safePath(workspace, reference);
      if (!fs.statSync(file).isFile()) throw Error();
    } catch { errors.push('共同视觉参考不存在或路径无效：' + String(reference)); }
  }
  return errors;
}

/** Select a composite for every scene before supplementary shots; never truncate to the first eight. */
export function visualReviewScreenshots(game: any, screenshots: any[]): any[] {
  const selected: any[] = [];
  for (const scene of game.scenes || []) {
    const label = 'scene-' + scene.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const shot = screenshots.find(s => s.label === label) || (scene.id === game.start?.scene ? screenshots.find(s => s.label === 'start') : undefined);
    if (shot && !selected.some(s => s.path === shot.path)) selected.push(shot);
  }
  for (const shot of screenshots) if (selected.length < Math.max(PRODUCTION_POLICY.review.minimumScreenshots, game.scenes?.length || 0) && !selected.some(s => s.path === shot.path)) selected.push(shot);
  return selected;
}

export function visualReviewErrors(game: any, report: any, screenshots: any[]): string[] {
  const errors: string[] = [];
  if (!Array.isArray(report?.visualConsistency)) return ['缺少逐场景统一美术审阅 visualConsistency'];
  for (const scene of game.scenes || []) {
    const entries = report.visualConsistency.filter((entry: any) => entry.sceneId === scene.id);
    if (entries.length !== 1) { errors.push('场景 ' + scene.id + ' 需要一份合成美术审阅'); continue; }
    const entry = entries[0], label = 'scene-' + scene.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!screenshots.some(s => s.path === entry.screenshot && (s.label === label || scene.id === game.start?.scene && s.label === 'start'))) {
      errors.push('场景 ' + scene.id + ' 的美术审阅未关联对应的宿主运行截图');
    }
    for (const key of VISUAL_CHECKS) {
      const check = entry.checks?.[key];
      if (check?.passed !== true || !described(check?.observation)) errors.push('场景 ' + scene.id + ' 美术检查未通过或缺少观察：' + key);
    }
  }
  return errors;
}

export function visualStandardInstruction(skillsDir: string): string {
  return `统一美术是正式交付条件，单场景和复用资源同样适用。正式素材前先读取 visual-asset-production（${path.join(skillsDir,'visual-asset-production/SKILL.md')}），按其路由读取 art-direction 及 ${path.join(skillsDir,'art-direction/references/stardew-pixel-profile.md')}，并按 ${path.join(skillsDir,'art-direction/references/visual-standard.md')} 衔接工作台验收。在 design.json.artDirection 定义 pixelPolicy/camera/characterSize/palette/lighting/detailDensity/assetReuse/referencePaths，关联需求和风格版本；制作参数改变时同步更新。人物、背景、道具共用规范与真实参考，按剧情体型规划相对尺度，不固定人物占屏比，不默认48×64或128×128；宿主640×360视窗合同不等于人物尺寸。角色按上游清单制作三视图及指定方向/动作，实际引用身份母版；正常人类须对侧手脚配合，顺拐或重复相位必须修复。先验证布局再生图，使用实际运行截图逐场景检查颗粒、视角、比例、色板、光照和细节密度；构建、碰撞和通关不能替代读图和动作播放。旧资源仅在实际合成匹配且用户允许复用时沿用。新版美术模块覆盖旧重复制作规则；保留输入范围，未验证项目如实记录。`;
}
