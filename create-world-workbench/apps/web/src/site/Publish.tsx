import { useState } from 'react';
import { Icon } from '../components/common.js';
import { marketplace, type PricingType } from './marketplace.js';

const steps = ['基础信息', '素材上传', '定价与权益', '预览并发布'];

export function Publish() {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('剧情冒险, 探索');
  const [cover, setCover] = useState('/worlds/coast.webp');
  const [pricing, setPricing] = useState<PricingType>('free');
  const [amount, setAmount] = useState('12');
  const [playable, setPlayable] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canContinue = step === 0 ? Boolean(title.trim() && description.trim()) : step === 1 ? Boolean(cover) : step === 2 ? pricing === 'free' || Number(amount) > 0 : true;
  function next() { if (!canContinue) { setError(step === 0 ? '请先填写作品名称和简介' : step === 2 ? '请填写有效的购买价格' : '请补充必填信息'); return; } setError(''); setStep(value => Math.min(3, value + 1)); }
  function back() { setError(''); setStep(value => Math.max(0, value - 1)); }
  async function submit() { try { const created = await marketplace.publishDraft({ title, description, tags: tags.split(',').map(item => item.trim()).filter(Boolean), cover, pricing: pricing === 'free' ? { type: 'free', currency: 'CNY' } : { type: 'paid', amount: Number(amount), currency: 'CNY' }, playable }); setSuccess(`「${created.title}」已保存为发布草稿`); } catch (cause) { setError(cause instanceof Error ? cause.message : '发布失败，请稍后重试'); } }
  return <div className="publish-page site-container"><a className="market-back" href="#/games"><Icon name="chevron-left" size={15} />返回游戏世界</a><div className="publish-heading"><div><span className="site-eyebrow">CREATOR DESK</span><h1>把你的世界放上货架。</h1><p>让更多人走进去，也让它继续生长。</p></div><span className="publish-heading-mark">{String(step + 1).padStart(2, '0')} <small>/ 04</small></span></div><div className="publish-stepper" aria-label="发布步骤">{steps.map((item, index) => <div className={`publish-step ${index === step ? 'is-current' : ''} ${index < step ? 'is-done' : ''}`} key={item}><span>{index < step ? <Icon name="check" size={14} /> : `0${index + 1}`}</span><strong>{item}</strong></div>)}</div><div className="publish-layout"><section className="publish-form-card">{step === 0 && <BasicStep title={title} setTitle={setTitle} description={description} setDescription={setDescription} tags={tags} setTags={setTags} />}{step === 1 && <AssetStep cover={cover} setCover={setCover} playable={playable} setPlayable={setPlayable} />}{step === 2 && <PricingStep pricing={pricing} setPricing={setPricing} amount={amount} setAmount={setAmount} />}{step === 3 && <PreviewStep title={title} description={description} tags={tags} cover={cover} pricing={pricing} amount={amount} playable={playable} />}{error && <p className="publish-error" role="alert"><Icon name="warning" size={15} />{error}</p>}{success && <div className="publish-success" role="status"><Icon name="check" size={18} /><div><strong>{success}</strong><p>你可以继续管理作品，或返回商城查看。</p></div><a className="text-link" href="#/games">返回商城</a></div>}<div className="publish-actions">{step > 0 && <button className="site-button outline" type="button" onClick={back}>上一步</button>}{step < 3 ? <button className="site-button gold" type="button" onClick={next}>继续 <Icon name="arrow" size={15} /></button> : <button className="site-button gold" type="button" onClick={submit} disabled={Boolean(success)}>提交发布草稿 <Icon name="arrow" size={15} /></button>}</div></section><aside className="publish-side"><span className="site-eyebrow">LIVE PREVIEW</span><h2>你的作品会这样出现。</h2><p>先把故事讲清楚，再让玩家决定要不要走进去。</p><PreviewCard title={title || '还没有名字的世界'} description={description || '一句话告诉玩家，这个世界值得被打开的原因。'} tags={tags} cover={cover} pricing={pricing} amount={amount} playable={playable} /></aside></div></div>;
}

