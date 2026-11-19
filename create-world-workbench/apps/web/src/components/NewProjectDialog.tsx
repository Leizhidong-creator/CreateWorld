import { useEffect, useState, type FormEvent } from 'react';
import type { NewProject } from '../types.js';
import { errorMessage } from '../api.js';
import { Icon, Modal } from './common.js';
import { THREE_BODY_IDEA, THREE_BODY_TITLE } from '../site/demo-idea.js';

export function NewProjectDialog({ onClose, onCreate, backendReady, sourceGameId }: { onClose: () => void; onCreate: (value: NewProject) => Promise<void>; backendReady: boolean; sourceGameId?: string }) {
  const [ideaDraft] = useState(() => sourceGameId ? '' : sessionStorage.getItem('cw.creation-idea') || THREE_BODY_IDEA);
  useEffect(() => { if (!sourceGameId) sessionStorage.removeItem('cw.creation-idea'); }, [sourceGameId]);
  const [kind, setKind] = useState<'title' | 'text'>(ideaDraft ? 'text' : 'title');
  const [title, setTitle] = useState(sourceGameId ? '二创作品' : ideaDraft ? THREE_BODY_TITLE : '');
  const [sourceText, setSourceText] = useState(ideaDraft);
  const [requirements, setRequirements] = useState(sourceGameId ? `基于作品 ${sourceGameId} 进行二次创作，保留原作来源归属。` : '');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  async function readFile(file?: File) {
    if (!file) return;
    if (!/\.(txt|md|srt)$/i.test(file.name)) { setError('请导入 UTF-8 编码的 TXT、Markdown 或 SRT 文件。'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('文件超过 10 MB，请拆分为较小的文字材料后导入。'); return; }
    setReading(true); setError('');
    try {
      const text = await file.text();
      if (!text.trim()) throw new Error('这个文件没有文字内容，请换一份材料。');
      if (text.length > 2_000_000) throw new Error('材料超过 200 万字符，请缩小到本次改编的范围。');
      if (text.includes('\u0000')) throw new Error('这份材料不像 UTF-8 文本，请将文件另存为 UTF-8 后重试。');
      setSourceText(text); setFileName(file.name); setKind('text');
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''));
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setReading(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || (kind === 'text' && !sourceText.trim())) return;
    setBusy(true); setError('');
    try {
      await onCreate({ title: title.trim(), inputKind: kind, sourceText: kind === 'text' ? sourceText : '', requirements: requirements.trim(), ...(fileName && kind === 'text' ? { fileName } : {}) });
      onClose();
    } catch (cause) { setError(errorMessage(cause)); setBusy(false); }
  }

  return <Modal title="从一个故事开始" badge="当前仅开放体验版" onClose={() => { if (!busy) onClose(); }} wide>
    <p className="modal-intro">输入作品名或导入材料，工作台会整理来源、制作游戏，并检查实际运行结果。</p>
    {sourceGameId && <p className="inline-info"><Icon name="spark" />正在基于商城作品 <strong>{sourceGameId}</strong> 创建二创副本，发布时会保留来源归属。</p>}
    <form onSubmit={submit}>
      <fieldset className="input-kind"><legend className="sr-only">故事来源</legend>
        <label className={kind === 'title' ? 'selected' : ''}><input type="radio" name="input-kind" value="title" checked={kind === 'title'} onChange={() => setKind('title')} disabled={busy} /><Icon name="spark" /><span><strong>从作品名开始</strong><small>检索来源，核对故事与版本</small></span></label>
        <label className={kind === 'text' ? 'selected' : ''}><input type="radio" name="input-kind" value="text" checked={kind === 'text'} onChange={() => setKind('text')} disabled={busy} /><Icon name="file" /><span><strong>使用我的文字材料</strong><small>小说、剧本、梗概或字幕</small></span></label>
      </fieldset>
      <label className="field"><span>{kind === 'title' ? '作品名与版本' : '项目名称'} <span className="required">*</span></span><input data-autofocus value={title} onChange={event => setTitle(event.target.value)} placeholder={kind === 'title' ? '例如：作品名称、作者或电影年份' : '为这个游戏取个名字'} required maxLength={160} disabled={busy} /><small>{kind === 'title' ? '同名作品请补充作者、年份或版本，让来源更准确。' : '用于项目列表和游戏制作记录，之后可通过修改指令调整游戏标题。'}</small></label>
      {kind === 'text' && <>
        <label className="field"><span>故事材料 <span className="required">*</span><span className="field-meta">{sourceText.length.toLocaleString('zh-CN')} 字符</span></span><textarea className={dragging ? 'story-input dragging' : 'story-input'} onDragOver={event => { event.preventDefault(); if (!busy && !reading) { event.dataTransfer.dropEffect = 'copy'; setDragging(true); } }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!busy && !reading) void readFile(event.dataTransfer.files[0]); }} value={sourceText} onChange={event => setSourceText(event.target.value)} placeholder="输入、粘贴故事材料，或将 TXT / MD / SRT 文件直接拖入此框。" required maxLength={2_000_000} rows={7} disabled={busy || reading} /></label>
      </>}
      <label className="field"><span>补充要求 <span className="optional">可选</span></span><textarea className="project-requirements" value={requirements} onChange={event => setRequirements(event.target.value)} placeholder="例如：侧重探索与人物关系，保留原作结局，适合手机横屏游玩。" rows={2} maxLength={20_000} disabled={busy} /></label>
      <div className="form-note"><Icon name="layers" /><p>默认制作 约 10 分钟、至少 5 个场景的像素剧情探索游戏。保留人物核心动机、关键因果与原结局；补写内容单独标为原创。</p></div>
      {error && <p className="inline-error" role="alert"><Icon name="warning" />{error}</p>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>取消</button><button type="submit" className="button primary" disabled={busy || reading || !title.trim() || (kind === 'text' && !sourceText.trim())}>{busy ? <><span className="spinner" />正在创建…</> : <>创建并自动制作<Icon name="arrow" /></>}</button></div>
    </form>
  </Modal>;
}
