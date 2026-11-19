import { useState } from 'react';
import type { Revision, RevisionDetail } from '../types.js';
import { apiUrl, localUrl, previewUrl } from '../api.js';
import { dateTime, findCollections, humanStatus, itemLabel, passedStatuses, record, textValue } from '../utils.js';
import { EmptyState, Icon, JsonDetails, Loading, StatusBadge } from './common.js';

export function RevisionSelect({ revisions, selectedId, onSelect }: { revisions: Revision[]; selectedId?: string; onSelect: (id: string) => void }) {
  return <label className="revision-select"><span>查看版本</span><select value={selectedId || ''} onChange={event => onSelect(event.target.value)} disabled={!revisions.length}>{!revisions.length && <option value="">暂无版本</option>}{revisions.map((revision, index) => <option value={revision.id} key={revision.id}>{revision.title || `版本 ${revisions.length - index}`} · {humanStatus(revision.status)} · {dateTime(revision.createdAt)}</option>)}</select></label>;
}

export function Preview({ detail, loading, currentRevisionId }: { detail?: RevisionDetail; loading: boolean; currentRevisionId?: string | null }) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [reloadKey, setReloadKey] = useState(0);
  if (loading && !detail) return <Loading label="正在读取版本…" />;
  if (!detail) return <section className="panel"><EmptyState icon="play" title="第一个世界，还在制作中"><p>可运行候选生成后，就能在这里试玩。制作过程和检查结果会保留在制作页。</p></EmptyState></section>;
  const revision = detail.revision;
  const url = previewUrl(detail.previewUrl || revision.previewUrl);
  const exportable = Boolean(url && passedStatuses.has(revision.status));
  return <div className="preview-page"><section className="panel preview-panel"><div className="panel-heading"><div><h2>{revision.title || '游戏试玩'}</h2><p className="muted compact">{revision.id === currentRevisionId ? '当前使用的版本' : '你正在查看历史或候选版本'} · {dateTime(revision.createdAt)}</p></div><StatusBadge status={revision.status} /></div>
    {revision.buildMode === 'graybox' && <div className="failure-note"><Icon name="warning" /><p>这是玩法验证版本，使用临时美术。正式素材与整部游戏验收尚未完成。</p></div>}
    <div className="preview-toolbar"><div className="segmented" role="group" aria-label="预览尺寸"><button aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Icon name="monitor" size={16} />桌面</button><button aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Icon name="phone" size={16} />手机横屏</button></div><div className="button-row"><button className="button ghost small" disabled={!url} onClick={() => setReloadKey(value => value + 1)}><Icon name="refresh" size={16} />重新加载</button>{url && <a className="button secondary small" href={url} target="_blank" rel="noreferrer"><Icon name="link" size={15} />独立窗口</a>}</div></div>
    <div className={`preview-stage ${device}`}>{url ? <iframe key={`${revision.id}-${reloadKey}`} src={url} title={`${revision.title || '游戏'} · ${device === 'mobile' ? '手机横屏' : '桌面'}试玩`} sandbox="allow-scripts allow-same-origin allow-pointer-lock" allow="autoplay; fullscreen" allowFullScreen /> : <EmptyState icon="monitor" title="这个版本暂时不能试玩"><p>需要生成可运行构建，并通过独立的本地预览服务加载。请查看制作记录中的具体状态。</p></EmptyState>}</div>
    <div className="preview-foot"><p><Icon name="play" size={15} />点击游戏画面后使用方向键或 WASD。界面尺寸预览不代表真机触屏验收。</p>{exportable && <a className="button primary small" download="三体-封面概念图.png" href={apiUrl(`/api/revisions/${encodeURIComponent(revision.id)}/export`)}><Icon name="download" size={16} />下载游戏 ZIP</a>}</div>
  </section><details className="preview-evidence"><summary><Icon name="check" size={17} />验证记录与运行截图<span>按需查看</span></summary><Evidence evidence={detail.evidence} revisionId={revision.id} /></details><RevisionScope detail={detail} /><JsonDetails title="查看本版本的修改记录" value={detail.changes} /></div>;
}

