import { CrossoverDetail } from './CrossoverDetail.js';
﻿import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/common.js';
import { navigate } from './navigation.js';
import { THREE_BODY_IDEA } from './demo-idea.js';
import { PricingPlans } from './Pricing.js';
import { marketplace, marketplacePreviewPath, marketplaceTags, marketplaceCoCreationTypes, type MarketplaceComment, type MarketplaceGame } from './marketplace.js';
import { prunePublished, takeHighlight } from './publish-store.js';
import { request } from '../api.js';
import type { Project } from '../types.js';

const DEFAULT_IDEA = '把《三体》中最有意思的一段改编成游戏。';
const POLISHED_IDEA = THREE_BODY_IDEA;

function priceLabel(game: MarketplaceGame) {
  if (game.pricing.type === 'free') return '免费';
  return `¥ ${game.pricing.amount}`;
}

function Stat({ icon, value }: { icon: string; value: number }) {
  return <span className="market-stat"><Icon name={icon} size={14} />{value > 9999 ? `${(value / 10000).toFixed(1)}万` : value}</span>;
}

export function Marketplace({ mine = false, listing = false }: { mine?: boolean; listing?: boolean }) {
  const [idea, setIdea] = useState(DEFAULT_IDEA);
  const [polishing, setPolishing] = useState(false);
  const [polished, setPolished] = useState(false);
  const ideaRef = useRef<HTMLTextAreaElement>(null);
  const polishTimer = useRef<number | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('全部');
  const [coCreation, setCoCreation] = useState('全部');
  const [pricing, setPricing] = useState<'all' | 'free' | 'paid'>('all');
  const [sort, setSort] = useState<'featured' | 'latest' | 'popular'>('featured');
  const [games, setGames] = useState<MarketplaceGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(() => takeHighlight());

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const data = await request<Project[] | { projects: Project[] }>('/api/projects');
        const ids = (Array.isArray(data) ? data : data.projects).map(item => item.id);
        prunePublished(ids);
      } catch { /* 服务未连接时保留本机记录 */ }
      try {
      const items = await marketplace.listGames({ query, tag, pricing, sort, coCreation });
      if (active) setGames(items);
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [query, tag, pricing, sort, coCreation]);

  useEffect(() => () => { if (polishTimer.current) window.clearTimeout(polishTimer.current); }, []);

  useEffect(() => {
    const field = ideaRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 320)}px`;
  }, [idea]);

  function polishIdea() {
    if (polishing) return;
    setPolishing(true);
    setPolished(false);
    if (polishTimer.current) window.clearTimeout(polishTimer.current);
    polishTimer.current = window.setTimeout(() => {
      setIdea(POLISHED_IDEA);
      setPolishing(false);
      setPolished(true);
    }, 1500);
  }

  useEffect(() => {
    if (!highlightId) return;
    if (!games.some(game => game.id === highlightId)) return;
    const node = document.querySelector('.market-featured');
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const timer = window.setTimeout(() => setHighlightId(null), 2600);
    return () => window.clearTimeout(timer);
  }, [games, highlightId]);

  if (mine) return <div className="market-page site-container market-mine-page"><MarketHeader mine /><div className="market-mine-shell"><div className="market-mine-icon"><Icon name="layers" size={28} /></div><div><span className="site-eyebrow">MADE HERE</span><h1>我的游戏</h1><p>管理你创作、上传和收藏的世界。</p></div><a className="site-button gold" href="#/publish"><Icon name="plus" size={16} />发布新游戏</a></div><div className="market-mine-grid"><a className="market-mine-card" href="#/projects"><span className="market-mine-card-art"><Icon name="layers" size={30} /></span><span><strong>我的项目</strong><small>进入创作工作区</small></span><Icon name="arrow" size={17} /></a><a className="market-mine-card" href="#/games"><span className="market-mine-card-art market-mine-card-art-gold"><Icon name="play" size={30} /></span><span><strong>我的试玩版本</strong><small>查看已经生成的作品</small></span><Icon name="arrow" size={17} /></a></div></div>;

  const featured = ['three-body-dark-forest', 'beyond-the-walls'].flatMap(id => { const game = games.find(item => item.id === id); return game ? [{ ...game, title: id === 'three-body-dark-forest' ? '三体' : '高墙之外' }] : []; });
  const shelves = [
    { id: 'latest', eyebrow: 'ORIGINAL WORKS', title: '原创作品', items: games.filter(game => !game.concept && !game.sourceGameId && !game.tags.includes('二创')).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) },
    { id: 'crossover', eyebrow: 'UNEXPECTED WORLDS, NEW STORIES', title: '作品共创', items: games.filter(game => game.concept || game.sourceGameId || game.tags.includes('二创')).sort((a, b) => Number(Boolean(b.concept)) - Number(Boolean(a.concept))) },
  ];
  return <div className={`market-page site-container market-create-page${listing ? ' is-listing' : ''}`}>
    <section className="creation-hero" aria-labelledby="creation-title">
      <div className="creation-atmosphere" aria-hidden="true"><i className="creation-orbit orbit-one" /><i className="creation-orbit orbit-two" /><i className="creation-orbit orbit-three" /><span className="creation-spark spark-one" /><span className="creation-spark spark-two" /></div>
      <div className="creation-content">
        <h1 id="creation-title">你的故事，<em>世界的开始。</em></h1>
        <p className="creation-description">FROM WORDS TO WORLDS</p>
        <form className={`creation-composer${polishing ? ' is-polishing' : ''}${polished ? ' is-polished' : ''}`} onSubmit={event => { event.preventDefault(); sessionStorage.setItem('cw.creation-idea', idea.trim()); navigate('/studio/new'); }}>
          <label className="sr-only" htmlFor="creation-idea">描述你想创造的世界</label>
          <textarea ref={ideaRef} id="creation-idea" value={idea} onChange={event => { const next = event.target.value; setIdea(next); if (!next.trim()) setPolished(false); }} placeholder="你想创造一个怎样的世界？" rows={2} maxLength={20000} readOnly={polishing} aria-describedby="creation-idea-hint" />
          <div className="creation-composer-bottom">
            <span id="creation-idea-hint" role="status">{polishing ? <><Icon name="spark" size={13} className="creation-hint-pulse" />正在理解你的想法…</> : polished ? <><Icon name="check" size={13} />AI 已补全题材、风格、视角与玩法</> : <><Icon name="spark" size={14} />一个念头，就可以开始</>}</span>
            {polished
              ? <button className="site-button gold creation-submit" type="submit">开始创造 <Icon name="arrow" size={17} /></button>
              : <button className={`creation-ai-button${polishing ? ' is-busy' : ''}`} type="button" onClick={polishIdea} disabled={polishing} aria-busy={polishing} title="让 AI 把这句话补全成可制作的游戏需求">
                  <span className="creation-ai-shine" aria-hidden="true" />
                  <Icon name="spark" size={15} className="creation-ai-icon" />
                  <span className="creation-ai-label">{polishing ? 'AI 润色中' : 'AI 润色'}</span>
                </button>}
          </div>
        </form>
      </div>
    </section>
    {listing ? <>
    <section className="market-discover-heading" id="market-discover"><div><span className="site-eyebrow">WORLDS TO EXPLORE</span><h2>探索玩家创造的世界</h2></div><nav className="market-tabs" aria-label="游戏世界分区"><a href="#/games" aria-current="page">发现世界</a><a href="#/games/mine">我的游戏</a></nav></section>
    <div className="market-toolbar"><div className="market-search"><Icon name="search" size={17} /><input aria-label="搜索商城游戏" placeholder="搜索作品、题材或创作者…" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="market-toolbar-actions"><label className="market-select"><span className="sr-only">排序</span><select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="featured">编辑精选</option><option value="latest">最新上架</option><option value="popular">玩家热门</option></select></label><a className="site-button gold market-publish-button" href="#/publish"><Icon name="plus" size={15} />发布游戏</a></div></div>
    <div className="market-filter-row">
      <div className="market-filter-group"><span className="market-filter-label">题材</span><div className="market-tag-scroll" role="group" aria-label="题材筛选">{marketplaceTags.map(item => <button key={item} aria-pressed={tag === item} onClick={() => setTag(item)}>{item}</button>)}</div></div>
      <div className="market-filter-group"><span className="market-filter-label">价格</span><div className="market-price-filter" role="group" aria-label="价格筛选"><button aria-pressed={pricing === 'all'} onClick={() => setPricing('all')}>全部价格</button><button aria-pressed={pricing === 'free'} onClick={() => setPricing('free')}>免费</button><button aria-pressed={pricing === 'paid'} onClick={() => setPricing('paid')}>付费</button></div></div>
      <div className="market-filter-group"><span className="market-filter-label">共创</span><div className="market-tag-scroll" role="group" aria-label="共创筛选">{marketplaceCoCreationTypes.map(item => <button key={item} aria-pressed={coCreation === item} onClick={() => setCoCreation(item)}>{item}</button>)}</div></div>
    </div>
    {loading ? <div className="market-loading" role="status"><span className="site-spinner" />正在打开编辑部货架…</div> : <>{featured.length > 0 && <section className="market-featured" aria-labelledby="market-featured-title"><div className="market-section-heading"><div><span className="site-eyebrow">EDITOR'S CHOICE</span><h2 id="market-featured-title">本周精选</h2></div></div><div className="market-featured-grid">{featured.slice(0, 3).map((game, index) => <FeaturedCard game={game} large={index === 0} key={game.id} justPublished={game.id === highlightId} />)}</div></section>}{shelves.map(shelf => <Shelf key={shelf.id} {...shelf} />)}{!games.length && <div className="market-empty"><Icon name="search" size={27} /><h2>没有找到匹配的世界</h2><p>换一个关键词，或者看看全部作品。</p><button className="site-button outline" onClick={() => { setQuery(''); setTag('全部'); setPricing('all'); setCoCreation('全部'); }}>清除筛选</button></div>}</>}
    </> : <PricingPlans />}
  </div>;
}

function MarketHeader({ mine = false }: { mine?: boolean }) {
  return <div className={`market-header${mine ? ' market-header-mine' : ''}`}>{!mine && <div><span className="site-eyebrow">GAME WORLD</span><h2>游戏世界</h2></div>}<nav className="market-tabs" aria-label="游戏世界分区"><a href="#/games" aria-current={!mine ? 'page' : undefined}>商城</a><a href="#/games/mine" aria-current={mine ? 'page' : undefined}>我的游戏</a></nav></div>;
}

function FeaturedCard({ game, large = false, justPublished = false }: { game: MarketplaceGame; large?: boolean; justPublished?: boolean }) {
  return <a className={`market-feature-card ${large ? 'is-large' : ''}${justPublished ? ' is-just-published' : ''}`} href={`#/games/${game.id}`}><div className="market-feature-art"><img src={game.cover} alt="" loading="lazy" /><span className="market-card-overlay" /><span className="market-card-badge">{game.playable ? '可试玩' : '作品展示'}</span>{justPublished && <span className="market-just-badge">刚刚上架</span>}<span className="market-feature-arrow"><Icon name="arrow" size={18} /></span></div><div className="market-feature-copy"><div><h3>{game.title}</h3><p>{game.subtitle}</p><ShelfTags game={game} /></div><span className="market-price">{priceLabel(game)}</span></div></a>;
}

