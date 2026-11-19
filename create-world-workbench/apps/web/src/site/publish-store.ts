/**
 * 本机“一键上架”记录。
 * 上架的作品存在 localStorage 里：刷新仍在，重复上架不会产生第二条。
 */
export interface PublishedGame {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  cover: string;
  projectId: string;
  publishedAt: string;
}

const KEY = 'cw.published-games.v1';
const HIGHLIGHT_KEY = 'cw.published-highlight.v1';

export const THREE_BODY_GAME: Omit<PublishedGame, 'publishedAt'> = {
  id: 'three-body-dark-forest',
  title: '三体 Ⅱ · 黑暗森林',
  subtitle: '以罗辑的第一视角，走进黑暗森林',
  description:
    '从湖畔别墅的雪夜开始，你以罗辑的身份醒来：和庄颜说话、翻看书桌上的笔记、走进天文观测室核对坐标。每一次交谈与选择都在推进这条主线，直到你亲手按下那个决定人类文明命运的选择。',
  cover: '/worlds/three-body.png',
  projectId: '',
};

function read(): PublishedGame[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as PublishedGame[] : [];
  } catch { return []; }
}

function write(list: PublishedGame[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* 隐私模式忽略 */ }
}

export function listPublished(): PublishedGame[] {
  return read();
}

export function findPublished(projectId: string): PublishedGame | undefined {
  return read().find(item => item.projectId === projectId);
}

export function publishGame(projectId: string): PublishedGame {
  const list = read();
  const existing = list.find(item => item.projectId === projectId);
  if (existing) {
    try { localStorage.setItem(HIGHLIGHT_KEY, existing.id); } catch { /* ignore */ }
    return existing;
  }
  const entry: PublishedGame = { ...THREE_BODY_GAME, projectId, publishedAt: new Date().toISOString().slice(0, 10) };
  write([entry, ...list]);
  try { localStorage.setItem(HIGHLIGHT_KEY, entry.id); } catch { /* ignore */ }
  return entry;
}

/** 读取“刚刚上架”的作品 id（之后由市场页消费掉）。 */
export function takeHighlight(): string | null {
  try {
    const id = localStorage.getItem(HIGHLIGHT_KEY);
    if (id) localStorage.removeItem(HIGHLIGHT_KEY);
    return id;
  } catch { return null; }
}

/**
 * 项目被删除后，对应作品从商城消失：
 * 传入当前仍存在的项目 id，清掉指向已不存在项目的上架记录。
 */
export function prunePublished(existingProjectIds: string[]): void {
  const keep = new Set(existingProjectIds);
  const list = read();
  const alive = list.filter(item => keep.has(item.projectId));
  if (alive.length !== list.length) write(alive);
}

/** 判断某条上架记录对应的项目是否还在。 */
export function isProjectAlive(projectId: string, existingProjectIds: string[]): boolean {
  return existingProjectIds.includes(projectId);
}
