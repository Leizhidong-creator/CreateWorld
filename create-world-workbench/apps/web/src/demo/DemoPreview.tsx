/** 演示态：工作台「试玩」标签直接跑接入好的游戏。 */
export function DemoPreview() {
  return <section className="panel demo-preview">
    <div className="panel-heading">
      <div>
        <span className="eyebrow">试玩</span>
        <h2>三体 Ⅱ · 黑暗森林</h2>
        <p className="muted compact">WASD / 方向键移动，E 交互，Esc 暂停。也可以在新窗口里全屏玩。</p>
      </div>
      <a className="button secondary small" href="/export-assets/three-body/play.html" target="_blank" rel="noreferrer">新窗口打开</a>
    </div>
    <div className="demo-preview-frame">
      <iframe title="三体 Ⅱ · 黑暗森林 试玩" src="/export-assets/three-body/play.html" allow="autoplay; fullscreen" />
    </div>
  </section>;
}
