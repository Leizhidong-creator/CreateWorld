export const busyStatuses = new Set(['queued', 'pending', 'running', 'validating', 'cancelling', 'cancel_requested']);
export const failureStatuses = new Set(['failed', 'blocked', 'rejected', 'error']);
export const passedStatuses = new Set(['passed', 'accepted', 'completed', 'succeeded', 'ready']);
export function isBusy(status?: string) { return Boolean(status && busyStatuses.has(status)); }
export function humanStatus(status?: string): string {
  return ({ queued: '排队中', pending: '等待执行', running: '制作中', validating: '检查中', passed: '已通过', accepted: '已接受', completed: '已完成', succeeded: '已完成', ready: '可试玩', failed: '未完成', blocked: '需要处理', rejected: '检查未通过', cancelled: '已停止', cancel_requested: '正在停止', cancelling: '正在停止', stale: '待重新检查', candidate: '候选版本', draft: '待制作', idle: '待制作', error: '发生错误', interrupted: '已中断' } as Record<string, string>)[status ?? ''] ?? (status || '待制作');
}
export function humanStage(stage?: string): string {
  return ({ autonomous:'自主制作整部游戏', work:'动态工作', checkpoint:'更新工作安排', read_skill:'读取技能', build_test:'构建与真实操作', check:'检查当前内容', finish:'完整游戏验收', block:'需要补充信息', source: '读取故事与来源', research: '检索与核对来源', intake: '整理输入材料', content: '制作剧情与交互', adaptation: '改编与范围', design: '改编、玩法与美术方向', flow: '主流程与交互', state: '状态与任务', graybox: '验证可玩灰盒', art: '制作视觉规范', assets: '制作游戏素材', characters: '制作角色', scenes: '制作场景', dialogue: '创作对白', assembly: '组装游戏', build: '构建候选', review: '检查游戏', testing: '真实操作测试', validation: '检查产物', complete: '完成', completed: '完成', queued: '等待开始', change: '分析修改影响', export: '整理交付' } as Record<string, string>)[stage ?? ''] ?? stage ?? '等待开始';
}

export interface FriendlyRunError {
  title: string;
  message: string;
  action: string;
  aiPrompt: string;
}

/** Convert host diagnostics into language a non-technical creator can act on. */
export function friendlyRunError(raw?: string): FriendlyRunError | null {
  if (!raw) return null;
  const technical = raw.trim();
  let title = '制作暂时没有完成';
  let message = '工作台保留了已经完成的内容，但还没有生成可试玩版本。';
  let action = '点击“继续执行”重试；如果仍然失败，把“给 AI 的诊断”复制给 AI。';

  if (/未找到 (?:Chrome\/Chromium\/Edge|Chrome\/Chromium|Firefox|WebKit)|Chrome\/Chromium|CW_CHROME_PATH|CW_BROWSER_PATH/i.test(technical)) {
    title = '暂时无法进行自动试玩检查';
    message = '工作台找不到用于自动打开和测试游戏的兼容浏览器。你的项目材料没有丢失。';
    action = '请先安装或配置兼容的浏览器（Chrome、Edge、Firefox 或 WebKit），再点击“继续执行”；也可以把下方诊断交给 AI。';
  } else if (/Unsafe local asset path|安全资源目录|asset path/i.test(technical)) {
    title = '素材文件暂时无法安全读取';
    message = '工作台在准备游戏素材时遇到了文件位置问题，素材还没有完成生成。';
    action = '点击“继续执行”让 AI 自动修复素材路径；不要手动修改系统配置文件。';
  } else if (/额度不足|usageLimitExceeded|rate limit/i.test(technical)) {
    title = '制作额度暂时不足';
    message = '当前制作所需的 AI 额度暂时不可用，已完成的内容会保留。';
    action = '稍后点击“继续执行”，系统会从已完成的位置继续。';
  } else if (/CancelledError|制作已停止|已停止/i.test(technical)) {
    title = '制作已暂停';
    message = '制作被暂停了，已经完成的内容会保留。';
    action = '点击“继续执行”即可接着制作。';
  } else if (/BlockedError|需要：|无法自主解决/i.test(technical)) {
    title = '制作需要一点帮助';
    message = 'AI 在继续制作前遇到了一个需要处理的问题。已有内容仍然保留。';
    action = '把下方诊断复制给 AI，让 AI 先处理问题，再继续执行。';
  }

  return {
    title,
    message,
    action,
    aiPrompt: `请帮我继续修复这个 Create World 项目。请先读取并检查项目现有产物，直接处理下面的工作台诊断，修复后继续原制作流程；不要只解释原因，也不要删除已有内容。\n\n工作台原始诊断：\n${technical}`,
  };
}
export function dateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}
export function sortNewest<T extends { createdAt: string }>(items: T[] = []): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function textValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}
export function itemLabel(value: unknown, fallback = '未命名条目') {
  if (typeof value === 'string') return value;
  const row = record(value);
  return textValue(row.title || row.name || row.label || row.summary || row.text || row.id) || fallback;
}
export function jsonText(value: unknown) { return JSON.stringify(value, null, 2) ?? ''; }
export function findCollections(value: unknown, keys: string[], maxDepth = 4): unknown[] {
  const result: unknown[] = [];
  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > maxDepth) return;
    if (Array.isArray(node)) { node.forEach(child => visit(child, depth + 1)); return; }
    for (const [key, child] of Object.entries(node)) {
      if (keys.includes(key) && Array.isArray(child)) result.push(...child);
      else visit(child, depth + 1);
    }
  };
  visit(value, 0);
  return result;
}
