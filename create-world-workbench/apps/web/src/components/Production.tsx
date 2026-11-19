import { useState, type FormEvent } from 'react';
import type { Project, Run, RunDetail } from '../types.js';
import { dateTime, friendlyRunError, humanStage, humanStatus, isBusy, passedStatuses } from '../utils.js';
import { errorMessage } from '../api.js';
import { EmptyState, Icon, JsonDetails, StatusBadge } from './common.js';

export function ChangeComposer({ disabled, onSubmit }: { disabled: boolean; onSubmit: (instruction: string) => Promise<void> }) {
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!instruction.trim() || busy || disabled) return;
    setBusy(true); setError('');
    try { await onSubmit(instruction.trim()); setInstruction(''); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <section className="panel change-panel"><div className="panel-heading"><div><span className="eyebrow">继续创作</span><h2>用一句话修改游戏</h2></div><Icon name="edit" size={21} /></div><p className="muted">描述要改变的内容。工作台会重做受影响部分，并保留当前可玩版本。</p><form onSubmit={submit}><label className="sr-only" htmlFor="change-instruction">修改要求</label><textarea id="change-instruction" value={instruction} onChange={event => setInstruction(event.target.value)} disabled={disabled || busy} rows={4} placeholder="例如：让守门人的对白更克制，保留任务条件和奖励。" /><div className="composer-bottom"><span>{disabled ? '当前制作结束后可继续修改' : '新候选通过检查后才替换当前版本'}</span><button className="button primary small" disabled={disabled || busy || !instruction.trim()}>{busy ? <span className="spinner" /> : <Icon name="arrow" />}提交修改</button></div>{error && <p className="inline-error" role="alert">{error}</p>}</form></section>;
}

