import { THREE_BODY_IDEA } from './demo-idea.js';
import { navigate } from './navigation.js';
import { BrandSymbol } from './chrome.js';
import { useEffect, useState } from 'react';
import { errorMessage, isAbort, request } from '../api.js';
import { Icon } from '../components/common.js';
import type { Bootstrap, Project } from '../types.js';
import { dateTime, humanStatus, isBusy } from '../utils.js';

import { UploadButton, UploadedGames } from './Uploads.js';

const PROJECT_COVERS: Array<{ match: RegExp; cover: string }> = [
  { match: /三体/, cover: '/worlds/three-body.png' },
];

function projectCover(title: string): string | undefined {
  return PROJECT_COVERS.find(item => item.match.test(title))?.cover;
}

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    request<Bootstrap>('/api/bootstrap', { signal: controller.signal }).then(data => {
      setProjects([...(data.projects || [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setLoading(false);
    }).catch(cause => { if (!isAbort(cause)) { setError(errorMessage(cause)); setLoading(false); } });
    return () => controller.abort();
  }, [attempt]);
  const filtered = projects.filter(project => project.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <section className="projects-page site-container">
    <div className="section-title"><div><span className="site-eyebrow">YOUR CREATIVE SPACE</span><h1>你的世界，正在生长。</h1><p>从上次停下的地方，继续创造。</p></div><div className="site-actions"><UploadButton /><a className="site-button outline" href="#/studio/new"><Icon name="plus" />新建游戏</a></div></div>
    <div className="projects-toolbar"><span>我的项目 <b>{projects.length}</b></span><label><span className="sr-only">搜索项目</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索你的世界…" /></label></div>
    {loading ? <div className="site-empty" role="status"><span className="site-spinner" />正在打开你的创作空间…</div> : error ? <div className="site-empty"><Icon name="monitor" size={32} /><h2>本地工作台还没有连接</h2><p>{error}</p><div className="site-actions"><button className="site-button outline" onClick={() => setAttempt(value => value + 1)}><Icon name="refresh" size={16} />重新连接</button><a className="site-button gold" href="#/plugins">浏览插件</a></div></div> :
      projects.length === 0 ? <div className="first-world"><BrandSymbol /><h2>你的第一个世界，<br />会是什么样子？</h2><p>从一个作品名，或你自己的故事开始。</p><button type="button" className="site-button gold" onClick={() => { sessionStorage.setItem('cw.creation-idea', THREE_BODY_IDEA); navigate('/studio/new'); }}>创建第一个游戏</button><small className="first-world-note">当前仅开放体验版</small></div> :
      filtered.length === 0 ? <div className="site-empty"><h2>没有找到这个项目</h2><button className="site-button outline" onClick={() => setQuery('')}>查看全部项目</button></div> :
      <div className="project-grid">{filtered.map((project, index) => <a key={project.id} className="project-tile" href={`#/studio/${encodeURIComponent(project.id)}`}><div className={`project-tile-art art-${index % 3}${projectCover(project.title) ? ' has-cover' : ''}`}>{projectCover(project.title) && <img className="project-cover" src={projectCover(project.title)} alt="" loading="lazy" />}<span className="project-number">WORLD / {String(index + 1).padStart(2, '0')}</span>{!projectCover(project.title) && <Icon name="layers" size={48} />}<span className={`project-state ${isBusy(project.status) ? 'busy' : ''}`}><i />{humanStatus(project.status)}</span></div><div className="project-tile-copy"><h2>{project.title}</h2><p>{dateTime(project.updatedAt)} 更新</p></div></a>)}<a className="project-new-tile" href="#/studio/new"><Icon name="plus" size={28} /><h2>开始一个新故事</h2><span>让想象继续生长</span></a></div>}
    <UploadedGames query={query} />
    <div className="project-inspiration"><a className="text-link" href="#/plugins">发现创作插件</a></div>
    <p className="local-storage-note">项目保存在这台电脑上</p>
  </section>;
}
