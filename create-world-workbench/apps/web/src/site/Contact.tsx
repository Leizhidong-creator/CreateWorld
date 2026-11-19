import { useState } from 'react';
import { Icon } from '../components/common.js';
import './contact.css';

const PHONES = ['18535451273', '15734935596'];

export function Contact() {
  const [copied, setCopied] = useState('');

  async function copyPhone(phone: string) {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(phone);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setCopied('');
    }
  }

  return <section className="contact-page site-container">
    <header className="contact-head">
      <span className="site-eyebrow">CONTACT</span>
      <h1>联系我们</h1>
      <p>扫码加入共创群，或者直接打电话给我们。</p>
    </header>

    <figure className="contact-qr">
      <img src="/contact/wechat-group.png" alt="Create World AI 游戏共创 Club 微信群二维码" width={896} height={896} />
      <figcaption>Create World · AI 游戏共创 Club</figcaption>
      <small>微信扫码进群 · 二维码 7 天内有效</small>
    </figure>

    <div className="contact-phone">
      <span className="contact-phone-label">电话 / 微信同号</span>
      <ul className="contact-phone-list">
        {PHONES.map(phone => <li className="contact-phone-row" key={phone}>
          <a className="contact-phone-number" href={`tel:${phone}`}>{phone}</a>
          <button type="button" className="contact-copy" onClick={() => copyPhone(phone)}>
            <Icon name={copied === phone ? 'check' : 'link'} size={14} />
            {copied === phone ? '已复制' : '复制号码'}
          </button>
        </li>)}
      </ul>
    </div>

    <p className="contact-note">
      IP 授权、定制开发与联合运营都可以直接聊；工作日 10:00 – 19:00 回复更快。
    </p>

    <a className="site-button outline contact-back" href="#/">回到首页</a>
  </section>;
}
