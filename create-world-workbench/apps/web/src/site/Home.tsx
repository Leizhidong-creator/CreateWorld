import { useRef } from 'react';
import { Icon } from '../components/common.js';
import { WorldCards } from './chrome.js';

export function Home() {
  const worldsSection = useRef<HTMLElement>(null);
  function exploreBelow() {
    worldsSection.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    });
    worldsSection.current?.focus({ preventScroll: true });
  }
  return <>
    <section className="home-hero" aria-labelledby="home-title">
      <img className="hero-landscape" src="/worlds/coast.webp" alt="" fetchPriority="high" width="1920" height="1080" />
      <div className="hero-shade" />
      <div className="home-hero-content site-container">
        <span className="site-eyebrow"><span /> FROM WORDS TO WORLDS</span>
        <h1 id="home-title">你写下故事，<br />世界由此<span className="hero-title-accent">展开。</span></h1>
        <p>把喜欢的故事，做成想玩的游戏。<br />从一段文字开始，边玩边打磨。</p>
        <div className="site-actions"><a className="site-button gold" href="#/studio/new">开始创作</a><a className="site-button outline" href="#/?section=worlds"><Icon name="play" size={17} />先玩一个世界</a></div>
      </div>
      <button className="hero-scroll" type="button" onClick={exploreBelow} aria-label="下滑探索故事案例">
        <span className="hero-scroll-track" aria-hidden="true"><i /></span>
        <span className="hero-scroll-copy"><span>下滑探索</span><small>SCROLL TO EXPLORE</small></span>
      </button>
      <span className="hero-brand-motto">FROM WORDS TO WORLDS</span>
    </section>
    <section className="featured-worlds site-container" ref={worldsSection} tabIndex={-1} aria-labelledby="worlds-title">
      <div className="section-title"><div><span className="site-eyebrow">WORLDS WAITING FOR YOU</span><h2 id="worlds-title">故事可以变成什么？</h2></div><a className="text-link" href="#/?section=worlds">发现游戏世界</a></div>
      <WorldCards />
    </section>
    <section className="home-how"><div className="site-container"><div className="section-title"><div><span className="site-eyebrow">FROM WORDS TO WORLDS</span><h2>一个故事，<br />无数个可以走进去的瞬间。</h2></div><a className="text-link" href="#/?section=worlds">看看故事如何变成游戏</a></div>
      <div className="how-steps"><article><span className="step-index">01 /</span><Icon name="file" size={27} /><h3>写下你的故事</h3><p>一个作品名，一段文字，<br />或一份你珍藏已久的剧本。</p></article><article><span className="step-index">02 /</span><Icon name="layers" size={27} /><h3>让世界逐渐成形</h3><p>让人物拥有去处，<br />让情节成为可以亲历的行动。</p></article><article><span className="step-index">03 /</span><Icon name="play" size={27} /><h3>走进去，再改一点</h3><p>亲自试玩，用一句话提出修改。<br />每个版本，都有回来的路。</p></article></div>
    </div></section>
    <section className="home-invitation site-container"><span className="site-eyebrow">YOUR NEXT ADVENTURE</span><h2>下一个世界，<br />从你的故事开始。</h2><a className="site-button gold" href="#/studio/new">开始创造</a></section>
    <section className="home-market-cta site-container" aria-labelledby="home-market-title"><div><span className="site-eyebrow">THE COMMUNITY SHELF</span><h2 id="home-market-title">发现玩家创造的更多世界。</h2><p>探索、游玩，也把它变成你的版本。</p></div><a className="site-button outline" href="#/games">进入游戏商城 <Icon name="arrow" size={16} /></a></section>
  </>;
}
