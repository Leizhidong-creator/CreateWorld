import { Icon } from '../components/common.js';
import type { MarketplaceGame } from './marketplace.js';
import { navigate } from './navigation.js';

export function CrossoverDetail({ game }: { game: MarketplaceGame }) {
  const concept = game.concept!;
  function createFromConcept() {
    sessionStorage.setItem('cw.creation-idea', `${game.title}\n${game.subtitle}\n\n故事设定：${concept.story}\n\n玩法方向：\n${concept.play.map(item => `${item.title}：${item.description}`).join('\n')}`);
    navigate('/studio/new');
  }
  return <article className="crossover-detail site-container">
    <a className="market-back" href="#/games"><Icon name="chevron-left" size={15} />返回游戏货架</a>
    <section className="crossover-hero" aria-labelledby="crossover-title">
      <img className="crossover-hero-image" src={game.cover} alt={`${concept.pairing[0]}与${concept.pairing[1]}游戏封面`} />
      <div className="crossover-hero-shade" />
      <div className="crossover-hero-top"><span>共创作品 / 游戏世界</span><span>已上架</span></div>
      <div className="crossover-hero-copy"><p>{concept.kicker}</p><h1 id="crossover-title">{game.title}</h1><div>{game.subtitle}</div></div>
    </section>
    <div className="crossover-intro"><div className="crossover-pairing"><span>{concept.pairing[0]}</span><i>×</i><span>{concept.pairing[1]}</span></div><span className="crossover-genre">{concept.genre}</span></div>
    <div className="crossover-detail-layout"><div>
      <section className="crossover-section"><span className="site-eyebrow">THE STORY</span><h2>{concept.hook}</h2><p className="crossover-story">{concept.story}</p></section>
      <section className="crossover-section" aria-labelledby="collision-title"><span className="site-eyebrow">TWO WORLDS, ONE STORY</span><h2 id="collision-title">角色与阵营</h2><div className="crossover-worlds">{concept.pairing.map((name, index) => <div key={name}><span>0{index + 1}</span><h3>{name}</h3><p>{concept.worlds[index]}</p><div className="crossover-role">{concept.roles[index]}</div></div>)}</div></section>
      <section className="crossover-section" aria-labelledby="play-title"><span className="site-eyebrow">GAMEPLAY</span><h2 id="play-title">玩法介绍</h2><div className="crossover-play">{concept.play.map((item, index) => <div key={item.title}><span>0{index + 1}</span><div><h3>{item.title}</h3><p>{item.description}</p></div></div>)}</div></section>
      <section className="crossover-section crossover-remix"><span className="site-eyebrow">MORE TO EXPLORE</span><h2>更多游戏内容</h2><ul>{concept.twists.map(twist => <li key={twist}>{twist}</li>)}</ul><button className="site-button gold" onClick={createFromConcept}>以此为起点进行二创 <Icon name="arrow" size={17} /></button></section>
    </div><aside className="crossover-sidebar"><div className="market-aside-card"><span className="site-eyebrow">THE CROSSOVER FILE</span><h2>游戏信息</h2><dl><div><dt>组合</dt><dd>{concept.pairing.join(' × ')}</dd></div><div><dt>玩法</dt><dd>{concept.genre}</dd></div><div><dt>类型</dt><dd>{game.tags.join(' / ')}</dd></div><div><dt>状态</dt><dd>已上架 · 免费</dd></div></dl><button className="site-button gold" onClick={createFromConcept}>续写这个世界 <Icon name="arrow" size={16} /></button><p>保留这个世界的故事与玩法，创作属于你的衍生作品。</p></div><a className="crossover-back-shelf" href="#/games">看看其他世界的碰撞 <Icon name="arrow" size={15} /></a></aside></div>
  </article>;
}
