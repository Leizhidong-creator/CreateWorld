import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/common.js';
import { apiUrl, errorMessage, request } from '../api.js';
import type { Project, ProjectDetail } from '../types.js';
import { EXPORT_MEDIA } from './export-media.js';
import { findPublished, publishGame } from './publish-store.js';
import { navigate } from './navigation.js';
import './export.css';

export function ExportShowcase({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project>();
  const [revisionId, setRevisionId] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [published, setPublished] = useState(() => Boolean(findPublished(projectId)));

  useEffect(() => {
    let active = true;
    request<ProjectDetail>(`/api/projects/${encodeURIComponent(projectId)}`)
      .then(detail => {
        if (!active) return;
        setProject(detail.project);
        setRevisionId(detail.project.currentRevisionId || detail.revisions[0]?.id || '');
      })
      .catch(cause => { if (active) setError(errorMessage(cause)); });
    return () => { active = false; };
  }, [projectId]);

  const downloadUrl = revisionId ? apiUrl(`/api/projects/${encodeURIComponent(projectId)}/revisions/${encodeURIComponent(revisionId)}/export`) : '';

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}#/export/${projectId}`;
  }, [projectId]);

  function publish() {
    publishGame(projectId);
    setPublished(true);
    navigate('/games');
  }

  async function copyLink() {
    try {
      await navigator.clipboard?.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setError('复制失败，可以手动选中地址栏里的链接。'); }
  }

  return <div className="export-page site-container">
    <div className="export-bg" aria-hidden="true"><div className="export-bg-photo" /></div>
    <a className="export-back" href={`#/studio/${encodeURIComponent(projectId)}`}><Icon name="arrow" size={15} />返回工作台</a>

    <header className="export-head">
      <div>
        <span className="site-eyebrow">EXPORT &amp; SHOWCASE</span>
        <h1>{project?.title || '导出这个世界'}</h1>
      </div>
      <button type="button" className="export-publish" onClick={publish}>
        <Icon name="arrow" size={16} />
        {published ? '已上架 · 去看商城' : '一键上架到商城'}
      </button>
    </header>

    {error && <p className="export-error" role="alert">{error}</p>}

    <div className="export-stages">
      <section className="export-stage">
        <header className="export-stage-head">
          <span className="export-stage-label"><Icon name="play" size={14} />试玩</span>
        </header>
        <div className={`export-frame${EXPORT_MEDIA.gameUrl ? ' has-media' : ''}`}>
          <i className="export-corner corner-tl" aria-hidden="true" />
          <i className="export-corner corner-tr" aria-hidden="true" />
          <i className="export-corner corner-bl" aria-hidden="true" />
          <i className="export-corner corner-br" aria-hidden="true" />
          {EXPORT_MEDIA.gameUrl
            ? <iframe title="游戏试玩" src={EXPORT_MEDIA.gameUrl} allow="autoplay; fullscreen" />
            : <div className="export-placeholder">
                <span className="export-placeholder-icon"><Icon name="play" size={26} /></span>
                <strong>试玩暂未接入</strong>
                <small>接入后可以直接在这里用键盘游玩</small>
              </div>}
        </div>
      </section>

      <section className="export-stage">
        <header className="export-stage-head">
          <span className="export-stage-label"><Icon name="monitor" size={14} />演示</span>
        </header>
        <div className={`export-frame${EXPORT_MEDIA.demoUrl || EXPORT_MEDIA.videoUrl ? ' has-media' : ''}`}>
          <i className="export-corner corner-tl" aria-hidden="true" />
          <i className="export-corner corner-tr" aria-hidden="true" />
          <i className="export-corner corner-bl" aria-hidden="true" />
          <i className="export-corner corner-br" aria-hidden="true" />
          {EXPORT_MEDIA.demoUrl
            ? <iframe title="游戏自动演示" src={EXPORT_MEDIA.demoUrl} allow="autoplay; fullscreen" />
            : EXPORT_MEDIA.videoUrl
              ? <video src={EXPORT_MEDIA.videoUrl} poster={EXPORT_MEDIA.posterUrl} controls playsInline preload="metadata" />
              : <div className="export-placeholder">
                  <span className="export-placeholder-icon"><Icon name="monitor" size={26} /></span>
                  <strong>演示暂未接入</strong>
                  <small>接入后可以在这里播放这段世界的演示</small>
                </div>}
        </div>
      </section>
    </div>

    <div className="export-actions">
      {downloadUrl
        ? <a className="site-button gold" href={downloadUrl} download="三体-封面概念图.png"><Icon name="download" size={16} />下载 ZIP</a>
        : <button className="site-button gold" type="button" disabled title="演示版本还没有生成可导出的构建"><Icon name="download" size={16} />下载 ZIP</button>}
      <button className="site-button outline" type="button" onClick={copyLink}><Icon name="link" size={16} />{copied ? '已复制链接' : '复制分享链接'}</button>
      <a className="text-link" href={`#/studio/${encodeURIComponent(projectId)}`}>回到工作台继续修改</a>
    </div>
  </div>;
}
