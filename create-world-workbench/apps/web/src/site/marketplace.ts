import { crossoverGames, type CrossoverConcept } from './crossovers.js';
import { worldById, type World } from './worlds.js';
import { THREE_BODY_GAME, listPublished, type PublishedGame } from './publish-store.js';

export type PricingType = 'free' | 'paid';

export interface MarketplacePricing {
  type: PricingType;
  amount?: number;
  currency: 'CNY';
}

export interface MarketplaceGame {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  cover: string;
  screenshots: string[];
  tags: string[];
  author: { id: string; name: string; avatar: string; verified?: boolean };
  pricing: MarketplacePricing;
  stats: { likes: number; favorites: number; comments: number; plays: number };
  playable: boolean;
  previewWorldId?: World['id'];
  remixable: boolean;
  featured?: boolean;
  sourceGameId?: string;
  concept?: CrossoverConcept;
  createdAt: string;
  updatedAt: string;
  /** 本机一键上架的作品指向的项目 */
  sourceProjectId?: string;
  /** 刚上架，用于列表高亮 */
  justPublished?: boolean;
}

export interface MarketplaceComment {
  id: string;
  gameId: string;
  author: string;
  avatar: string;
  content: string;
  createdAt: string;
  likes: number;
}

export interface MarketplaceFilters {
  query?: string;
  tag?: string;
  coCreation?: string;
  pricing?: PricingType | 'all';
  sort?: 'featured' | 'latest' | 'popular';
}

export interface PublishDraft {
  title: string;
  description: string;
  tags: string[];
  pricing: MarketplacePricing;
  cover?: string;
  playable: boolean;
}

const games: MarketplaceGame[] = [
  {
    id: THREE_BODY_GAME.id, title: '三体', subtitle: THREE_BODY_GAME.subtitle,
    description: THREE_BODY_GAME.description, cover: THREE_BODY_GAME.cover,
    screenshots: [THREE_BODY_GAME.cover], tags: ['科幻', '剧情探索', '二创'],
    author: { id: 'cw-studio', name: 'Create World 编辑部', avatar: 'CW', verified: true },
    pricing: { type: 'free', currency: 'CNY' },
    stats: { likes: 0, favorites: 0, comments: 3, plays: 0 },
    playable: true, remixable: true, featured: true, createdAt: '2026-11-01', updatedAt: '2026-11-01',
  },
  {
    id: 'beyond-the-walls', title: '高墙之外', subtitle: worldById('walls')!.tagline,
    description: worldById('walls')!.description, cover: '/worlds/walls.webp',
    screenshots: ['/worlds/walls.webp', '/worlds/walls-courtyard-day.webp'], tags: ['剧情冒险', '探索', '解谜'],
    author: { id: 'cw-studio', name: 'Create World 编辑部', avatar: 'CW', verified: true },
    pricing: { type: 'free', currency: 'CNY' },
    stats: { likes: 0, favorites: 0, comments: 0, plays: 0 },
    playable: true, previewWorldId: 'walls', remixable: true, featured: true, createdAt: '2026-11-01', updatedAt: '2026-11-01',
  },
  {
    id: 'quiet-harbor',
    title: '雾港来信',
    subtitle: '一座灯塔，一封没有寄出的信。',
    description: '灯塔熄灭的第三个夜晚，一封未寄出的信，把你带回海边。穿过旧港，听完留下来的故事。',
    cover: '/worlds/coast.webp',
    screenshots: ['/worlds/coast.webp', '/worlds/train.webp', '/worlds/mountain.webp'],
    tags: ['探索', '人物对话', '轻解谜'],
    author: { id: 'cw-studio', name: 'Create World 编辑部', avatar: 'CW', verified: true },
    pricing: { type: 'free', currency: 'CNY' },
    stats: { likes: 1280, favorites: 462, comments: 86, plays: 9234 },
    playable: true, previewWorldId: 'harbor', remixable: true, featured: true, createdAt: '2026-10-22', updatedAt: '2026-10-28',
  },
  {
    id: 'mountain-return',
    title: '山风归途',
    subtitle: '沿着旧地图，走回记忆深处。',
    description: '带着一张旧地图穿过山林，在沿途的村落里，拼起一段被遗忘的往事。',
    cover: '/worlds/mountain.webp',
    screenshots: ['/worlds/mountain.webp', '/worlds/walls-courtyard-day.webp', '/worlds/coast.webp'],
    tags: ['旅行', '叙事', '山野'],
    author: { id: 'lin-yu', name: '林屿', avatar: '林' },
    pricing: { type: 'paid', amount: 12, currency: 'CNY' },
    stats: { likes: 936, favorites: 318, comments: 52, plays: 5480 },
    playable: false, remixable: true, featured: true, createdAt: '2026-10-19', updatedAt: '2026-10-26',
  },
  {
    id: 'orbit-echoes',
    title: '轨道余声',
    subtitle: '讯号沉寂之后，仍有人等待回音。',
    description: '走进寂静的轨道站，寻找遗失的记录。与留守者交谈，让一段沉默的讯号重新传来。',
    cover: '/worlds/train.webp',
    screenshots: ['/worlds/train.webp', '/worlds/coast.webp', '/worlds/mountain.webp'],
    tags: ['科幻', '对话', '调查'],
    author: { id: 'north-station', name: '北站工作室', avatar: '北' },
    pricing: { type: 'free', currency: 'CNY' },
    stats: { likes: 712, favorites: 201, comments: 38, plays: 3811 },
    playable: true, previewWorldId: 'station', remixable: true, createdAt: '2026-10-16', updatedAt: '2026-10-21',
  },
  {
    id: 'after-the-walls',
    title: '高墙之外：余烬',
    subtitle: '高墙困住脚步，却困不住希望。',
    description: '一段发生在原作之后的短篇二创。新的房间，新的线索，和一封迟到了很多年的回信。',
    cover: '/worlds/walls.webp',
    screenshots: ['/worlds/walls.webp', '/worlds/walls-courtyard-night.webp', '/worlds/walls-courtyard-day.webp'],
    tags: ['二创', '剧情冒险', '解谜'],
    author: { id: 'mo-he', name: '墨盒', avatar: '墨' },
    pricing: { type: 'paid', amount: 6, currency: 'CNY' },
    stats: { likes: 604, favorites: 244, comments: 41, plays: 2918 },
    playable: false, remixable: true, sourceGameId: 'quiet-harbor', createdAt: '2026-10-14', updatedAt: '2026-10-20',
  },
  {
    id: 'dust-signal',
    title: '尘埃信号',
    subtitle: '在落灰的房间里，听见远方的回声。',
    description: '一个关于离开、留下与重新写下结局的短篇实验作品。',
    cover: '/worlds/dust.webp',
    screenshots: ['/worlds/dust.webp', '/worlds/coast.webp'],
    tags: ['科幻', '实验', '短篇'],
    author: { id: 'a-chen', name: '陈未', avatar: '未' },
    pricing: { type: 'free', currency: 'CNY' },
    stats: { likes: 388, favorites: 122, comments: 19, plays: 2074 },
    playable: false, remixable: true, createdAt: '2026-10-08', updatedAt: '2026-10-12',
  },
];

