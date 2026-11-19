import { useEffect, useState } from 'react';
import type { Capabilities, NewProject, Project, Revision, WorkspaceTab } from './types.js';
import { dateTime, isBusy } from './utils.js';
import { EmptyState, Icon, Loading, Modal, StatusBadge } from './components/common.js';
import { NewProjectDialog } from './components/NewProjectDialog.js';
import { SourceDialog } from './components/SourceDialog.js';
import { ChangeComposer, Production } from './components/Production.js';
import { Artifacts, Preview, RevisionSelect, Versions } from './components/RevisionViews.js';
import { useWorkspace } from './workspace/useWorkspace.js';
import { DemoProduction } from './demo/DemoProduction.js';
import { DemoArtifacts } from './demo/DemoArtifacts.js';
import { DemoPreview } from './demo/DemoPreview.js';
import { useDemoPlayback } from './demo/useDemoPlayback.js';
import { DEMO_MODE } from './demo/mode.js';
import './demo/demo.css';

const tabs: Array<{ id: WorkspaceTab; label: string; icon: string }> = [
  { id: 'production', label: '制作', icon: 'layers' }, { id: 'preview', label: '试玩', icon: 'play' },
  { id: 'artifacts', label: '素材与插件', icon: 'image' }, { id: 'versions', label: '版本', icon: 'history' },
];

