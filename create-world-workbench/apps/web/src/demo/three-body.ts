/**
 * 演示用固定数据：首页“开始创造”进入的《三体·黑暗森林》演示项目。
 * 这里的所有步骤、任务、插件与素材都是写死的演示内容，不依赖后台 Codex。
 */

export const DEMO_TITLE = '三体';

/** 整条制作时间线（节点画布）在 7 秒内跑完。 */
export const DEMO_TOTAL_MS = 7000;

/** 五个阶段在画布上出现的时刻（毫秒）。 */
export const DEMO_STAGE_AT = [600, 1700, 3000, 4300, 5400];
/** 插件节点出现、交付节点出现的时刻。 */
export const DEMO_PLUGIN_AT = 2600;
export const DEMO_DELIVER_AT = 6500;

export interface DemoStep {
  title: string;
  detail: string;
}

export const DEMO_STEPS: DemoStep[] = [
  { title: '整理来源与改编边界', detail: '核对《黑暗森林》的关键事件、人物动机与原作结局' },
  { title: '确定核心机制、状态与流程', detail: '探索、对话、关键抉择三条主线串起十分钟流程' },
  { title: '生成统一像素资产', detail: '3 张场景、3 个角色三视图与四方向行走动画' },
  { title: '接入运行时并实测', detail: '接入移动、交互、地图、存档与场景切换' },
  { title: '独立审阅并修复', detail: '逐场景走查，修复穿模、断点与错位对白' },
];

export const DEMO_TASKS: string[] = [
  '读取故事材料，切分可玩段落',
  '提取罗辑、史强、庄颜的人物动机',
  '设计第一人称主线与关键抉择',
  '规划三个场景与行走路线',
  '生成场景：湖畔别墅外景',
  '生成场景：别墅室内',
  '生成场景：天文观测室',
  '生成角色三视图与行走动画',
  '接入运行时、存档与场景转场',
  '走查截图并修复问题',
];

export const DEMO_TOOL_SKILLS = [
  'game-adaptation', 'content-understanding', 'game-state', 'gameplay-design',
  'interaction-generation', 'main-flow', 'narrative-branch', 'scene-generation',
  'character-generation', 'art-direction', 'world-kit', 'game-reviewer',
];

export const DEMO_TOOL_COUNT = 23;

export interface DemoPlugin {
  name: string;
  slug: string;
  use: string;
  status: string;
}

export const DEMO_PLUGINS: DemoPlugin[] = [
  { name: '场景生成', slug: 'scene-generation', use: '按统一规格产出三张像素场景，固定透视与色板', status: '已使用' },
  { name: '角色生成', slug: 'character-generation', use: '生成罗辑、史强、庄颜的三视图与四方向行走帧', status: '已使用' },
  { name: '美术方向', slug: 'art-direction', use: '锁定像素颗粒、角色比例、光照与调色板', status: '已使用' },
  { name: '玩法设计', slug: 'gameplay-design', use: '把探索、对话、关键抉择编排成十分钟流程', status: '已使用' },
  { name: '叙事分支', slug: 'narrative-branch', use: '围绕黑暗森林法则设计可选对话与结局走向', status: '已使用' },
  { name: '运行时 world-kit', slug: 'world-kit', use: '提供移动、交互、地图、镜头与碰撞能力', status: '已使用' },
  { name: '存档与状态', slug: 'game-state', use: '记录进度、已获道具与关键抉择结果', status: '已使用' },
  { name: '审阅验收', slug: 'game-reviewer', use: '真实操作走查并输出截图与问题清单', status: '已使用' },
];

export interface DemoAsset {
  name: string;
  src: string;
  kind: string;
  meta: string;
}

const base = '/demo-assets/three-body';

export const DEMO_ASSETS: DemoAsset[] = [
  { name: '湖畔别墅外景', src: `${base}/scene-lake-villa.png`, kind: '场景', meta: '1536 × 1024 · PNG' },
  { name: '别墅室内', src: `${base}/scene-villa-interior.png`, kind: '场景', meta: '1536 × 1024 · PNG' },
  { name: '天文观测室', src: `${base}/scene-observatory.png`, kind: '场景', meta: '1254 × 1254 · PNG' },
  { name: '罗辑 · 三视图', src: `${base}/char-luoji-sheet.png`, kind: '角色', meta: '576 × 256 · 正 / 背 / 侧' },
  { name: '史强 · 三视图', src: `${base}/char-shiqiang-sheet.png`, kind: '角色', meta: '576 × 256 · 正 / 背 / 侧' },
  { name: '庄颜 · 三视图', src: `${base}/char-zhuangyan-sheet.png`, kind: '角色', meta: '576 × 256 · 候选形象' },
  { name: '罗辑 · 四方向行走', src: `${base}/walk-luoji.png`, kind: '动作', meta: '4 方向 × 4 帧 · 48 × 64' },
  { name: '史强 · 四方向行走', src: `${base}/walk-shiqiang.png`, kind: '动作', meta: '4 方向 × 4 帧 · 48 × 64' },
];

export interface DemoCrewMember {
  id: string;
  name: string;
  role: string;
}

export const DEMO_CREW: DemoCrewMember[] = [
  { id: '01-girl-blue-hoodie', name: '美术', role: '场景与角色' },
  { id: '02-boy-cream-sweater', name: '策划', role: '玩法与剧情' },
  { id: '03-boy-blue-tracksuit', name: '程序', role: '运行时与构建' },
  { id: '04-boy-gray-jacket', name: '项目', role: '核对与交付' },
];

/** 每一步里四位成员在做什么，用在人物头顶的气泡。 */
export const DEMO_CREW_LINES: string[][] = [
  ['核对原作关键事件', '拆解可用剧情段落', '搭好运行环境', '记录改编边界'],
  ['推演探索节奏', '把抉择写成分支', '评估实现成本', '排查风险点'],
  ['画三张场景', '定色调与比例', '接入素材管线', '对照美术规格'],
  ['接运行时', '跑通十分钟流程', '修碰撞与转场', '回归存档'],
  ['逐场景走查', '检查对白断点', '复跑真实操作', '整理交付记录'],
];

export const DEMO_CREW_DONE = ['复核对白', '补细节', '再跑一遍', '准备交付'];

export interface DemoPlayback {
  elapsed: number;
  stepIndex: number;
  finishedSteps: number;
  taskCount: number;
  toolCount: number;
  done: boolean;
}

/** 某个阶段结束的时刻（下一阶段开始，最后一个阶段在总时长结束）。 */
export function stageEnd(index: number): number {
  return DEMO_STAGE_AT[index + 1] ?? DEMO_TOTAL_MS;
}

export function playbackAt(elapsed: number): DemoPlayback {
  const time = Math.max(0, Math.min(DEMO_TOTAL_MS, elapsed));
  const ratio = time / DEMO_TOTAL_MS;
  const started = DEMO_STAGE_AT.filter(at => time >= at).length;
  return {
    elapsed: time,
    stepIndex: Math.max(0, Math.min(DEMO_STEPS.length - 1, started - 1)),
    finishedSteps: DEMO_STAGE_AT.filter((_, index) => time >= stageEnd(index)).length,
    taskCount: Math.min(DEMO_TASKS.length, Math.floor(ratio * DEMO_TASKS.length)),
    toolCount: Math.min(DEMO_TOOL_COUNT, Math.floor(ratio * DEMO_TOOL_COUNT)),
    done: time >= DEMO_TOTAL_MS,
  };
}