function BasicStep({ title, setTitle, description, setDescription, tags, setTags }: { title: string; setTitle: (value: string) => void; description: string; setDescription: (value: string) => void; tags: string; setTags: (value: string) => void }) {
  return <div className="publish-step-content"><span className="site-eyebrow">01 / THE STORY</span><h2>先让人知道，这是一个怎样的世界。</h2><p className="publish-help">用一两句话说清楚作品的气质，玩家会在这里决定是否继续读下去。</p><label>作品名称<input value={title} onChange={event => setTitle(event.target.value)} placeholder="例如：雾港来信" maxLength={40} /></label><label>作品简介<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="一座灯塔，一封没有寄出的信……" rows={5} maxLength={180} /><small>{description.length} / 180</small></label><label>题材标签<input value={tags} onChange={event => setTags(event.target.value)} placeholder="用逗号分隔，例如：探索, 叙事" /></label></div>;
}

function AssetStep({ cover, setCover, playable, setPlayable }: { cover: string; setCover: (value: string) => void; playable: boolean; setPlayable: (value: boolean) => void }) {
  const covers = ['/worlds/coast.webp', '/worlds/mountain.webp', '/worlds/train.webp', '/worlds/walls.webp'];
  return <div className="publish-step-content"><span className="site-eyebrow">02 / THE MATERIALS</span><h2>给这个世界一张让人想走近的封面。</h2><p className="publish-help">第一版使用现有样本图预览，后续可直接替换为真实上传组件。</p><div className="publish-cover-picker">{covers.map(item => <button className={cover === item ? 'is-selected' : ''} key={item} type="button" onClick={() => setCover(item)}><img src={item} alt="" /></button>)}</div><label className="publish-toggle"><input type="checkbox" checked={playable} onChange={event => setPlayable(event.target.checked)} /><span><strong>发布后提供在线试玩</strong><small>如果作品还在制作中，可以先发布为预览。</small></span></label></div>;
}

function PricingStep({ pricing, setPricing, amount, setAmount }: { pricing: PricingType; setPricing: (value: PricingType) => void; amount: string; setAmount: (value: string) => void }) {
  return <div className="publish-step-content"><span className="site-eyebrow">03 / THE EXCHANGE</span><h2>决定玩家如何支持这个世界。</h2><p className="publish-help">你可以免费开放作品，也可以设置一次性购买价格。</p><div className="publish-pricing-options"><button type="button" className={pricing === 'free' ? 'is-selected' : ''} onClick={() => setPricing('free')}><span className="publish-price-mark">0</span><span><strong>免费开放</strong><small>任何人都可以开始游戏</small></span><Icon name="check" size={16} /></button><button type="button" className={pricing === 'paid' ? 'is-selected' : ''} onClick={() => setPricing('paid')}><span className="publish-price-mark">¥</span><span><strong>一次性购买</strong><small>支付一次，即可畅玩</small></span><Icon name="check" size={16} /></button></div>{pricing === 'paid' && <div className="publish-price-fields"><label>购买价格<input type="number" min="1" value={amount} onChange={event => setAmount(event.target.value)} /></label></div>}</div>;
}

function PreviewStep(props: { title: string; description: string; tags: string; cover: string; pricing: PricingType; amount: string; playable: boolean }) {
  return <div className="publish-step-content"><span className="site-eyebrow">04 / THE SHELF</span><h2>最后看一眼，它会如何被遇见。</h2><p className="publish-help">提交后会保存为发布草稿，接入审核服务后即可正式上架。</p><PreviewCard {...props} large /><div className="publish-checklist"><span><Icon name="check" size={14} />基础信息完整</span><span><Icon name="check" size={14} />封面与试玩已设置</span><span><Icon name="check" size={14} />价格与权益已确认</span></div></div>;
}

function PreviewCard({ title, description, tags, cover, pricing, amount, playable, large = false }: { title: string; description: string; tags: string; cover: string; pricing: PricingType; amount: string; playable: boolean; large?: boolean }) {
  return <div className={`publish-preview-card ${large ? 'is-large' : ''}`}><div className="publish-preview-art"><img src={cover} alt="" /><span>{playable ? '可试玩' : '作品展示'}</span></div><div className="publish-preview-copy"><div><h3>{title}</h3><p>{description}</p></div><strong>{pricing === 'free' ? '免费' : `¥ ${amount}`}</strong><small>{tags.split(',').map(item => item.trim()).filter(Boolean).join(' · ') || '未添加标签'}</small></div></div>;
}