function Shelf({ id, eyebrow, title, items }: { id: string; eyebrow: string; title: string; items: MarketplaceGame[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return null;
  const limit = id === 'crossover' ? 5 : 4;
  return <section id={`market-shelf-${id}`} className={`market-shelf ${id === 'crossover' ? 'market-crossover-shelf' : ''}`} aria-labelledby={`shelf-${title}`}><div className="market-section-heading"><div><span className="site-eyebrow">{eyebrow}</span><h2 id={`shelf-${title}`}>{title}</h2>{id === 'crossover' && <p className="crossover-shelf-note">熟悉的角色，同一个世界。探索跨界故事，体验全新玩法。</p>}</div>{items.length > limit && <button className="market-view-all" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? '收起' : '查看全部'} <Icon name="arrow" size={14} /></button>}</div><div className="market-card-grid">{(expanded ? items : items.slice(0, limit)).map(game => <GameCard key={game.id} game={game} />)}</div></section>;
}

function ShelfTags({ game }: { game: MarketplaceGame }) {
  return <div className="shelf-card-tags" aria-label="作品分类">{game.tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div>;
}

function GameCard({ game }: { game: MarketplaceGame }) {
  if (game.concept) return <a className="market-game-card crossover-card" href={`#/games/${game.id}`}><div className="market-game-art"><img src={game.cover} alt={`${game.concept.pairing.join(' × ')}游戏封面`} loading="lazy" /><span className="market-card-badge">已上架</span></div><div className="market-game-copy"><h3>{game.title.split('：')[1] || game.title}</h3><div className="crossover-card-pair"><span className="pair-character">{game.concept.pairing[0]}</span><span className="pair-cross">×</span><span className="pair-character">{game.concept.pairing[1]}</span></div><p className="crossover-card-description">{game.subtitle}</p><ShelfTags game={game} /><div className="crossover-card-footer"><div className="market-stats"><Stat icon="heart" value={game.stats.likes} /><Stat icon="bookmark" value={game.stats.favorites} /><Stat icon="play" value={game.stats.plays} /></div><span className="market-price is-free">{priceLabel(game)}</span></div></div></a>;
  return <a className="market-game-card" href={`#/games/${game.id}`}><div className="market-game-art"><img src={game.cover} alt="" loading="lazy" /><span className="market-card-badge">{game.playable ? '可试玩' : '作品展示'}</span>{game.remixable && <span className="market-remix-pill"><Icon name="spark" size={12} />可二创</span>}</div><div className="market-game-copy"><div className="market-game-title"><h3>{game.title}</h3><span className={`market-price ${game.pricing.type === 'free' ? 'is-free' : ''}`}>{priceLabel(game)}</span></div><p className="shelf-card-description">{game.subtitle}</p><ShelfTags game={game} /><p className="shelf-card-author">{game.author.name}</p><div className="market-stats"><Stat icon="heart" value={game.stats.likes} /><Stat icon="bookmark" value={game.stats.favorites} /><Stat icon="play" value={game.stats.plays} /></div></div></a>;
}

export function MarketplaceDetail({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<MarketplaceGame>();
  const [removed, setRemoved] = useState(false);
  const [comments, setComments] = useState<MarketplaceComment[]>([]);
  const [comment, setComment] = useState('');
  const [notice, setNotice] = useState('');
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await request<Project[] | { projects: Project[] }>('/api/projects');
        const ids = (Array.isArray(data) ? data : data.projects).map(item => item.id);
        const value = await marketplace.getGame(gameId);
        if (!active) return;
        if (value?.sourceProjectId && !ids.includes(value.sourceProjectId)) { setRemoved(true); return; }
        setGame(value);
      } catch {
        const value = await marketplace.getGame(gameId);
        if (active) setGame(value);
      }
    })();
    return () => { active = false; };
  }, [gameId]);
  useEffect(() => { let active = true; marketplace.listComments(gameId).then(value => { if (active) setComments(value); }); return () => { active = false; }; }, [gameId]);
  if (removed) return <div className="site-container site-empty"><h1>这个作品已经下架。</h1><p>它对应的项目在工作台里被删除了。</p><a className="site-button gold" href="#/games">返回游戏世界</a></div>;
  if (!game) return <div className="site-container market-detail-loading" role="status"><span className="site-spinner" />正在打开作品…</div>;
  if (game.concept) return <CrossoverDetail game={game} />;
  const currentGame = game;
  const previewPath = marketplacePreviewPath(game);
  async function updateLike() { const updated = await marketplace.toggleLike(currentGame.id); setGame(updated); setLiked(true); }
  async function updateFavorite() { const updated = await marketplace.toggleFavorite(currentGame.id); setGame(updated); setSaved(true); }
  async function remix() { const source = await marketplace.createRemix(currentGame.id); navigate(`/studio/new?sourceGameId=${encodeURIComponent(source.sourceGameId)}`); }
  async function submitComment() { try { const created = await marketplace.createComment(currentGame.id, comment); setComments(current => [created, ...current]); setComment(''); setNotice('评论已发布'); setTimeout(() => setNotice(''), 2200); } catch (error) { setNotice(error instanceof Error ? error.message : '评论发布失败'); } }
  return <div className="market-detail site-container"><a className="market-back" href="#/games"><Icon name="chevron-left" size={15} />返回商城</a><section className="market-detail-hero"><div className="market-detail-media"><div className="market-detail-cover"><img src={game.cover} alt="" /><span className="market-detail-gradient" />{previewPath && <a className="market-play-button" href={previewPath}><Icon name="play" size={22} />开始试玩</a>}</div><div className="market-shot-row">{game.screenshots.map((shot, index) => <img key={shot} src={shot} alt={`${game.title}截图 ${index + 1}`} />)}</div></div><div className="market-detail-info"><h1>{game.title}</h1><p className="market-detail-subtitle">{game.subtitle}</p><div className="market-author"><span className="market-avatar">{game.author.avatar}</span><span><small>由</small><strong>{game.author.name}{game.author.verified && <i>已认证</i>}</strong></span></div><p className="market-detail-description">{game.description}</p><div className="market-detail-price"><span>{priceLabel(game)}</span>{game.pricing.type === 'paid' && <small>一次购买，畅玩游戏</small>}</div><div className="market-detail-actions">{previewPath ? <a className="site-button gold" href={previewPath}>开始试玩</a> : <button className="site-button gold" disabled>暂无可玩版本</button>}{game.id === 'beyond-the-walls' && <a className="site-button outline" href="/downloads/beyond-the-walls-source.zip" download="高墙之外_源码版.zip"><Icon name="download" size={17} />下载源码 ZIP</a>}<button className={`market-icon-action ${liked ? 'is-active' : ''}`} onClick={updateLike}><Icon name="heart" size={17} />{game.stats.likes}</button><button className={`market-icon-action ${saved ? 'is-active' : ''}`} onClick={updateFavorite}><Icon name="bookmark" size={17} />{saved ? '已收藏' : '收藏'}</button></div><button className="market-remix-button" onClick={remix}><Icon name="spark" size={17} />以此为起点进行二创 <Icon name="arrow" size={15} /></button>{notice && <p className="market-notice" role="status">{notice}</p>}<div className="market-meta"><span><Icon name="play" size={14} />{game.stats.plays.toLocaleString()} 次游玩</span><span><Icon name="message" size={14} />{game.stats.comments} 条评论</span><span>更新于 {game.updatedAt}</span></div></div></section>{game.sourceGameId && <section className="market-origin"><div><span className="site-eyebrow">THE THREAD CONTINUES</span><h2>这个版本从哪里来</h2><p>这是一个基于原作的衍生版本。每一次二创，都让世界多出一条新的路径。</p></div><a href={`#/games/${game.sourceGameId}`}>查看原作 <Icon name="arrow" size={15} /></a></section>}<section className="market-detail-grid"><div><section className="market-detail-section"><div className="market-section-heading"><div><span className="site-eyebrow">A NOTE FROM THE MAKER</span><h2>关于这个世界</h2></div></div><p className="market-long-copy">{game.description} 你可以在这里慢慢探索角色留下的痕迹，也可以从一个熟悉的世界出发，写下自己的版本。</p></section><section className="market-detail-section market-comments"><div className="market-section-heading"><div><span className="site-eyebrow">FROM THE COMMUNITY</span><h2>玩家评论 <small>{comments.length}</small></h2></div></div><div className="market-comment-form"><span className="market-avatar">你</span><textarea value={comment} onChange={event => setComment(event.target.value)} placeholder="留下你走进这个世界时的感受…" rows={2} /><button className="site-button outline" onClick={submitComment}>发布评论</button></div><div className="market-comment-list">{comments.length ? comments.map(item => <Comment key={item.id} comment={item} />) : <p className="market-muted">还没有评论，成为第一个留下回声的人。</p>}</div></section></div><aside className="market-detail-aside"><div className="market-aside-card"><span className="site-eyebrow">DETAILS</span><dl><div><dt>题材</dt><dd>{game.tags.join(' / ')}</dd></div><div><dt>版本</dt><dd>1.0.0 · {game.updatedAt}</dd></div><div><dt>支持</dt><dd>桌面浏览器 / 移动端</dd></div><div><dt>可二创</dt><dd>{game.remixable ? '允许，保留来源归属' : '暂未开放'}</dd></div></dl></div><div className="market-aside-card market-aside-remix"><Icon name="spark" size={20} /><strong>想写下你的版本？</strong><p>从这个世界出发，保留它的回声，也加入你的选择。</p><button onClick={remix}>开始二创 <Icon name="arrow" size={14} /></button></div></aside></section></div>;
}

function Comment({ comment }: { comment: MarketplaceComment }) {
  return <article className="market-comment"><span className="market-avatar">{comment.avatar}</span><div><div className="market-comment-heading"><strong>{comment.author}</strong><time>{comment.createdAt}</time></div><p>{comment.content}</p><button type="button"><Icon name="heart" size={13} />{comment.likes}</button></div></article>;
}
