import { useRef, useState, type FormEvent } from 'react';
import type { Project } from '../types.js';
import { errorMessage } from '../api.js';
import { Icon, Modal } from './common.js';

export function SourceDialog({ project, canResume, onSave, onClose }: {
  project: Project; canResume: boolean;
  onSave: (value: { sourceText: string; requirements: string }, resume: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [sourceText, setSourceText] = useState(project.sourceText || '');
  const [requirements, setRequirements] = useState(project.requirements || '');
  const [resume, setResume] = useState(canResume);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  async function readFile(file?: File) {
    if (!file) return;
    setError('');
    if (!/\.(txt|md|srt)$/i.test(file.name) || file.size > 10 * 1024 * 1024) { setError('请选择不超过 10 MB 的 UTF-8 文本、Markdown 或 SRT 文件。'); return; }
    try {
      const text = await file.text();
      if (!text.trim() || text.includes('\u0000')) throw new Error('文件没有可读取的 UTF-8 文字内容。');
      const updated = sourceText.trim() ? `${sourceText}\n\n--- 补充材料：${file.name} ---\n\n${text}` : text;
      if (updated.length > 2_000_000) throw new Error('合并后的材料超过 200 万字符，请缩小到本次改编范围。');
      setSourceText(updated);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSave({ sourceText, requirements }, canResume && resume); onClose(); }
    catch (cause) { setError(errorMessage(cause)); setBusy(false); }
  }
  return <Modal title="补充故事材料" onClose={() => { if (!busy) onClose(); }} wide><p className="modal-intro">补充准确的版本、原结局或缺失段落。已有通过版本会保留，受影响的来源和下游任务会重新检查。</p><form onSubmit={submit}>
    <div className="source-edit-heading"><span>{project.title}</span><button className="button secondary small" type="button" disabled={busy} onClick={() => fileInput.current?.click()}><Icon name="upload" size={15} />追加文件内容</button><input className="sr-only" tabIndex={-1} ref={fileInput} type="file" accept=".txt,.md,.srt" aria-label="追加故事材料文件" onChange={event => void readFile(event.target.files?.[0])} /></div>
    <label className="field"><span>故事材料<span className="field-meta">{sourceText.length.toLocaleString('zh-CN')} 字符</span></span><textarea data-autofocus value={sourceText} onChange={event => setSourceText(event.target.value)} rows={10} maxLength={2_000_000} disabled={busy} placeholder="补充原作版本、剧情、结局或可定位来源。请保留已有材料中仍然有效的部分。" /></label>
    <label className="field"><span>补充要求</span><textarea value={requirements} onChange={event => setRequirements(event.target.value)} rows={3} maxLength={20_000} disabled={busy} /></label>
    {canResume && <label className="checkbox-label"><input type="checkbox" checked={resume} onChange={event => setResume(event.target.checked)} disabled={busy} /><span>保存后继续之前的制作任务</span></label>}
    {error && <p className="inline-error" role="alert"><Icon name="warning" />{error}</p>}
    <div className="modal-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>取消</button><button className="button primary" disabled={busy}>{busy ? <span className="spinner" /> : <Icon name="check" />}{canResume && resume ? '保存并继续制作' : '保存材料'}</button></div>
  </form></Modal>;
}
