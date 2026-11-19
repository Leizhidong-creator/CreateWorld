import { useState } from 'react';
import { Icon } from '../components/common.js';
import { navigate } from './navigation.js';
import './pricing.css';

interface Plan {
  id: string;
  name: string;
  target: string;
  tagline: string;
  price: { monthly: string; yearly: string; unit: string; hint?: string };
  cta: string;
  note: string;
  featured?: boolean;
  groups: Array<{ title: string; items: string[] }>;
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: '体验版',
    target: '第一次做游戏',
    tagline: '先把一个想法跑成能玩的东西。',
    price: { monthly: '¥ 6', yearly: '¥ 6', unit: '每次', hint: '新用户先送 5 万 token' },
    cta: '免费试用',
    note: '用多少付多少，不订阅就不会自动扣费',
    groups: [
      { title: '额度', items: ['新用户赠送 5 万 token（约够 1 个短篇）', '超出后按次计费，短篇 ¥6 起', '改一句话按 token 计费，不改不收'] },
      { title: '能力', items: ['仅支持单场景、单主线的简单剧情', '基础剧情模板与像素素材', '可公开发布，平台按成交抽成'] },
    ],
  },
  {
    id: 'developer',
    name: '开发者',
    target: '专业 2D 开发与小型工作室',
    tagline: '把重复劳动交给工作流，把精力留给玩法。',
    price: { monthly: '¥ 69', yearly: '¥ 690', unit: '每月' },
    cta: '选择专业版',
    note: '按月订阅，随时取消',
    featured: true,
    groups: [
      { title: '额度', items: ['每月 60 次完整游戏生成', '更高并发与更长上下文'] },
      { title: '工作流', items: ['项目上下文、代码审阅与自动测试', '版本回滚与分支对比', '自定义工作流编排'] },
      { title: '生态与发布', items: ['Skill / 模板 / 素材包插件生态', '商业发布与二创授权配置', '作品数据看板'] },
    ],
  },
  {
    id: 'studio',
    name: 'IP 公司',
    target: '平台、IP 方与大型工作室',
    tagline: '把 IP 变成可持续运营的互动内容资产。',
    price: { monthly: '面议', yearly: '面议', unit: '年度合作' },
    cta: '联系我们',
    note: '按项目或年度合同结算',
    groups: [
      { title: '协作', items: ['多席位协作与权限分级', '定制工作流与私有部署'] },
      { title: 'IP 运营', items: ['IP 资产库与授权审核', '批量生成与官方番外', '试玩、收藏、付费数据看板'] },
      { title: '服务', items: ['专属客户成功与联合运营', '年度结算与收益分配'] },
    ],
  },
];

export function PricingPlans() {
  const [yearly, setYearly] = useState(false);
  const [notice, setNotice] = useState('');

  function choose(plan: Plan) {
    if (plan.id === 'starter') { navigate('/studio/new'); return; }
    if (plan.id === 'studio') { navigate('/contact'); return; }
    setNotice('演示版本：专业版订阅暂未开放，可以先用免费额度创作。');
    window.setTimeout(() => setNotice(''), 2600);
  }

  return <section className="pricing" aria-labelledby="pricing-title">
    <header className="pricing-head">
      <span className="site-eyebrow">PLANS</span>
      <h2 id="pricing-title">选择适合你的订阅</h2>
      <p>从一个念头开始，到一件可以上架、被人玩到的作品。</p>
      <div className="pricing-switch" role="group" aria-label="计费周期">
        <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>按月</button>
        <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>按年<i>省两个月</i></button>
      </div>
    </header>

    <div className="pricing-grid">
      {PLANS.map(plan => <article className={`plan${plan.featured ? ' is-featured' : ''}`} key={plan.id}>
        {plan.featured && <span className="plan-badge">推荐</span>}
        <header className="plan-head">
          <div>
            <h3>{plan.name}</h3>
            <small>{plan.target}</small>
          </div>
        </header>
        <p className="plan-tagline">{plan.tagline}</p>
        <div className={`plan-price${plan.price.monthly.length > 3 ? ' is-text' : ''}`}>
          <strong>{yearly ? plan.price.yearly : plan.price.monthly}</strong>
          {plan.price.unit && <span>{yearly && plan.price.unit === '每月' ? '每年' : plan.price.unit}</span>}{plan.price.hint && <em>{plan.price.hint}</em>}
        </div>
        <button type="button" className={`plan-cta${plan.featured ? ' is-primary' : ''}`} onClick={() => choose(plan)}>
          {plan.cta}
          <Icon name="arrow" size={15} />
        </button>
        <small className="plan-note">{plan.note}</small>

        <div className="plan-features">
          {plan.groups.map(group => <div className="plan-group" key={group.title}>
            <span className="plan-group-title">{group.title}</span>
            <ul>
              {group.items.map(item => <li key={item}><Icon name="check" size={13} />{item}</li>)}
            </ul>
          </div>)}
        </div>
      </article>)}
    </div>

    <p className={`pricing-notice${notice ? ' is-on' : ''}`} role="status">{notice}</p>
  </section>;
}