export function Production({ project, runs, selectedRunId, detail, connection, actionBusy, onSelectRun, onGenerate, onCancel, onResume, onChange, onEditSource }: {
  project: Project; runs: Run[]; selectedRunId?: string; detail?: RunDetail; connection: string; actionBusy: boolean;
  onSelectRun: (id: string) => void; onGenerate: () => void; onCancel: (id: string) => void; onResume: (id: string) => void; onChange: (instruction: string) => Promise<void>; onEditSource: () => void;
}) {
  const run = detail?.run || runs.find(item => item.id === selectedRunId);
  const tasks = [...(detail?.tasks || [])].sort((a, b) => ((a as any).evidenceKind==='model'?0:1)-((b as any).evidenceKind==='model'?0:1)||((a as any).order??0)-((b as any).order??0)||(a.startedAt||'').localeCompare(b.startedAt||''));
  const planned = tasks.filter(task => task.evidenceKind === 'model');
  const executed = tasks.filter(task => task.evidenceKind !== 'model');
  const completed = planned.filter(task => passedStatuses.has(task.status)).length;
  const executing = (status: string) => ['running', 'validating'].includes(status);
  const active = runs.some(item => isBusy(item.status));
  const [allEvents, setAllEvents] = useState(false);
  const events = [...(detail?.events || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const meaningfulEvents = events.filter(event => event.type !== 'activity');
  const visibleEvents = allEvents ? events : meaningfulEvents.slice(0, 12);
  const canResume = run && ['failed', 'blocked', 'cancelled', 'interrupted'].includes(run.status);
  const friendlyError = friendlyRunError(run?.error);
  const [copiedDiagnostic, setCopiedDiagnostic] = useState(false);

  function downloadLog() {
    if (!detail) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `create-world-run-${detail.run.id}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="production-grid"><div className="main-column">
    <section className="panel production-summary">
      <div className="panel-heading"><div><span className="eyebrow">制作状态</span><h2>{run ? humanStage(run.stage) : '这个故事，准备出发'}</h2></div><StatusBadge status={run?.status || project.status} /></div>
      <p className="muted">{run ? isBusy(run.status) ? '进度来自后台任务；已通过的产物会保留，检查未通过的部分按结果修复。' : passedStatuses.has(run.status) ? '本次任务已结束。前往试玩，或继续描述你希望调整的地方。' : '本次任务保留了已有产物和诊断。查看下方原因后，可以继续执行。' : '一次提交整部游戏任务，Codex 将自主设计玩法、制作、测试并修复。'}</p>
      {planned.length > 0 && <div className="task-progress"><div className="progress-label"><span>已完成工作记录</span><strong>{completed}<span> / {planned.length}</span></strong></div><small>工作安排会动态调整；完成数量不是整部游戏完成百分比。</small></div>}
      {friendlyError && <div className="failure-note" role="alert"><Icon name="warning" /><div><strong>{friendlyError.title}</strong><p>{friendlyError.message}</p><p className="failure-action">{friendlyError.action}</p><details className="diagnostic-details"><summary>查看给 AI 的诊断</summary><pre>{friendlyError.aiPrompt}</pre><button className="button ghost small" type="button" onClick={async () => { try { await navigator.clipboard?.writeText(friendlyError.aiPrompt); setCopiedDiagnostic(true); setTimeout(() => setCopiedDiagnostic(false), 1800); } catch { /* clipboard permission is optional */ } }}>{copiedDiagnostic ? '已复制' : '复制给 AI'}</button></details></div></div>}
      <div className="summary-footer"><div className={`connection ${connection === 'live' ? 'connected' : ''}`}><span />{connection === 'live' ? '实时更新' : connection === 'polling' ? '正在定时刷新' : '正在连接进度'}</div><div className="button-row">
        {!run && <button className="button primary" onClick={onGenerate} disabled={actionBusy || active}><Icon name="play" />开始自动制作</button>}
        {run && isBusy(run.status) && <button className="button secondary" onClick={() => onCancel(run.id)} disabled={actionBusy || ['cancelling', 'cancel_requested'].includes(run.status)}><Icon name="pause" />{['cancelling', 'cancel_requested'].includes(run.status) ? '正在停止…' : '停止制作'}</button>}
        {run?.status === 'blocked' && <button className="button secondary" onClick={onEditSource} disabled={actionBusy || active}><Icon name="file" />补充材料</button>}
        {canResume && <button className="button primary" onClick={() => onResume(run.id)} disabled={actionBusy || active}><Icon name="refresh" />继续执行</button>}
      </div></div>
    </section>
    <section className="panel"><div className="panel-heading"><div><h2>制作任务</h2><p className="muted compact">设计、素材与检查各自记录结果。</p></div>{runs.length > 1 && <label className="run-selector"><span className="sr-only">查看制作记录</span><select value={selectedRunId || ''} onChange={event => onSelectRun(event.target.value)}>{runs.map((item, index) => <option key={item.id} value={item.id}>{index === 0 ? '最近一次' : dateTime(item.createdAt)} · {item.mode === 'change' ? '修改' : '制作'} · {humanStatus(item.status)}</option>)}</select></label>}</div>
      {tasks.length === 0 && <div className="subtle-empty">{run && isBusy(run.status) ? 'Codex 正在安排这部游戏的制作工作。' : '尚无任务记录。'}</div>}
      <ol className="task-list">{planned.map((task, index) => <li key={task.id} className={`task-row ${executing(task.status) ? 'current' : ''}`}><div className="task-number">{executing(task.status) ? <span className="spinner" /> : String(index + 1).padStart(2, '0')}</div><div className="task-content"><strong>{task.label}</strong><small>Codex 的工作安排，可在制作中调整</small>{task.error && <details className="diagnostic-details task-diagnostic"><summary>查看给 AI 的诊断</summary><pre>{friendlyRunError(task.error)?.aiPrompt || task.error}</pre></details>}</div>{passedStatuses.has(task.status) ? <span className="status-badge neutral">已记录完成</span> : <StatusBadge status={task.status} />}</li>)}</ol>
      {executed.length > 0 && <details className="tool-history"><summary>查看 {executed.length} 次工具执行记录</summary><p className="muted compact">工具执行结果单独记录；读取技能成功不代表游戏通过验收。</p><ol className="task-list">{executed.map(task => <li key={task.id} className={`task-row ${executing(task.status) ? 'current' : ''}`}><div className="task-content"><strong>{task.label || humanStage(task.stage)}</strong>{task.error && <details className="diagnostic-details task-diagnostic"><summary>查看给 AI 的诊断</summary><pre>{friendlyRunError(task.error)?.aiPrompt || task.error}</pre></details>}</div><StatusBadge status={task.status} /></li>)}</ol></details>}

    </section>
    <details className="panel execution-details"><summary>执行记录<span>展开查看日志与诊断</span></summary><div className="panel-heading"><div><h2>执行记录</h2><p className="muted compact">保留真实事件，最近的记录排在最上方。</p></div><button className="button ghost small" onClick={downloadLog} disabled={!detail}><Icon name="download" size={15} />导出日志</button></div>
      {events.length === 0 ? <div className="subtle-empty">后台事件将在这里显示。</div> : <div className="event-list">{visibleEvents.map(event => <article className={`event-row ${/error|fail/.test(event.type) ? 'error' : ''}`} key={event.id}><time dateTime={event.createdAt}>{dateTime(event.createdAt)}</time><div><p>{event.message || event.type}</p><JsonDetails title="查看事件详情" value={event.data} /></div></article>)}</div>}
      {events.length > visibleEvents.length || allEvents ? <button className="button ghost small show-more" onClick={() => setAllEvents(value => !value)}>{allEvents ? '收起较早记录' : `查看全部 ${events.length} 条记录`}</button> : null}
    </details>
  </div><aside className="side-column"><ChangeComposer disabled={active || !project.currentRevisionId} onSubmit={onChange} /><section className="panel brief-panel"><span className="eyebrow">项目输入</span><h2>故事与制作要求</h2><button className="button ghost small source-edit-button" onClick={onEditSource} disabled={active || actionBusy}><Icon name="edit" size={14} />补充或修订材料</button><dl><div><dt>来源方式</dt><dd>{project.inputKind === 'text' ? '导入文字材料' : '作品名检索'}</dd></div><div><dt>更新时间</dt><dd>{dateTime(project.updatedAt)}</dd></div></dl><div className="brief-copy"><h3>补充要求</h3><p>{project.requirements || '使用默认的 约 10 分钟、至少 5 个场景像素剧情探索规格。'}</p></div>{project.sourceText && <details className="source-material"><summary>查看输入材料 <span>{project.sourceText.length.toLocaleString('zh-CN')} 字符</span></summary><pre>{project.sourceText}</pre></details>}<div className="quiet-note"><Icon name="file" size={17} /><p>原作事实、推断和原创补充将在产物页分别记录。</p></div></section></aside></div>;
}