function RevisionScope({ detail }: { detail: RevisionDetail }) {
  const bundle = record(detail.bundle);
  const scope = record(bundle.scope);
  if (!Object.keys(scope).length && !bundle.slice) return null;
  const label = scope.mode === 'scene-slice' ? '单场景' : scope.mode === 'full-game' ? '完整游戏' : '范围详情';
  return <section className="panel"><h2>本版本制作范围</h2><p>{label}{typeof scope.sceneId === 'string' ? ` · ${scope.sceneId}` : ''}</p><JsonDetails title="查看制作范围记录" value={bundle.scope} /><JsonDetails title="查看场景内容记录" value={bundle.slice} /></section>;
}

function assetUrl(row: Record<string, unknown>, revisionId: string) {
  if (row.url) return localUrl(typeof row.url === 'string' && row.url.startsWith('/api/') ? apiUrl(row.url) : row.url);
  const path = textValue(row.path || row.file);
  if (!path || path.startsWith('/') || path.includes('..') || /^(?:https?:|file:)/.test(path)) return undefined;
  return apiUrl(`/api/revisions/${encodeURIComponent(revisionId)}/files/${path.split('/').map(encodeURIComponent).join('/')}`);
}

function Evidence({ evidence, revisionId }: { evidence: unknown; revisionId: string }) {
  const root = record(evidence);
  const checks = record(root.checks);
  const screens = findCollections(evidence, ['screenshots'], 4);
  const errors = [...findCollections(evidence, ['pageErrors', 'consoleErrors', 'errors'], 2)].filter(Boolean);
  return <section className="panel"><div className="panel-heading"><div><h2>这个版本的验证记录</h2><p className="muted compact">按后台实际结果展示；没有记录的项目不会标为通过。</p></div>{Boolean(root.status) && <StatusBadge status={textValue(root.status)} />}</div>
    {!Object.keys(root).length ? <div className="subtle-empty">尚未收到验证证据。</div> : <>
      {Object.keys(checks).length > 0 && <div className="check-grid">{Object.entries(checks).map(([key, value]) => {
        const item = record(value);
        const status = value === true ? 'passed' : value === false ? 'failed' : textValue(item.status) || 'pending';
        const labels: Record<string, string> = { keyboard: '键盘操作', touch: '触屏模拟', saveRestore: '存档恢复', restart: '重新开始', pause: '暂停与恢复', invalidSave: '损坏存档', mobileLayout: '移动端布局', guardRejected: '条件拒绝', assetsDecoded: '素材解码', collision: '碰撞', keyboardMovement: '角色移动', noBrowserErrors: '浏览器错误检查', sourceFidelity: '原作约束', allEndings: '结局通路' };
        return <div className="check-item" key={key}><span>{textValue(item.label) || labels[key] || key}</span><StatusBadge status={status} /></div>;
      })}</div>}
      {errors.length > 0 && <div className="failure-note"><Icon name="warning" /><div><strong>检查记录中的问题</strong>{errors.map((item, i) => <p key={i}>{typeof item === 'string' ? item : JSON.stringify(item)}</p>)}</div></div>}
      {screens.length > 0 && <div className="screenshot-grid">{screens.map((screen, index) => {
        const row = typeof screen === 'string' ? { path: screen } : record(screen), url = assetUrl(row, revisionId);
        const label = textValue(row.label || row.name) || `运行截图 ${index + 1}`;
        return <figure key={`${label}-${index}`}>{url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={label} loading="lazy" /></a> : <div className="missing-image"><Icon name="image" /><span>截图记录无可访问地址</span></div>}<figcaption>{label}</figcaption></figure>;
      })}</div>}
      <JsonDetails title="查看完整验证数据" value={evidence} />
    </>}
  </section>;
}

