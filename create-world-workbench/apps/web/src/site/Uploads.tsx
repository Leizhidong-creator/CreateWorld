import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/common.js';
import { saveUploadedGame, uploadedGames, type UploadedGame } from './upload-store.js';

export function UploadButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <><button className="site-button gold" onClick={() => { setError(''); dialog.current?.showModal(); }}><Icon name="plus" size={16} />上传游戏</button>
    <dialog className="upload-dialog" ref={dialog} aria-labelledby="upload-heading" onCancel={event => { if (busy) event.preventDefault(); }}>
      <form onSubmit={async event => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const file = data.get('game');
        if (!(file instanceof File) || !file.size) { setError('请选择游戏文件。'); return; }
        setBusy(true); setError('');
        try { await saveUploadedGame(String(data.get('title') || ''), String(data.get('description') || ''), file); form.reset(); dialog.current?.close(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : '上传失败，请重试。'); }
        finally { setBusy(false); }
      }}>
        <div className="upload-heading"><h2 id="upload-heading">上传你的游戏</h2><span className="upload-badge">超前体验版</span></div><p>作品将同步出现在「我的项目」和「游戏世界」。</p>
        <label>游戏名称<input name="title" required maxLength={60} placeholder="给这个世界起个名字" /></label>
        <label>游戏简介<textarea name="description" maxLength={300} rows={3} placeholder="介绍故事、玩法和操作方式" /></label>
        <label className="upload-file">游戏文件<input name="game" type="file" accept=".html,.htm,.zip" required /><span>HTML / ZIP · 最大 100 MB</span></label>
        <p className="upload-help">HTML 需包含游戏所需资源，可在页面内试玩。ZIP 保存为游戏包，暂不支持在线运行。当前文件仅存于此浏览器，尚未公开分享。</p>
        {error && <p role="alert">{error}</p>}
        <div className="site-actions"><button type="button" className="site-button outline" disabled={busy} onClick={() => dialog.current?.close()}>取消</button><button type="submit" className="site-button gold" disabled={busy}>{busy ? '正在保存…' : '保存游戏'}</button></div>
      </form>
    </dialog></>;
}
export function useUploadedGames() {
  const [games, setGames] = useState<UploadedGame[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    const load = () => uploadedGames().then(data => { if (mounted) { setGames(data); setError(''); } }).catch(() => { if (mounted) setError('暂时无法读取上传的作品，请检查浏览器存储权限。'); });
    void load(); window.addEventListener('cw-uploads-changed', load);
    return () => { mounted = false; window.removeEventListener('cw-uploads-changed', load); };
  }, []);
  return { games, error };
}

export function UploadedGames({ query = '' }: { query?: string }) {
  const { games, error } = useUploadedGames();
  const filtered = games.filter(game => `${game.title} ${game.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section className="library-section uploaded-section" aria-label="我的游戏">
    <div className="section-title"><h2>我的游戏 <small>{games.length}</small></h2><span className="library-section-note">保存在当前浏览器</span></div>
    {error && <p role="alert">{error}</p>}
    <div className="world-cards"><UploadedGameCards games={filtered} /></div>
    {!error && !filtered.length && <p className="library-message">{query ? '没有匹配的游戏。' : '还没有游戏，点击「上传游戏」添加你的第一个游戏。'}</p>}
  </section>;
}

export function UploadedGameCards({ games }: { games: UploadedGame[] }) {
  const [active, setActive] = useState<UploadedGame>();
  const [url, setUrl] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!active) { setUrl(''); return; }
    const objectUrl = URL.createObjectURL(new Blob([active.file], { type: active.playable ? 'text/html' : 'application/zip' }));
    setUrl(objectUrl); dialog.current?.showModal();
    return () => URL.revokeObjectURL(objectUrl);
  }, [active]);
  return <>{games.map(game => <button className="world-card uploaded-card" key={game.id} onClick={() => setActive(game)}>
      <div className="world-cover local-game-art"><span className="world-card-status">{game.playable ? 'HTML 游戏' : 'ZIP 游戏包'}</span><span className="local-game-horizon"><Icon name="layers" size={32} /></span></div>
      <div className="world-card-copy"><div><h3>{game.title}</h3><p>{game.description || game.filename}</p></div><span>{game.playable ? '试玩' : '查看'}</span></div>
    </button>)}
    <dialog className="uploaded-player-dialog" ref={dialog} onClose={() => setActive(undefined)} aria-label="上传游戏预览">
      {active && <><div className="uploaded-player-heading"><h2>{active.title}</h2><button className="site-button outline" onClick={() => dialog.current?.close()}>关闭</button></div>
        {active.playable && url ? <iframe src={url} title={active.title} sandbox="allow-scripts allow-pointer-lock" allow="fullscreen" allowFullScreen /> : <p>这是 ZIP 游戏包，下载解压后可在本机运行。</p>}
        <p>{active.description}</p><a className="text-link" href={url || undefined} download={active.filename}>下载原文件</a></>}
    </dialog>
  </>;
}
