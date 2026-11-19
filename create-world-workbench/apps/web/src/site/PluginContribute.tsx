import { useEffect, useRef, useState, type FormEvent } from 'react';
import { plugins, pluginCategories } from './plugins.js';
import { readContributions, saveContribution, type Contribution } from './plugin-contributions.js';
import './PluginMarket.css';
import './PluginContribute.css';

function emptyContribution(): Contribution {
  return { id: crypto.randomUUID(), mode: 'new', sourceId: '', sourceName: '', name: '', kind: 'Skill 技能', author: '', version: '1.0.0', description: '', tags: '', integration: '', changes: '', license: '', status: 'draft', revision: 0, updatedAt: '' };
}
function initialContribution(sourceId?: string): Contribution {
  const source = plugins.find(plugin => plugin.id === sourceId);
  return source ? { ...emptyContribution(), mode: 'remix', sourceId: source.id, sourceName: source.name, name: `${source.name} · 共创版`, kind: source.kind, description: source.description, tags: source.tags.join('、'), integration: source.integration } : emptyContribution();
}
function UploadIcon() {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 21V5m-6 6 6-6 6 6M6 21v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function PluginContribute({ sourceId }: { sourceId?: string }) {
  const [form, setForm] = useState(() => initialContribution(sourceId));
  const [entries, setEntries] = useState<Contribution[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { document.title = 'Create World · 共创插件'; readContributions().then(setEntries).catch(() => setError('无法读取本地投稿，请检查浏览器存储设置。')); }, []);
  function field<K extends keyof Contribution>(key: K, value: Contribution[K]) {
    setForm(current => ({ ...current, [key]: value })); setMessage('');
  }
  function chooseFile(file?: File) {
    if (!file) return;
    setError(''); setMessage('');
    if (!/\.(zip|md|json|ya?ml)$/i.test(file.name)) { setError('请选择 ZIP、Markdown、JSON 或 YAML 文件。'); return; }
    if (!file.size || file.size > 20 * 1024 * 1024) { setError('请选择非空文件，单个文件不超过 20 MB。'); return; }
    field('attachment', file);
  }
  function selectSource(id: string) {
    const next = initialContribution(id);
    setForm({ ...next, mode: 'remix', author: form.author }); setMessage(''); setError('');
  }
  async function persist(submitted: boolean) {
    setError(''); setMessage('');
    if (submitted && (!form.name.trim() || !form.author.trim() || !form.version.trim() || !form.description.trim() || !form.integration.trim() || !form.license.trim())) {
      setError('请填写插件名称、作者、版本、介绍、使用说明与许可信息。'); return;
    }
    if (submitted && form.mode === 'remix' && (!form.sourceId || !form.changes.trim())) { setError('请选择原插件，并说明这次修改了什么。'); return; }
    if (submitted && !form.attachment) { setError('请添加你自己的插件文件，或修改后的插件包。'); return; }
    setBusy(true);
    try {
      const value: Contribution = { ...form, sourceId: form.mode === 'remix' ? form.sourceId : '', sourceName: form.mode === 'remix' ? form.sourceName : '', name: form.name.trim(), status: submitted ? 'submitted' : 'draft', revision: form.revision + (submitted ? 1 : 0), updatedAt: new Date().toISOString() };
      await saveContribution(value);
      setForm(value);
      setEntries(current => [value, ...current.filter(item => item.id !== value.id)]);
      setMessage(submitted ? '本地投稿已提交，文件与资料已保存。尚未发布到公共插件市场。' : '草稿与附件已保存，可从下方“我的本地投稿”继续编辑。');
    } catch { setError('保存失败，可能是浏览器存储不可用或空间不足。请保留原文件后重试。'); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void persist(true); }
  function downloadFile(entry: Contribution) {
    if (!entry.attachment) return;
    const url = URL.createObjectURL(entry.attachment);
    const link = document.createElement('a'); link.href = url; link.download = entry.attachment.name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="plugin-market plugin-create site-container">
    <a className="plugin-back" href="#/plugins">← 插件市场</a>
    <header className="contribute-heading"><div><span className="plugin-kicker">CREATE SOMETHING OTHERS CAN BUILD ON</span><h1>把你的好方法，变成大家的好工具。</h1><p>分享一个新插件，或接着已有的灵感，做出你的版本。</p></div><span className="contribute-heading-mark" aria-hidden="true">✧</span></header>
    <div className="contribute-mode" aria-label="共创方式">
      <button type="button" aria-pressed={form.mode === 'new'} disabled={busy} onClick={() => { field('mode', 'new'); }}><span className="mode-icon"><UploadIcon /></span><span><strong>上传自己的插件</strong><small>让你的 Skill、工具与流程被更多人使用</small></span><i /></button>
      <button type="button" aria-pressed={form.mode === 'remix'} disabled={busy} onClick={() => field('mode', 'remix')}><span className="mode-icon"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M9 9v14m14-14v4c0 7-14 0-14 10" stroke="currentColor" strokeWidth="1.6"/><circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.6"/><circle cx="23" cy="6" r="3" stroke="currentColor" strokeWidth="1.6"/><circle cx="9" cy="26" r="3" stroke="currentColor" strokeWidth="1.6"/></svg></span><span><strong>基于现有插件共创</strong><small>保留来源，改进能力，提交一个新版本</small></span><i /></button>
    </div>
    <div className="contribute-layout"><form onSubmit={submit} className="contribute-form">
      <fieldset disabled={busy}>
      {form.mode === 'remix' && <section className="contribute-section"><div className="contribute-section-title"><b>01</b><h2>选择你的起点</h2></div><label>原插件<select aria-label="原插件" value={form.sourceId} onChange={event => selectSource(event.target.value)} required><option value="">选择一个现有插件</option>{plugins.map(plugin => <option key={plugin.id} value={plugin.id}>{plugin.name}</option>)}</select></label><p className="contribute-help">选择后会带入插件介绍与接入说明，你可以在下方编辑。请上传自行修改后的文件；这里不会自动获取或修改原插件源码。</p></section>}
      <section className="contribute-section"><div className="contribute-section-title"><b>{form.mode === 'new' ? '01' : '02'}</b><h2>介绍你的插件</h2><span>让别人知道它能做什么</span></div><div className="contribute-fields"><label className="wide">插件名称<input required maxLength={80} value={form.name} onChange={event => field('name', event.target.value)} placeholder="给你的插件起一个清晰的名字" /></label><label>插件类型<select aria-label="插件类型" value={form.kind} onChange={event => field('kind', event.target.value)}>{pluginCategories.map(kind => <option key={kind}>{kind}</option>)}</select></label><label>版本号<input required maxLength={30} value={form.version} onChange={event => field('version', event.target.value)} placeholder="1.0.0" /></label><label>作者 / 团队<input required maxLength={80} value={form.author} onChange={event => field('author', event.target.value)} placeholder="你希望展示的创作者名称" /></label><label>许可信息<input required maxLength={100} value={form.license} onChange={event => field('license', event.target.value)} placeholder="例如 MIT，或注明使用条件" /></label><label className="wide">插件介绍<textarea required rows={3} maxLength={2000} value={form.description} onChange={event => field('description', event.target.value)} placeholder="它解决什么问题？适合什么样的创作？" /></label><label className="wide">能力标签<input maxLength={150} value={form.tags} onChange={event => field('tags', event.target.value)} placeholder="例如：场景制作、像素风、碰撞数据" /></label></div></section>
      <section className="contribute-section"><div className="contribute-section-title"><b>{form.mode === 'new' ? '02' : '03'}</b><h2>{form.mode === 'new' ? '添加插件内容' : '提交你的改进'}</h2></div><div className={`contribute-drop ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!busy) { if (event.dataTransfer.files.length > 1) setError('每次投稿只接收一个文件，多文件请先打包为 ZIP。'); else chooseFile(event.dataTransfer.files[0]); } }}><UploadIcon /><strong>{form.attachment ? form.attachment.name : '将插件文件拖到这里'}</strong><span>{form.attachment ? `${(form.attachment.size / 1024).toFixed(1)} KB · 文件已选择` : 'ZIP、Markdown、JSON、YAML · 最大 20 MB'}</span><button className="site-button outline" type="button" onClick={() => input.current?.click()}>{form.attachment ? '更换文件' : '选择文件'}</button>{form.attachment && <button className="plugin-quiet-button" type="button" onClick={() => field('attachment', undefined)}>移除文件</button>}<input ref={input} type="file" accept=".zip,.md,.json,.yaml,.yml" aria-label="插件文件" hidden onChange={event => { chooseFile(event.target.files?.[0]); event.target.value = ''; }} /></div><label>使用与接入说明<textarea required rows={5} maxLength={12000} value={form.integration} onChange={event => field('integration', event.target.value)} placeholder="说明依赖、安装步骤、输入输出与一个使用示例。" /></label>{form.mode === 'remix' && <label>本次修改说明<textarea required rows={3} maxLength={4000} value={form.changes} onChange={event => field('changes', event.target.value)} placeholder="与原插件相比，你改进了哪些地方？" /></label>}</section>
      <div className="contribute-submit"><p>投稿仅保存在此浏览器，公共发布尚未开放。</p><div><button className="site-button outline" type="button" onClick={() => void persist(false)}>保存草稿</button><button className="site-button gold" type="submit">{busy ? '正在保存…' : form.revision ? '再次提交到本地' : '提交到本地'}</button></div></div>
      </fieldset>{error && <div className="contribute-message error" role="alert">{error}</div>}{message && <div className="contribute-message" role="status">{message}</div>}
    </form><aside className="contribute-sidebar"><span className="plugin-kicker">YOUR NEXT CONTRIBUTION</span><h2>一个插件，<br />一种新的可能。</h2><p>小而好用的方法，也值得被分享。</p><div className="contribute-preview"><span className="plugin-kind">{form.kind}</span><h3>{form.name || '你的插件名称'}</h3><p>{form.description || '在左侧填写介绍，这里会展示你的插件概览。'}</p><small>{form.author || '创作者'} · {form.version || '版本待填写'}</small>{form.mode === 'remix' && form.sourceName && <span className="contribute-source">基于「{form.sourceName}」共创</span>}</div><h3>一份好投稿，可以包含</h3><ul><li>清晰的用途与实际使用示例</li><li>完整文件与依赖说明</li><li>来源、许可与适用条件</li><li>改进的内容和验证结果</li></ul><p className="contribute-local-note">当前为本地共创工作区。文件与资料保存在此浏览器，不会自动上传到服务器或替换原插件。</p></aside></div>
    <section className="contribute-history"><div className="contribute-history-heading"><div><span className="plugin-kicker">YOUR CONTRIBUTIONS</span><h2>我的本地投稿 <small>{entries.length}</small></h2></div><button className="plugin-quiet-button" disabled={busy} onClick={() => { setForm(emptyContribution()); setError(''); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>新建投稿</button></div>{entries.length ? <div className="contribute-history-list">{entries.map(entry => <article key={entry.id}><div><strong>{entry.name || '未命名插件'}</strong><p>{entry.kind} · {entry.version} {entry.mode === 'remix' ? `· 基于 ${entry.sourceName || '待选择插件'}` : ''}</p></div><span>{entry.status === 'submitted' ? `本地已提交 · 第 ${entry.revision} 次` : '草稿'}</span>{entry.attachment && <button type="button" className="plugin-quiet-button" onClick={() => downloadFile(entry)}>下载附件</button>}<button disabled={busy} type="button" className="plugin-quiet-button" onClick={() => { setForm(entry); setMessage(''); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>继续编辑</button></article>)}</div> : <p className="contribute-empty">还没有投稿。把第一个好想法留在这里。</p>}</section>
  </div>;
}
