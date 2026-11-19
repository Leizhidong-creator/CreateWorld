import { useState } from 'react';
import { Icon } from '../components/common.js';
import { DEMO_ASSETS, DEMO_PLUGINS } from './three-body.js';

type Category = 'assets' | 'plugins' | 'data';

export function DemoArtifacts() {
  const [category, setCategory] = useState<Category>('assets');
  return <div>
    <div className="artifact-tabs" role="group" aria-label="产物类别">
      <button className={category === 'assets' ? 'selected' : ''} onClick={() => setCategory('assets')}><Icon name="image" />素材资源 <span>{DEMO_ASSETS.length}</span></button>
      <button className={category === 'plugins' ? 'selected' : ''} onClick={() => setCategory('plugins')}><Icon name="layers" />已使用的插件 <span>{DEMO_PLUGINS.length}</span></button>
      <button className={category === 'data' ? 'selected' : ''} onClick={() => setCategory('data')}><Icon name="grid" />项目数据 <span>2</span></button>
    </div>

    {category === 'assets' && <section className="panel">
      <div className="panel-heading">
        <div><h2>随版本保存的素材</h2><p className="muted compact">三体像素素材包 v1，缩略图为实际文件，点击可查看原图。</p></div>
        <span className="count-pill">{DEMO_ASSETS.length} 个文件</span>
      </div>
      <div className="asset-grid">
        {DEMO_ASSETS.map(asset => <article className="asset-card" key={asset.name}>
          <div className="asset-image checkerboard">
            <a href={asset.src} target="_blank" rel="noreferrer"><img src={asset.src} alt={asset.name} loading="lazy" /></a>
          </div>
          <div className="asset-copy">
            <h3 title={asset.name}>{asset.name}</h3>
            <span className="provenance-tag">{asset.kind}</span>
            <p className="asset-path" title={asset.src}>{asset.src.replace('/demo-assets/three-body/', '')}</p>
            <small>{asset.meta}</small>
          </div>
        </article>)}
      </div>
    </section>}

    {category === 'plugins' && <section className="panel">
      <div className="panel-heading">
        <div><h2>已使用的插件</h2><p className="muted compact">本次制作实际调用的技能与运行时，按使用顺序排列。</p></div>
        <span className="count-pill">{DEMO_PLUGINS.length} 个</span>
      </div>
      <div className="plugin-grid">
        {DEMO_PLUGINS.map((plugin, index) => <article className="plugin-card" key={plugin.slug}>
          <div className="plugin-head">
            <span className="plugin-index">{String(index + 1).padStart(2, '0')}</span>
            <div><h3>{plugin.name}</h3><code>{plugin.slug}</code></div>
            <span className="status-badge success">{plugin.status}</span>
          </div>
          <p>{plugin.use}</p>
        </article>)}
      </div>
    </section>}

    {category === 'data' && <section className="panel">
      <h2>规范数据与构建清单</h2>
      <p className="muted">演示版本使用固定的项目数据；完整 JSON 在正式制作时随版本保存。</p>
      <dl className="demo-data-list">
        <div><dt>项目</dt><dd>三体 · 候选版本</dd></div>
        <div><dt>输入方式</dt><dd>文字材料（228 字符）</dd></div>
        <div><dt>场景数</dt><dd>3</dd></div>
        <div><dt>角色数</dt><dd>3</dd></div>
        <div><dt>使用插件</dt><dd>{DEMO_PLUGINS.length}</dd></div>
        <div><dt>素材文件</dt><dd>{DEMO_ASSETS.length}</dd></div>
      </dl>
    </section>}
  </div>;
}