export function App({ initialProjectId = '', startWithNew = false, sourceGameId, onExit, onHome }: { initialProjectId?: string; startWithNew?: boolean; sourceGameId?: string; onExit?: () => void; onHome?: () => void }) {
  const {
    capabilities, projects, booting, startupError, selectedProjectId, detail, selectedRunId,
    runDetail, selectedRevisionId, revisionDetail, revisionLoading, projectLoading, tab, actionBusy,
    connection, serviceError, notice, newProjectCreated, setNotice, setTab, refresh, retryBoot,
    manualRefresh, selectProject: selectWorkspaceProject, selectRun, selectRevision, createProject: createWorkspaceProject,
    startRun, mutate, controlRun, updateSource, rollbackTo, deleteProject,
  } = useWorkspace(initialProjectId);
  const [newDialog, setNewDialog] = useState(startWithNew);
  const [sourceDialog, setSourceDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project>();
  const [rollbackTarget, setRollbackTarget] = useState<Revision>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width:760px)').matches);

  useEffect(() => {
    const query = window.matchMedia('(max-width:760px)');
    const changed = () => { setNarrow(query.matches); if (!query.matches) setSidebarOpen(false); };
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);

  useEffect(() => {
    if (!narrow || !sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [narrow, sidebarOpen]);

  function selectProject(id: string) {
    selectWorkspaceProject(id);
    setSidebarOpen(false);
  }

  async function createProject(value: NewProject) {
    await createWorkspaceProject(value);
    setSidebarOpen(false);
  }

  async function rollback() {
    if (!rollbackTarget || !selectedProjectId) return;
    await rollbackTo(rollbackTarget.id);
    setRollbackTarget(undefined);
  }

  const project = detail?.project.id === selectedProjectId ? detail.project : projects.find(item => item.id === selectedProjectId);
  const demoActive = DEMO_MODE && Boolean(selectedProjectId);
  const demo = useDemoPlayback(demoActive, `${selectedProjectId}:${selectedRunId}`);
  const currentDetail = detail?.project.id === selectedProjectId ? detail : undefined;
  const currentRunDetail = runDetail?.run.id === selectedRunId ? runDetail : undefined;
  const currentRevisionDetail = revisionDetail?.revision.id === selectedRevisionId ? revisionDetail : undefined;
  const running = currentDetail?.runs.some(run => isBusy(run.status)) || false;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">跳到工作区</a>
    {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="收起项目列表" />}
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="项目导航" aria-hidden={narrow && !sidebarOpen} inert={narrow && !sidebarOpen}><a className="brand" href="#/" onClick={event => { event.preventDefault(); onHome?.(); }}><span className="brand-mark"><i /><i /><i /><i /></span><span>CREATE WORLD<small>故事创作空间</small></span></a>
      <button className="studio-return" onClick={onExit}><Icon name="arrow" size={15} />返回我的项目</button>
      <button className="button new-project-button" onClick={() => setNewDialog(true)} disabled={booting || Boolean(startupError)}><Icon name="plus" />新建游戏项目</button>
      <div className="sidebar-section-heading"><span>我的项目</span><span>{projects.length}</span></div>
      <nav className="project-nav" aria-label="我的项目">{projects.length === 0 ? <p className="sidebar-empty">从一个故事开始，<br />让它成为能探索的世界。</p> : projects.map(item => <div className="project-row" key={item.id}><button className={`project-nav-item ${item.id === selectedProjectId ? 'active' : ''}`} onClick={() => selectProject(item.id)} aria-current={item.id === selectedProjectId ? 'page' : undefined}><span className="project-glyph"><Icon name="folder" size={18} /></span><span><strong>{item.title}</strong><small>{dateTime(item.updatedAt)}</small></span>{isBusy(item.status) && <span className="project-running" aria-label="正在制作" />}</button><button type="button" className="project-delete" aria-label={`删除项目 ${item.title}`} title="删除项目" onClick={() => setDeleteTarget(item)}><Icon name="trash" size={14} /></button></div>)}</nav>
      <div className="sidebar-bottom"><div className="local-label"><span className="local-dot" />保存在这台电脑上</div><CapabilitySummary capabilities={capabilities} booting={booting} /><p>创作交给工具，<br />世界由你决定。</p></div>
    </aside>
    <div className="workspace"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="展开项目列表"><Icon name="menu" /></button><span>工作台</span><Icon name="chevron" size={13} /><strong>{project?.title || '我的创作'}</strong></div><div className="topbar-actions"><span className="topbar-local">LOCAL WORKSPACE</span><button className="icon-button" onClick={() => { if (startupError) retryBoot(); else void manualRefresh(); }} aria-label="刷新项目数据" disabled={booting}><Icon name="refresh" size={17} /></button></div></header>
      <main id="main-content" tabIndex={-1} className="workspace-content">
        {notice && <div className={`notification ${notice.error ? 'error' : ''}`} role={notice.error ? 'alert' : 'status'}><Icon name={notice.error ? 'warning' : 'check'} /><span>{notice.message}</span><button className="icon-button" aria-label="关闭通知" onClick={() => setNotice(undefined)}><Icon name="close" size={15} /></button></div>}
        {serviceError && <div className="service-error" role="alert"><Icon name="warning" /><span>{serviceError}</span><button className="button ghost small" onClick={refresh}>重试</button></div>}
        {booting ? <Loading label="正在连接本地工作台…" /> : startupError ? <section className="panel"><EmptyState icon="warning" title="还没有连接到本地服务" action={<button className="button primary" onClick={retryBoot}><Icon name="refresh" />重新连接</button>}><p>{startupError}</p></EmptyState></section> : !project ? <Welcome onCreate={() => setNewDialog(true)} /> : <>
          <div className="page-heading"><div><span className="eyebrow">你的游戏项目</span><h1>{project.title}</h1><p>{project.inputKind === 'text' ? '从文字材料出发' : '从作品名出发'}<span className="middle-dot">·</span>像素剧情探索<span className="middle-dot">·</span>{dateTime(project.updatedAt)} 更新</p></div><StatusBadge status={demo.done ? 'completed' : 'running'} /></div>
          <div className="workspace-nav"><nav className="tabs" aria-label="项目工作区">{tabs.map(item => <button key={item.id} className={tab === item.id ? 'selected' : ''} aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}><Icon name={item.icon} size={17} />{item.label}{item.id === 'versions' && Boolean(currentDetail?.revisions.length) && <span>{currentDetail?.revisions.length}</span>}</button>)}</nav>{(tab === 'preview' || tab === 'artifacts') && <RevisionSelect revisions={currentDetail?.revisions || []} selectedId={selectedRevisionId} onSelect={selectRevision} />}<a className="export-cta" href={`#/export/${encodeURIComponent(project.id)}`} title="打开导出与展示页面"><Icon name="download" size={15} />导出游戏</a></div>
          {projectLoading && !currentDetail ? <Loading /> : !currentDetail && !demoActive ? <section className="panel"><EmptyState title="项目详情暂时不可用" action={<button className="button primary" onClick={refresh}>重试</button>} /></section> : tab === 'production' ? (demoActive ? <DemoProduction playback={demo} onOpenArtifacts={() => setTab('artifacts')} /> : <Production project={project} runs={currentDetail?.runs || []} selectedRunId={selectedRunId} detail={currentRunDetail} connection={connection} actionBusy={actionBusy} onSelectRun={selectRun} onGenerate={() => void mutate(() => startRun('generate'))} onCancel={id => void mutate(() => controlRun(id, 'cancel'))} onResume={id => void mutate(() => controlRun(id, 'resume'))} onChange={instruction => startRun('change', instruction)} onEditSource={() => setSourceDialog(true)} />) : tab === 'preview' ? <div className="studio-preview-layout"><aside className="studio-creative-column"><ChangeComposer disabled={running || !project.currentRevisionId} onSubmit={instruction => startRun('change', instruction)} /><section className="panel studio-progress-card"><span className="eyebrow">创作进度</span><h2>{running ? '这个世界正在生长' : project.currentRevisionId ? '继续完善你的世界' : '从故事开始，等待世界成形'}</h2><p>{running ? '后台正在制作。已完成的版本仍然可以试玩。' : project.currentRevisionId ? '试玩后告诉我想调整什么，新的修改会保留历史版本。' : '创建或继续制作后，可玩的版本会出现在右侧。'}</p><button className="button secondary" onClick={() => setTab('production')}><Icon name="layers" size={16} />{running ? '查看制作进度' : '查看制作与任务'}</button><button className="button ghost" disabled={running || actionBusy} onClick={() => setSourceDialog(true)}><Icon name="file" size={16} />查看故事材料</button></section></aside>{demoActive ? <DemoPreview /> : <Preview detail={currentRevisionDetail} loading={revisionLoading} currentRevisionId={project.currentRevisionId} />}</div> : tab === 'artifacts' ? (demoActive ? <DemoArtifacts /> : <Artifacts detail={currentRevisionDetail} loading={revisionLoading} />) : <Versions revisions={currentDetail?.revisions || []} currentRevisionId={project.currentRevisionId} busy={actionBusy || running} onView={id => { selectRevision(id); setTab('preview'); }} onRollback={setRollbackTarget} />}
        </>}
      </main><footer className="workspace-footer"><span>CREATE WORLD</span><span>材料、版本与制作记录保存在本机</span></footer>
    </div>
    {newDialog && !booting && !startupError && <NewProjectDialog onClose={() => { setNewDialog(false); if (startWithNew && !newProjectCreated.current) onExit?.(); }} onCreate={createProject} backendReady={Boolean(capabilities.codex?.available)} sourceGameId={sourceGameId} />}
    {sourceDialog && project && <SourceDialog project={project} canResume={Boolean(currentDetail?.runs.find(run => run.id === selectedRunId && ['failed', 'blocked', 'cancelled', 'interrupted'].includes(run.status)))} onSave={updateSource} onClose={() => setSourceDialog(false)} />}
    {rollbackTarget && <Modal title="切换到这个版本" onClose={() => { if (!actionBusy) setRollbackTarget(undefined); }}><p>当前游戏将切换为 <strong>{rollbackTarget.title || '所选版本'}</strong>（{dateTime(rollbackTarget.createdAt)}）。已有版本仍保留，玩家存档按版本处理。</p><div className="modal-actions"><button className="button secondary" disabled={actionBusy} onClick={() => setRollbackTarget(undefined)}>取消</button><button className="button primary" disabled={actionBusy} onClick={() => void mutate(rollback)}>{actionBusy ? <span className="spinner" /> : <Icon name="history" />}切换版本</button></div></Modal>}
    {deleteTarget && <Modal title="删除这个项目？" onClose={() => setDeleteTarget(undefined)}>
      <p>「<strong>{deleteTarget.title}</strong>」的项目记录、制作版本与生成素材会一起删除，<strong>无法恢复</strong>。</p>
      <p className="muted">如果只是想重新开始，也可以保留这个项目，在制作页用一句话提交修改。</p>
      <div className="modal-actions">
        <button className="button secondary" onClick={() => setDeleteTarget(undefined)}>取消</button>
        <button className="button danger" onClick={async () => { const target = deleteTarget; setDeleteTarget(undefined); try { await deleteProject(target.id); } catch (cause) { setNotice({ message: cause instanceof Error ? cause.message : '删除失败，请重试。', error: true }); } }}><Icon name="trash" size={15} />确认删除</button>
      </div>
    </Modal>}
  </div>;
}

function CapabilitySummary({ capabilities, booting }: { capabilities: Capabilities; booting: boolean }) {
  if (DEMO_MODE) return null;
  const image = capabilities.image?.status;
  const imageReady = image && ['passed', 'available', 'ready', 'verified', 'supported'].includes(image);
  return <details className="capabilities"><summary>制作能力 <span>{booting ? '连接中' : capabilities.codex?.available ? '已检测到 Codex' : '查看状态'}</span></summary><dl><div><dt>Codex</dt><dd>{capabilities.codex?.available ? capabilities.codex.version || '可用' : '未就绪'}</dd></div><div><dt>浏览器检查</dt><dd>{capabilities.browser?.available ? '可用' : '未就绪'}</dd></div><div><dt>图像生成</dt><dd>{imageReady ? '可用' : image === 'unavailable' ? '不可用' : image || '待实际调用验证'}</dd></div></dl></details>;
}

function Welcome({ onCreate }: { onCreate: () => void }) {
  return <div className="welcome"><div className="welcome-hero"><div className="welcome-copy"><span className="eyebrow">一个故事，无数个可以走进去的瞬间</span><h1>把故事，做成<br /><em>可以探索的世界。</em></h1><p>从作品名或文字材料开始。让角色、场景与对白在同一个像素世界里相遇，制作、试玩，再用一句话继续修改。</p><button className="button primary large" onClick={onCreate}>创建第一个游戏<Icon name="arrow" /></button><div className="welcome-tags"><span>像素剧情探索</span><span>默认 约 10 分钟、至少 5 个场景</span><span>本地制作与保存</span></div></div><div className="world-illustration" aria-hidden="true"><div className="pixel-stars"><i /><i /><i /><i /></div><div className="pixel-moon" /><div className="world-ground"><div className="world-path" /><div className="world-house"><i /><b /><span /></div><div className="world-tree tree-one" /><div className="world-tree tree-two" /><div className="world-character"><i /></div><div className="world-sign" /></div><span className="illustration-caption">每一个世界，都从一个故事开始</span></div></div><div className="welcome-steps"><article><span>01</span><Icon name="file" size={24} /><h2>故事有来源</h2><p>整理人物动机、关键因果和原结局，补写的内容单独标记。</p></article><article><span>02</span><Icon name="layers" size={24} /><h2>制作看得见</h2><p>查看真实任务和产物，自动检查玩法、素材与运行结果。</p></article><article><span>03</span><Icon name="history" size={24} /><h2>修改可回退</h2><p>调整对白、角色或场景，复用已完成的部分，保留每个版本。</p></article></div></div>;
}
