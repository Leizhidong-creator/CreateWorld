#!/usr/bin/env node
/**
 * Create World · seed
 * 一个不需要联网、不需要安装依赖的小彩蛋。
 *
 *   node scripts/seed.mjs            # 让时间决定
 *   node scripts/seed.mjs 0x7A3F     # 让种子决定
 */

const WORLDS = [
  ['雾港', '小雨，灯塔亮着', '「先去看看那封信。」'],
  ['高墙之外', '风很大，墙外有光', '「墙不会自己倒，但门可以。」'],
  ['轨道余声', '深夜，末班车还没来', '「再等一班，也许就有回音。」'],
  ['山风归途', '晴，山路上有雾', '「沿着旧地图走，别回头。」'],
  ['湖畔别墅', '雪停了，窗里有人', '「炉火还暖着，先去说说话。」'],
  ['大观园', '落花，风从东边来', '「这一次，换个结局。」'],
];

const OPENERS = [
  '你只是讲了一个故事。',
  '一个世界，从一句话开始。',
  'NPC 记得你上次的选择。',
  '门没锁，进去看看。',
  '在别人的故事里，做一次自己的决定。',
];

function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

const arg = process.argv.slice(2).find((v) => !v.startsWith('-'));
const seed = arg || Date.now().toString(36);
const h = hash(seed);
const [world, weather, line] = WORLDS[h % WORLDS.length];
const opener = OPENERS[(h >>> 8) % OPENERS.length];
const hex = (h & 0xffff).toString(16).toUpperCase().padStart(4, '0');

const gold = (s) => `\x1b[38;5;180m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bright = (s) => `\x1b[97m${s}\x1b[0m`;

console.log('');
console.log(`  ${gold('C W')}  ${dim('·')}  ${bright('CREATE WORLD')}   ${dim('SEED')} ${gold('0x' + hex)}-2026`);
console.log(dim('  ────────────────────────────────────────────'));
console.log('');
console.log(`  ${dim('WORLD')}     ${bright(world)}`);
console.log(`  ${dim('WEATHER')}   ${weather}`);
console.log(`  ${dim('FIRST')}     ${line}`);
console.log('');
console.log(`  ${gold('◆')} ${opener}`);
console.log('');
console.log(dim(`  换一个世界：node scripts/seed.mjs ${hex}`));
console.log('');