const initialComments: MarketplaceComment[] = [
  { id: 'comment-1', gameId: 'quiet-harbor', author: '苏打水', avatar: '苏', content: '灯塔亮起来的那一刻很有感觉，想看看更多关于守灯人的故事。', createdAt: '2026-10-28', likes: 24 },
  { id: 'comment-2', gameId: 'quiet-harbor', author: '白昼梦', avatar: '白', content: '我喜欢这种走慢一点也不会错过什么的探索节奏。', createdAt: '2026-10-25', likes: 17 },
  { id: 'comment-3', gameId: 'mountain-return', author: '闻山', avatar: '闻', content: '地图和记忆的关系处理得很漂亮，期待下一章。', createdAt: '2026-10-24', likes: 11 },
];

let currentGames = [...crossoverGames, ...games].map(game => ({ ...game, stats: { ...game.stats }, tags: [...game.tags] }));

const PUBLISHED_COMMENTS: MarketplaceComment[] = [
  { id: 'pub-c1', gameId: 'three-body-dark-forest', author: '冷月', avatar: '冷', content: '从雪夜别墅一路走到观测室，最后那个选择停了好久才按下去。', createdAt: '2026-10-31', likes: 24 },
  { id: 'pub-c2', gameId: 'three-body-dark-forest', author: '三日凌空', avatar: '三', content: '像素场景的光照很稳，观测室那段几乎就是我读小说时想象的样子。', createdAt: '2026-10-31', likes: 18 },
  { id: 'pub-c3', gameId: 'three-body-dark-forest', author: '罗辑的路人', avatar: '罗', content: '和庄颜的对话没有硬拗台词，节奏舒服。希望后面能补上面壁计划那条线。', createdAt: '2026-10-30', likes: 9 },
];

function publishedAsGames(): MarketplaceGame[] {
  return listPublished().map((entry: PublishedGame) => ({
    id: entry.id,
    title: entry.title,
    subtitle: entry.subtitle,
    description: entry.description,
    cover: entry.cover,
    screenshots: [entry.cover],
    tags: ['科幻', '剧情探索', '二创'],
    author: { id: 'creator', name: '本地创作者', avatar: '创', verified: true },
    pricing: { type: 'free', currency: 'CNY' },
    stats: { likes: 0, favorites: 0, comments: 3, plays: 1 },
    playable: true,
    remixable: true,
    featured: true,
    createdAt: entry.publishedAt,
    updatedAt: entry.publishedAt,
    sourceProjectId: entry.projectId,
  }));
}

function allGames(): MarketplaceGame[] {
  const published = publishedAsGames();
  return [...published, ...currentGames.filter(game => !published.some(item => item.id === game.id))];
}
let currentComments = initialComments.map(comment => ({ ...comment }));

