import { useEffect, useRef, useState } from 'react';
import { errorMessage, isAbort, previewUrl, request } from '../api.js';
import { Icon } from '../components/common.js';
import type { Project, ProjectDetail, Revision } from '../types.js';
import { WorldCard } from './chrome.js';
import { localWorlds, worlds } from './worlds.js';
import { playableRevision, revisionLabel } from './local-games.js';

import { UploadButton, UploadedGameCards, useUploadedGames } from './Uploads.js';
import { Marketplace } from './MarketPlacePage.js';

type LocalGame = { project: Project; revision: Revision };

export function GameWorld({ projectId }: { projectId?: string }) {
  return projectId ? <LocalGamePage key={projectId} projectId={projectId} /> : <Marketplace listing />;
}

function GameLibrary() {
  const [group, setGroup] = useState<'all' | 'examples' | 'local'>('all');
  const [query, setQuery] = useState('');
  const uploads = useUploadedGames();
  const [games, setGames] = useState<LocalGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setGames([]);
    async function load() {
      const projects = await request<Project[]>('/api/projects', { signal: controller.signal });
      const results = await Promise.allSettled(projects.map(project =>
        request<ProjectDetail>(`/api/projects/${encodeURIComponent(project.id)}`, { signal: controller.signal })));
      if (controller.signal.aborted) return;
      const available: LocalGame[] = [];
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const { project, revisions } = result.value;
        const revision = playableRevision(project, revisions);
        if (revision && previewUrl(revision.previewUrl)) available.push({ project, revision });
      }
      setGames(available.sort((a, b) => b.revision.createdAt.localeCompare(a.revision.createdAt)));
      if (results.some(result => result.status === 'rejected')) setError('部分游戏暂时无法读取，可稍后重试。');
    }
    load().catch(cause => { if (!isAbort(cause)) setError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  const needle = query.trim().toLocaleLowerCase();
  const matches = (title: string, tags: string[] = []) => `${title} ${tags.join(' ')}`.toLocaleLowerCase().includes(needle);
  const examples = worlds.filter(world => matches(world.title, world.tags));
  const bundled = localWorlds.filter(world => matches(world.title, world.tags));
  const uploaded = uploads.games.filter(game => matches(game.title, [game.description]));
  const local = games.filter(game => matches(game.project.title));
  return <div className="game-library site-container">
    <h1 className="sr-only">游戏世界</h1>
    <div className="library-toolbar">
      <div className="library-filters" role="group" aria-label="游戏分类">
        <button aria-pressed={group === 'all'} onClick={() => setGroup('all')}>全部</button>
        <button aria-pressed={group === 'examples'} onClick={() => setGroup('examples')}>示例游戏 <small>{worlds.length}</small></button>
        <button aria-pressed={group === 'local'} onClick={() => setGroup('local')}>我的游戏 <small>{loading ? '…' : localWorlds.length + games.length + uploads.games.length}</small></button>
      </div>
      <div className="library-tools"><label className="library-search"><span className="sr-only">搜索游戏</span><input type="search" placeholder="搜索游戏或题材…" value={query} onChange={event => setQuery(event.target.value)} /></label><UploadButton /></div>
    </div>
    {(group === 'all' || group === 'examples') && examples.length > 0 && <section className="library-section" aria-labelledby="example-games-title">
      <div className="section-title"><div><span className="site-eyebrow">FEATURED STORIES</span><h2 id="example-games-title">示例游戏</h2></div><span className="library-section-note">试玩原型，也看看故事的更多可能。</span></div>
      <div className="world-cards">{examples.map(world => <WorldCard key={world.id} world={world} />)}</div>
    </section>}
    {(group === 'all' || group === 'local') && <section className="library-section" aria-labelledby="local-games-title">
      <div className="section-title"><div><span className="site-eyebrow">MADE HERE</span><h2 id="local-games-title">我的游戏</h2></div><a className="text-link" href="#/projects">管理我的项目</a></div>
      {loading && <p className="library-message" role="status"><span className="site-spinner" />正在查找本机的试玩版本…</p>}
      {error && <div className="library-message" role="alert"><p>{error}</p><button className="site-button outline" onClick={() => setAttempt(value => value + 1)}>重新读取</button></div>}
      <div className="world-cards">{bundled.map(world => <WorldCard key={world.id} world={world} />)}{local.map(({ project, revision }) =>
        <a className="world-card local-game-card" href={`#/games/local/${encodeURIComponent(project.id)}`} key={project.id}>
          <div className="world-cover local-game-art"><span className="world-card-status">{revisionLabel(revision)}</span><span className="local-game-horizon" aria-hidden="true"><Icon name="layers" size={42} /></span><span className="local-game-art-title">{project.title}</span><span className="world-cover-arrow"><Icon name="play" size={22} /></span></div>
          <div className="world-card-copy"><div><h3>{project.title}</h3><p>本机制作 · {revision.buildMode === 'graybox' ? '玩法验证' : '游戏预览'}</p></div><span>试玩</span></div>
        </a>)}<UploadedGameCards games={uploaded} /></div>
      {uploads.error && <p className="library-message" role="alert">{uploads.error}</p>}
      {!loading && !error && games.length === 0 && !needle && <p className="library-message">本机项目生成试玩版本后，会自动出现在这里。</p>}
    </section>}

  </div>;
}

function LocalGamePage({ projectId }: { projectId: string }) {
  const [game, setGame] = useState<LocalGame>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playerNotice, setPlayerNotice] = useState('');
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setGame(undefined); setPlaying(false);
    request<ProjectDetail>(`/api/projects/${encodeURIComponent(projectId)}`, { signal: controller.signal }).then(detail => {
      const revision = playableRevision(detail.project, detail.revisions);
      if (!revision || !previewUrl(revision.previewUrl)) throw new Error('这个项目还没有可打开的试玩版本。');
      setGame({ project: detail.project, revision });
    }).catch(cause => { if (!isAbort(cause)) setError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId, attempt]);
  const url = previewUrl(game?.revision.previewUrl);
  return <section className="local-game-page site-container">
    <a className="text-link" href="#/games">返回游戏世界</a>
    {loading ? <div className="site-empty" role="status">正在打开我的游戏…</div> : error ? <div className="site-empty"><h1>暂时无法进入这个世界</h1><p>{error}</p><button className="site-button outline" onClick={() => setAttempt(value => value + 1)}>重新读取</button></div> : game && <>
      <div className="section-title"><div><span className="site-eyebrow">A WORLD MADE HERE</span><h1>{game.project.title}</h1><p>{revisionLabel(game.revision)}</p></div><a className="site-button outline" href={`#/studio/${encodeURIComponent(projectId)}`}>进入创作工作区</a></div>
      {game.revision.status !== 'accepted' && <p className="local-preview-note">{game.revision.buildMode === 'graybox' ? '这是使用临时美术的玩法原型，完整游戏尚未通过验收。' : '这是尚未通过验收的候选版本，可先体验当前制作进度。'}</p>}
      <div className="local-player" ref={frame}>
        <div className="local-player-screen">{playing && url
          ? <iframe src={url} title={`${game.project.title}试玩`} sandbox="allow-scripts allow-same-origin allow-pointer-lock" allow="autoplay; fullscreen" allowFullScreen />
          : <div className="local-player-cover"><Icon name="layers" size={50} /><h2>{game.project.title}</h2><button className="site-button gold" onClick={() => setPlaying(true)}><Icon name="play" />开始试玩</button></div>}
        </div>
        <div className="demo-toolbar"><span>点击画面进入游戏 · 手机建议横屏</span><div>{playing && <button onClick={() => setPlaying(false)}>退出试玩</button>}<button onClick={() => {
          const action = document.fullscreenElement ? document.exitFullscreen() : frame.current?.requestFullscreen?.();
          action?.catch(() => setPlayerNotice('暂时无法进入全屏，请使用窗口模式试玩。'));
        }}><Icon name="monitor" size={16} />全屏</button></div></div>
      </div>
      {playerNotice && <p className="library-message" role="status">{playerNotice}</p>}
    </>}
  </section>;
}
