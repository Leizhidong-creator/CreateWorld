import { openWorlds } from './navigation.js';
import { setTheme, useTheme } from './theme.js';
import { useState } from 'react';
import { Icon } from '../components/common.js';
import { featuredWorlds, type World } from './worlds.js';

export function BrandSymbol() {
  return <svg className="world-brand-symbol" viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <path className="brand-paper" d="M3 9 13 4v26L3 25V9Z" />
    <path className="brand-pencil" d="m6 12 4-2m-4 7 4-2m-4 7 4-2" strokeWidth="1.1" strokeLinecap="round" />
    <path className="brand-frame" d="M13 6h11v4h-7v16h12V16h4v14H13V6Z" />
    <path className="brand-land" d="M19 24v-5h4v-4h4v9h-8Z" />
    <path className="brand-pixel" d="M24 6h4v4h-4zM29 11h4v4h-4z" />
    <path className="brand-spark" d="M30 3h3v3h-3z" />
  </svg>;
}

export function Logo() {
  return <a className="site-brand" href="#/" aria-label="Create World 首页"><BrandSymbol /><span>CREATE WORLD</span></a>;
}

export function SiteHeader({ page }: { page: string }) {
  const [menu, setMenu] = useState(false);
  const theme = useTheme();
  return <header className="site-header"><div className="site-header-inner">
    <div className="site-brand-cluster"><Logo /><span className="site-version-badge">超前体验版</span></div>
    <button className="site-menu" aria-label={menu ? '收起导航' : '展开导航'} aria-expanded={menu} aria-controls="site-navigation" onClick={() => setMenu(!menu)}><Icon name={menu ? 'close' : 'menu'} /></button>
    <nav id="site-navigation" className={menu ? 'site-nav open' : 'site-nav'} aria-label="主导航" onClick={() => setMenu(false)}>
      <a href="#/" aria-current={page === 'home' ? 'page' : undefined}>首页</a>
      <a href="#/games" aria-current={page === 'games' ? 'page' : undefined} onClick={event => { event.preventDefault(); openWorlds(); }}>游戏世界</a>
      <a href="#/plugins" aria-current={page === 'plugins' ? 'page' : undefined}>插件市场</a>
      <a href="#/projects" aria-current={page === 'projects' ? 'page' : undefined}>我的项目</a>
    </nav>
    <button className="site-theme-toggle" type="button" aria-label={theme === 'light' ? '切换到黑夜模式' : '切换到白天模式'} title={theme === 'light' ? '切换到黑夜模式' : '切换到白天模式'} aria-pressed={theme === 'dark'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{theme === 'light' ? <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>}</svg>
    </button>
  </div></header>;
}

export function SiteFooter() {
  return <footer className="site-footer"><Logo /><span>FROM WORDS TO WORLDS</span><span className="site-footer-links"><a href="#/plugins">一起共创</a><a href="#/contact">联系我们</a></span></footer>;
}

export function WorldCards({ exclude, compact = false }: { exclude?: string; compact?: boolean }) {
  return <div className={`world-cards ${compact ? 'compact' : ''}`}>{featuredWorlds.filter(world => world.id !== exclude).map(world => <WorldCard key={world.id} world={world} />)}</div>;
}

export function WorldCard({ world }: { world: World }) {
  return <a className={`world-card world-${world.id}`} href="#/games">
    <div className="world-cover"><img src={world.cover} alt={`${world.title}：${world.tagline}`} loading="lazy" width="1100" height="619" /><span className="world-card-status">{world.local ? '我的游戏' : world.playable ? '可玩原型' : world.showcase ? '作品展示' : '概念世界'}</span>{world.playable && <span className="world-cover-arrow"><Icon name="play" size={22} /></span>}</div>
    <div className="world-card-copy"><div><h3>{world.title}</h3><p>{world.tags.join(' · ')}</p></div><span>{world.playable ? '试玩' : '探索'}</span></div>
  </a>;
}