export function marketplacePreviewPath(game: Pick<MarketplaceGame, 'previewWorldId'> & { sourceProjectId?: string; id?: string }): string | undefined {
  if (game.id === 'three-body-dark-forest') return '/export-assets/three-body/play.html';
  if (game.sourceProjectId) return `#/export/${encodeURIComponent(game.sourceProjectId)}`;
  const world = game.previewWorldId ? worldById(game.previewWorldId) : undefined;
  return world?.playable ? `#/games/preview/${world.id}` : undefined;
}

const cloneGame = (game: MarketplaceGame) => ({ ...game, playable: Boolean(marketplacePreviewPath(game)), tags: [...game.tags], screenshots: [...game.screenshots], stats: { ...game.stats }, author: { ...game.author }, pricing: { ...game.pricing } });

export const marketplace = {
  async listGames(filters: MarketplaceFilters = {}): Promise<MarketplaceGame[]> {
    const query = filters.query?.trim().toLocaleLowerCase() || '';
    const filtered = allGames().filter(game => {
      const matchesQuery = !query || `${game.title} ${game.subtitle} ${game.description} ${game.tags.join(' ')} ${game.author.name}`.toLocaleLowerCase().includes(query);
      const matchesTag = !filters.tag || filters.tag === '全部' || game.tags.includes(filters.tag);
      const matchesPricing = !filters.pricing || filters.pricing === 'all' || game.pricing.type === filters.pricing;
      const matchesCoCreation = !filters.coCreation || filters.coCreation === '全部' || game.tags.includes(filters.coCreation);
      return matchesQuery && matchesTag && matchesPricing && matchesCoCreation;
    });
    const sort = filters.sort || 'featured';
    // 本机刚上架的作品永远排在最前（本周精选第一位）
    const sorted = [...filtered].sort((a, b) => {
      const freshA = a.sourceProjectId ? 1 : 0;
      const freshB = b.sourceProjectId ? 1 : 0;
      if (freshA !== freshB) return freshB - freshA;
      if (freshA && freshB) return b.createdAt.localeCompare(a.createdAt);
      return sort === 'latest' ? b.createdAt.localeCompare(a.createdAt)
        : sort === 'popular' ? b.stats.plays - a.stats.plays
        : Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || b.stats.likes - a.stats.likes;
    });
    return sorted.map(cloneGame);
  },
  async getGame(id: string): Promise<MarketplaceGame | undefined> {
    const game = allGames().find(item => item.id === id);
    return game ? cloneGame(game) : undefined;
  },
  async toggleLike(id: string) {
    const game = allGames().find(item => item.id === id);
    if (!game) throw new Error('作品不存在');
    game.stats.likes += 1;
    return cloneGame(game);
  },
  async toggleFavorite(id: string) {
    const game = allGames().find(item => item.id === id);
    if (!game) throw new Error('作品不存在');
    game.stats.favorites += 1;
    return cloneGame(game);
  },
  async listComments(id: string) {
    return [...currentComments, ...PUBLISHED_COMMENTS].filter(comment => comment.gameId === id).map(comment => ({ ...comment }));
  },
  async createComment(id: string, content: string) {
    const clean = content.trim();
    if (!clean) throw new Error('评论内容不能为空');
    const comment: MarketplaceComment = { id: `comment-${Date.now()}`, gameId: id, author: '本地创作者', avatar: '你', content: clean, createdAt: new Date().toISOString().slice(0, 10), likes: 0 };
    currentComments = [comment, ...currentComments];
    const game = allGames().find(item => item.id === id);
    if (game) game.stats.comments += 1;
    return { ...comment };
  },
  async createRemix(id: string) {
    const game = allGames().find(item => item.id === id);
    if (!game) throw new Error('作品不存在');
    return { sourceGameId: game.id, sourceTitle: game.title, sourceAuthor: game.author.name };
  },
  async publishDraft(draft: PublishDraft) {
    const title = draft.title.trim();
    if (!title) throw new Error('请填写作品名称');
    if (!draft.description.trim()) throw new Error('请填写作品简介');
    if (draft.pricing.type === 'paid' && (!draft.pricing.amount || draft.pricing.amount <= 0)) throw new Error('请填写有效的购买价格');
    const created: MarketplaceGame = {
      id: `draft-${Date.now()}`, title, subtitle: draft.description.trim().slice(0, 32), description: draft.description.trim(), cover: draft.cover || '/worlds/coast.webp', screenshots: [draft.cover || '/worlds/coast.webp'], tags: draft.tags.length ? draft.tags : ['未分类'], author: { id: 'demo-user', name: '本地创作者', avatar: '你' }, pricing: { ...draft.pricing }, stats: { likes: 0, favorites: 0, comments: 0, plays: 0 }, playable: false, remixable: true, createdAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString().slice(0, 10),
    };
    currentGames = [created, ...currentGames];
    return cloneGame(created);
  },
};

export const marketplaceTags = ['全部', '剧情冒险', '探索', '科幻', '叙事', '解谜', '短篇'];

export const marketplaceCoCreationTypes = ['全部', '联动', '二创', '改编', '合作'];
