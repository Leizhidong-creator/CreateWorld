import { Icon } from '../components/common.js';
import { DemoCanvas } from './DemoCanvas.js';
import {
  DEMO_CREW, DEMO_CREW_DONE, DEMO_CREW_LINES, DEMO_TOOL_COUNT, DEMO_TOOL_SKILLS,
  type DemoPlayback,
} from './three-body.js';

export function DemoProduction({ playback, onOpenArtifacts }: { playback: DemoPlayback; onOpenArtifacts: () => void }) {
  const { done, toolCount } = playback;
  const lines = done ? DEMO_CREW_DONE : DEMO_CREW_LINES[playback.stepIndex];

  return <div className="demo-stack">
    <div className="demo-stage">
      <div className="demo-friends" aria-label="四位创作成员正在制作">
        {DEMO_CREW.map((member, index) => (
          <figure className={`demo-friend friend-${index}`} key={member.id}>
            <span className="demo-friend-bubble"><i className="demo-friend-dot" />{member.name} · {lines[index]}</span>
            <img src={`/crew/${member.id}/work.apng`} alt={`${member.name}：${member.role}`} draggable={false} />
          </figure>
        ))}
      </div>
      <DemoCanvas playback={playback} onOpenArtifacts={onOpenArtifacts} />
    </div>

    <div className="production-grid">
      <div className="main-column">
        <details className="panel tool-history">
          <summary>查看 {toolCount} 次工具执行记录</summary>
          <p className="muted compact">工具执行结果单独记录；读取技能成功不代表游戏通过验收。</p>
          <ol className="task-list">
            {Array.from({ length: toolCount }, (_, index) => <li className="task-row" key={index}>
              <div className="task-content"><strong>读取指定技能 · {DEMO_TOOL_SKILLS[index % DEMO_TOOL_SKILLS.length]}</strong></div>
              <span className="status-badge success">已通过</span>
            </li>)}
          </ol>
          <p className="muted compact">共记录 {DEMO_TOOL_COUNT} 次工具调用。</p>
        </details>
      </div>

      <aside className="side-column">
        <section className="panel brief-panel">
          <span className="eyebrow">项目输入</span>
          <h2>故事与制作要求</h2>
          <dl>
            <div><dt>来源方式</dt><dd>导入文字材料</dd></div>
            <div><dt>改编来源</dt><dd>《三体 Ⅱ · 黑暗森林》</dd></div>
          </dl>
          <div className="brief-copy">
            <h3>补充要求</h3>
            <p>2D 像素风格，罗辑第一视角，约 10 分钟、至少 5 个场景的剧情探索。</p>
          </div>
          <div className="quiet-note"><Icon name="file" size={17} /><p>原作事实、推断与原创补充会在产物页分别记录。</p></div>
        </section>
        <section className="panel">
          <span className="eyebrow">版本</span>
          <h2>候选版本</h2>
          <p className="muted compact">三体 · 候选版本</p>
          <p className="muted compact">11/01 · 制作完成</p>
          <button className="button ghost small" onClick={onOpenArtifacts}><Icon name="image" size={15} />查看随版本保存的素材</button>
        </section>
      </aside>
    </div>
  </div>;
}