function provenanceLabel(value: unknown) {
  const row = record(value);
  const text = textValue(value) || textValue(row.type || row.kind || row.origin);
  return ({ original: '原创补充', generated: '生成素材', source: '来自原作', user: '用户材料', imported: '导入素材', adapted: '整理改编', extracted: '提取复用', reused: '已有素材' } as Record<string, string>)[text] || text || '尚未标注';
}

export function Artifacts({ detail, loading }: { detail?: RevisionDetail; loading: boolean }) {
  const [category, setCategory] = useState<'assets' | 'source' | 'data'>('assets');
  if (loading && !detail) return <Loading label="正在读取产物…" />;
  if (!detail) return <section className="panel"><EmptyState icon="layers" title="制作产物会保存在这里"><p>角色、场景、来源和原创补充随版本一起记录，便于查看和复用。</p></EmptyState></section>;
  const root = record(detail.bundle);
  const assets = findCollections(detail.manifest, ['assets'], 3);
  const fallbackAssets = assets.length ? assets : findCollections(detail.bundle, ['assets'], 2);
  const source = record(root.source);
  const sources = [...findCollections(detail.bundle, ['sources', 'sourceRecords'], 2), ...(Array.isArray(source.records) ? source.records : []), ...(Array.isArray(source.nodes) ? source.nodes : [])];
  const additions = findCollections(detail.bundle, ['originalAdditions', 'inventions'], 3);
  const canon = root.canonLocks || source.canonLocks || record(root.project).canonLocks || record(root.sourceSet).canonLocks;
  const coverage = root.sourceCoverage || source.sourceCoverage || source.coverage || record(root.sourceSet).coverage;
  return <div><div className="artifact-tabs" role="group" aria-label="产物类别"><button className={category === 'assets' ? 'selected' : ''} onClick={() => setCategory('assets')}><Icon name="image" />素材资源 <span>{fallbackAssets.length}</span></button><button className={category === 'source' ? 'selected' : ''} onClick={() => setCategory('source')}><Icon name="file" />故事来源</button><button className={category === 'data' ? 'selected' : ''} onClick={() => setCategory('data')}><Icon name="layers" />项目数据</button></div>
    {category === 'assets' && <section className="panel"><div className="panel-heading"><div><h2>随版本保存的素材</h2><p className="muted compact">文件来源、生成记录与规格均以实际清单为准。</p></div></div>{!fallbackAssets.length ? <EmptyState icon="image" title="暂时没有素材清单"><p>素材生成并登记后会显示在这里。</p></EmptyState> : <div className="asset-grid">{fallbackAssets.map((asset, index) => {
      const row = typeof asset === 'string' ? { path: asset } : record(asset);
      const label = itemLabel(row, `素材 ${index + 1}`), path = textValue(row.path || row.file), url = assetUrl(row, detail.revision.id);
      const mime = textValue(row.mimeType), image = mime.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(path);
      const sound = mime.startsWith('audio/') || /\.(wav|mp3|ogg)$/i.test(path);
      return <article className="asset-card" key={textValue(row.id) || `${path}-${index}`}><div className={`asset-image ${image ? 'checkerboard' : ''}`}>{url && image ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={label} loading="lazy" /></a> : <Icon name={sound ? 'play' : 'file'} size={36} />}</div><div className="asset-copy"><h3 title={label}>{label}</h3><span className="provenance-tag">{provenanceLabel(row.provenance || row.origin)}</span><p className="asset-path" title={path}>{path || '没有文件路径'}</p>{sound && url && <audio src={url} controls preload="none" aria-label={label} />}{Boolean(row.width && row.height) && <small>{String(row.width)} × {String(row.height)}</small>}<JsonDetails title="文件详情与来源" value={row} /></div></article>;
    })}</div>}</section>}
    {category === 'source' && <div className="source-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">可追溯的故事</span><h2>原作材料与事实</h2></div><Icon name="file" /></div><p className="muted">核实来源与原创补充分别记录；有材料缺口时不会自动视为原作完整。</p><JsonDetails title="材料覆盖情况" value={coverage} /><JsonDetails title="保留的动机、因果与结局" value={canon} />{sources.length ? <div className="source-list">{sources.map((item, index) => {
      const row = record(item);
      return <article key={textValue(row.id) || index}><span className="source-index">{String(index + 1).padStart(2, '0')}</span><div><h3>{itemLabel(item, `来源 ${index + 1}`)}</h3>{Boolean(row.locator) && <p className="muted">{textValue(row.locator)}</p>}{Boolean(row.invariant) && <p>{textValue(row.invariant)}</p>}<JsonDetails title="来源定位与详情" value={row} /></div></article>;
    })}</div> : <div className="subtle-empty">尚未登记可展示的来源条目；完整数据可在“项目数据”中查看。</div>}</section><section className="panel"><span className="eyebrow">明确标记的新增内容</span><h2>原创补充</h2><p className="muted">用于连接互动和过渡，不作为已核实的原作事实。</p>{additions.length ? <div className="addition-list">{additions.map((item, index) => <article key={index}><span className="provenance-tag original">原创</span><h3>{itemLabel(item, `新增内容 ${index + 1}`)}</h3><JsonDetails title="补充理由与相关节点" value={item} /></article>)}</div> : <div className="subtle-empty">当前数据未登记原创补充。</div>}</section></div>}
    {category === 'data' && <section className="panel"><h2>规范数据与构建清单</h2><p className="muted">适合核对版本、配置和来源。这里展示的内容来自当前选中的版本。</p><JsonDetails title="游戏内容与配置" value={detail.bundle} /><JsonDetails title="构建与素材清单" value={detail.manifest} /><JsonDetails title="本版本变更" value={detail.changes} /><JsonDetails title="验证记录" value={detail.evidence} /></section>}
  </div>;
}

