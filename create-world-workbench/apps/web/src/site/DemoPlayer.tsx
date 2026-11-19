import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/common.js';
import type { World } from './worlds.js';

export default function DemoPlayer({ world }: { world: World }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const game = useRef<{ destroy: () => void; pause: () => void } | undefined>(undefined);
  const playButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === frame.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);

  useEffect(() => {
    if (!playing || !root.current) return;
    let disposed = false;
    const host = root.current;
    if (world.id === 'walls') {
      const iframe = document.createElement('iframe');
      iframe.title = '高墙之外原版游戏';
      iframe.className = 'walls-game-frame';
      iframe.allow = 'autoplay; fullscreen';
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-downloads');
      setLoading(true); setError('');
      iframe.onload = () => { if (!disposed) { setLoading(false); iframe.focus(); } };
      iframe.src = '/local-games/walls/index.html';
      host.replaceChildren(iframe);
      return () => { disposed = true; iframe.remove(); host.replaceChildren(); };
    }
    let instance: { start: () => Promise<unknown>; destroy: () => void; pause: () => void } | undefined;
    setLoading(true); setError('');
    (world.id === 'dust' ? import('../demo/mount-dust.js') : import('../demo/mount-game.js')).then(async ({ mountDemo }) => {
      if (disposed) return;
      const mounted = mountDemo(host, world.id);
      instance = mounted;
      game.current = mounted;
      await mounted.start();
      if (!disposed) setLoading(false);
    }).catch(cause => {
      if (!disposed) { setError(cause instanceof Error ? cause.message : '暂时无法载入游戏。'); setLoading(false); }
    });
    return () => { disposed = true; instance?.destroy(); game.current = undefined; host.replaceChildren(); };
  }, [playing, world.id]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (frame.current?.requestFullscreen) await frame.current.requestFullscreen();
      else setError('此浏览器不支持全屏，可横屏体验游戏。');
    } catch { setError('无法进入全屏，请使用浏览器窗口或横屏游玩。'); }
  }

  function stop() {
    setPlaying(false); setError('');
    requestAnimationFrame(() => playButton.current?.focus());
  }

  return <div className="demo-player" ref={frame}>
    <div className="demo-viewport">
      {!playing ? <div key="cover" className={`demo-cover demo-cover-${world.id}`} style={{ backgroundImage: `url(${world.cover})` }}>
        <div className="demo-cover-content"><span className="site-eyebrow">{world.english}</span><h2>{world.title}</h2><p>{world.tagline}</p>
          {world.playable ? <button ref={playButton} className="site-button gold" onClick={() => setPlaying(true)}><Icon name="play" size={18} />开始试玩</button> : <a className="site-button gold" href="#/studio/new">以自己的故事开始</a>}
          <span className="demo-cover-note">{world.id === 'walls' ? '原版游戏 · 本地运行 · 自动保存进度' : world.playable ? world.local ? '我的游戏 · 两个场景的完整探索' : '概念封面 · 点击进入现有探索原型' : world.showcase ? '原作展示 · 试玩接入准备中' : '概念世界 · 可玩版本尚未制作'}</span>
        </div>
      </div> : <><div key="runtime" className="demo-runtime" ref={root} aria-label={`${world.title}游戏区域`} />{loading && <div className="demo-loading" role="status"><span className="site-spinner" />正在打开这个世界…</div>}</>}
    </div>
    {error && <p className="site-error" role="alert">{error}</p>}
    <div className="demo-toolbar">{world.playable ? <span><kbd>W A S D</kbd> 移动 <span className="key-divider">/</span> <kbd>{world.id === 'walls' ? '空格' : 'E'}</kbd> 互动<span className="touch-hint">· 手机使用画面内摇杆</span></span> : <span>{world.showcase ? '原作标题画面' : '世界概念美术'}</span>}<div>{world.id === 'walls' && <a className="text-link" href="/downloads/beyond-the-walls-source.zip" download="高墙之外_源码版.zip"><Icon name="download" size={15} />下载源码 ZIP</a>}{playing && <>{world.id !== 'walls' && <button onClick={() => game.current?.pause()}><Icon name="pause" size={15} />暂停</button>}<button onClick={stop}>退出试玩</button></>}<button onClick={() => void toggleFullscreen()} aria-label={fullscreen ? '退出全屏' : world.playable ? '全屏试玩' : '全屏查看'}><Icon name="monitor" size={16} />{fullscreen ? '退出全屏' : '全屏'}</button></div></div>
  </div>;
}
