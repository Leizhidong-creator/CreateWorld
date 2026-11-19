import { lazy, Suspense, useEffect, useRef } from 'react';
import { SiteFooter, SiteHeader } from './chrome.js';
import { legacyDestination, navigate, useRoute } from './navigation.js';
import './site.css';
import './daylight.css';
import './crossovers.css';
import './shelf-cards.css';
import { Marketplace, MarketplaceDetail } from './MarketPlacePage.js';
import { worldById } from './worlds.js';
import { Publish } from './Publish.js';
import { ExportShowcase } from './Export.js';
import { Contact } from './Contact.js';
const DemoPlayer = lazy(() => import('./DemoPlayer.js'));
const PluginContribute = lazy(() => import('./PluginContribute.js').then(module => ({ default: module.PluginContribute })));
const PluginMarket = lazy(() => import('./PluginMarket.js').then(module => ({ default: module.PluginMarket })));
const GameWorld = lazy(() => import('./GameWorld.js').then(module => ({ default: module.GameWorld })));
const Projects = lazy(() => import('./Projects.js').then(module => ({ default: module.Projects })));
const Workbench = lazy(() => import('../App.js').then(module => ({ default: module.App })));

export function Portal() {
  const route = useRoute();
  const main = useRef<HTMLElement>(null);
  const path = route.split('?')[0];
  const routeParams = new URLSearchParams(route.split('?')[1] || '');
  useEffect(() => {
    const destination = legacyDestination(route);
    if (destination) navigate(destination, true);
  }, [route]);
  const sourceGameId = routeParams.get('sourceGameId') || undefined;
  let localProjectId: string | undefined;
  let marketplaceGameId: string | undefined;
  if (path.startsWith('/games/local/')) {
    try { localProjectId = decodeURIComponent(path.slice('/games/local/'.length)); } catch { localProjectId = 'invalid-project'; }
  }
  if (path.startsWith('/games/') && !path.startsWith('/games/local/') && path !== '/games/mine') marketplaceGameId = decodeURIComponent(path.slice('/games/'.length));
  const previewRoute = path.startsWith('/games/preview/');
  const previewWorld = previewRoute ? worldById(path.slice('/games/preview/'.length)) : undefined;
  const studio = path.startsWith('/studio/');
  const page = path === '/' ? 'home' : path === '/plugins' || path.startsWith('/plugins/') ? 'plugins' : path === '/games' || path.startsWith('/games/') ? 'games' : path === '/publish' ? 'publish' : path === '/projects' ? 'projects' : path === '/contact' ? 'contact' : path.startsWith('/export/') ? 'export' : 'missing';
  useEffect(() => {
    const labels: Record<string, string> = { home: '把故事变成世界', plugins: '插件市场', games: '游戏世界', publish: '发布游戏', projects: '我的项目', export: '导出与展示', contact: '联系我们', missing: '寻找新的世界' };
    document.title = `Create World · ${studio ? '创作工作区' : labels[page]}`;
    if (!studio) main.current?.focus({ preventScroll: true });
  }, [route, studio, page]);
  useEffect(() => {
    if (path !== '/' || new URLSearchParams(route.split('?')[1] || '').get('section') !== 'worlds') return;
    navigate('/games', true);
  }, [path, route]);
  if (studio) {
    let projectId = '';
    try { projectId = decodeURIComponent(path.slice('/studio/'.length)); } catch { /* Invalid URL falls back to the workbench. */ }
    return <div className="workbench"><Suspense fallback={<div className="site-route-loading" role="status">正在进入创作工作区…</div>}><Workbench key={path + (sourceGameId || '')} initialProjectId={projectId === 'new' ? '' : projectId} startWithNew={projectId === 'new'} sourceGameId={sourceGameId} onExit={() => navigate('/projects')} onHome={() => navigate('/')} /></Suspense></div>;
  }
  return <div className={`portal page-${page === 'home' ? 'creation-home' : page}`}><a className="site-skip" href="#site-content" onClick={event => { event.preventDefault(); main.current?.focus(); }}>跳到主要内容</a><SiteHeader page={page === 'home' && routeParams.get('section') === 'worlds' ? 'games' : page} />
    <main id="site-content" ref={main} tabIndex={-1}><Suspense fallback={<div className="site-route-loading" role="status"><span className="site-spinner" />正在打开页面…</div>}>
      {page === 'home' ? <Marketplace /> : page === 'plugins' ? path === '/plugins/contribute' ? <PluginContribute key={route} sourceId={routeParams.get('source') || undefined} /> : <PluginMarket key={path} id={path.split('/')[2]} /> : page === 'games' ? previewRoute ? <section className="site-container"><a className="plugin-back" href="#/games">← 游戏世界</a>{previewWorld?.playable ? <DemoPlayer world={previewWorld} /> : <div className="site-empty"><h1>这个游戏暂时无法试玩。</h1></div>}</section> : marketplaceGameId ? <MarketplaceDetail gameId={marketplaceGameId} /> : path === '/games/mine' ? <Marketplace mine /> : <GameWorld projectId={localProjectId} /> : page === 'publish' ? <Publish /> : page === 'projects' ? <Projects /> : page === 'export' ? <ExportShowcase projectId={decodeURIComponent(path.slice('/export/'.length))} /> : page === 'contact' ? <Contact /> : <div className="site-empty"><h1>这条路还没有通向一个世界。</h1><a className="site-button gold" href="#/">返回首页</a></div>}
    </Suspense></main><SiteFooter /></div>;
}