export function Versions({ revisions, currentRevisionId, busy, onView, onRollback }: { revisions: Revision[]; currentRevisionId?: string | null; busy: boolean; onView: (id: string) => void; onRollback: (revision: Revision) => void }) {
  return <section className="panel"><div className="panel-heading"><div><h2>每一步创作，都有回来的路</h2><p className="muted compact">新修改生成独立候选，已接受版本保持完整。回退不会删除后续记录。</p></div><span className="count-pill">{revisions.length} 个版本</span></div>{!revisions.length ? <EmptyState icon="history" title="还没有版本记录"><p>第一次候选构建完成后会自动出现在这里。</p></EmptyState> : <ol className="version-list">{revisions.map((revision, index) => {
    const current = revision.id === currentRevisionId;
    const usable = passedStatuses.has(revision.status);
    return <li className={current ? 'current' : ''} key={revision.id}><div className="version-mark">{String(revisions.length - index).padStart(2, '0')}</div><div className="version-info"><div className="version-title"><h3>{revision.title || `版本 ${revisions.length - index}`}</h3>{current && <span className="current-tag">当前版本</span>}<StatusBadge status={revision.status} /></div><p>{revision.summary || '这个版本尚未提供变更摘要。'}</p><div className="version-meta"><time dateTime={revision.createdAt}>{dateTime(revision.createdAt)}</time>{revision.buildHash && <code title={revision.buildHash}>{revision.buildHash.slice(0, 12)}</code>}<span title={revision.id}>ID {revision.id.slice(0, 8)}</span></div></div><div className="version-actions"><button className="button secondary small" onClick={() => onView(revision.id)}><Icon name="play" size={15} />查看</button>{!current && usable && <button className="button ghost small" onClick={() => onRollback(revision)} disabled={busy}><Icon name="history" size={15} />回退到此版本</button>}{usable && <a className="icon-button" download="三体-封面概念图.png" href={apiUrl(`/api/revisions/${encodeURIComponent(revision.id)}/export`)} aria-label={`下载${revision.title || '此版本'} ZIP`}><Icon name="download" /></a>}</div></li>;
  })}</ol>}</section>;
}
