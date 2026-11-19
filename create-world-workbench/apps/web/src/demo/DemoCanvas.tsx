import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/common.js';
import {
  DEMO_ASSETS, DEMO_DELIVER_AT, DEMO_PLUGINS, DEMO_PLUGIN_AT, DEMO_STAGE_AT,
  DEMO_STEPS, DEMO_TASKS, DEMO_TOTAL_MS, stageEnd, type DemoPlayback,
} from './three-body.js';

type NodeKind = 'requirement' | 'stage' | 'plugins' | 'deliver';

interface CanvasNode {
  id: string;
  kind: NodeKind;
  stage?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  at: number;
}

const NODES: CanvasNode[] = [
  { id: 'req', kind: 'requirement', x: 24, y: 210, w: 196, h: 150, at: 0 },
  { id: 's0', kind: 'stage', stage: 0, x: 252, y: 190, w: 214, h: 190, at: DEMO_STAGE_AT[0] },
  { id: 's1', kind: 'stage', stage: 1, x: 500, y: 190, w: 214, h: 190, at: DEMO_STAGE_AT[1] },
  { id: 'plugins', kind: 'plugins', x: 500, y: 420, w: 230, h: 170, at: DEMO_PLUGIN_AT },
  { id: 's2', kind: 'stage', stage: 2, x: 750, y: 140, w: 236, h: 310, at: DEMO_STAGE_AT[2] },
  { id: 's3', kind: 'stage', stage: 3, x: 1022, y: 190, w: 214, h: 190, at: DEMO_STAGE_AT[3] },
  { id: 's4', kind: 'stage', stage: 4, x: 1272, y: 190, w: 214, h: 190, at: DEMO_STAGE_AT[4] },
  { id: 'deliver', kind: 'deliver', x: 1520, y: 210, w: 170, h: 150, at: DEMO_DELIVER_AT },
];

const WORLD_W = 1720;
const WORLD_H = 620;
/** 画布纵向固定居中，只有横向跟随最新节点，避免上下跳动。 */
const CONTENT_CY = 365;

function clampView(view: { x: number; y: number; scale: number }, size: { w: number; h: number }) {
  const scaledW = WORLD_W * view.scale;
  const scaledH = WORLD_H * view.scale;
  const x = scaledW <= size.w ? (size.w - scaledW) / 2 : Math.min(0, Math.max(size.w - scaledW, view.x));
  const y = scaledH <= size.h ? (size.h - scaledH) / 2 : Math.min(0, Math.max(size.h - scaledH, view.y));
  return { ...view, x, y };
}

/** 内容包围盒：完成后的全览以它为准，比整块世界更紧凑。 */
const CONTENT = { x: 24, y: 140, w: 1666, h: 450 };

/** 完成后的全览比例：整条流程刚好放进画布。 */
function fitScale(size: { w: number; h: number }) {
  return Math.min(1, Math.max(0.5, Math.min(size.w / (CONTENT.w + 40), size.h / (CONTENT.h + 40))));
}

const EDGES: Array<{ from: string; to: string; vertical?: boolean }> = [
  { from: 'req', to: 's0' },
  { from: 's0', to: 's1' },
  { from: 's1', to: 's2' },
  { from: 's2', to: 's3' },
  { from: 's3', to: 's4' },
  { from: 's4', to: 'deliver' },
  { from: 's1', to: 'plugins', vertical: true },
];

const byId = (id: string) => NODES.find(node => node.id === id)!;

function edgePath(from: CanvasNode, to: CanvasNode, vertical?: boolean) {
  if (vertical) {
    const x1 = from.x + from.w / 2;
    const y1 = from.y + from.h;
    const x2 = to.x + to.w / 2;
    const y2 = to.y;
    return `M${x1} ${y1} C${x1} ${y1 + 40}, ${x2} ${y2 - 40}, ${x2} ${y2}`;
  }
  const x1 = from.x + from.w;
  const y1 = from.y + from.h / 2;
  const x2 = to.x;
  const y2 = to.y + to.h / 2;
  const bend = Math.max(40, (x2 - x1) / 2);
  return `M${x1} ${y1} C${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

function nodeState(node: CanvasNode, playback: DemoPlayback): 'queued' | 'active' | 'done' {
  const { elapsed } = playback;
  if (elapsed < node.at) return 'queued';
  if (node.kind === 'stage' && node.stage !== undefined) {
    return elapsed >= stageEnd(node.stage) ? 'done' : 'active';
  }
  return elapsed >= node.at + 700 || elapsed >= DEMO_TOTAL_MS ? 'done' : 'active';
}

export function DemoCanvas({ playback, onOpenArtifacts }: { playback: DemoPlayback; onOpenArtifacts: () => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 860, h: 460 });
  const [view, setView] = useState({ x: 0, y: 0, scale: 0.86 });
  const [dragging, setDragging] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const dragState = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const lastDragAt = useRef(0);
  const centred = useRef('');

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setSize({ w: element.clientWidth, h: element.clientHeight }));
    observer.observe(element);
    setSize({ w: element.clientWidth, h: element.clientHeight });
    return () => observer.disconnect();
  }, []);

  const visible = NODES.filter(node => playback.elapsed >= node.at);
  const focus = visible[visible.length - 1] || NODES[0];
  const focusKey = `${focus.id}-${size.w}`;

  useEffect(() => {
    if (!autoFollow || dragging) return;
    if (playback.done) {
      if (centred.current === 'fit') return;
      centred.current = 'fit';
      const scale = fitScale(size);
      setView(clampView({ scale, x: size.w / 2 - (CONTENT.x + CONTENT.w / 2) * scale, y: size.h / 2 - (CONTENT.y + CONTENT.h / 2) * scale }, size));
      return;
    }
    if (centred.current === focusKey) return;
    centred.current = focusKey;
    const scale = view.scale;
    setView(current => clampView({
      ...current,
      x: size.w / 2 - (focus.x + focus.w / 2) * scale,
      y: size.h / 2 - CONTENT_CY * scale,
    }, size));
  }, [focusKey, autoFollow, dragging, size, focus, view.scale, playback.done]);

  function onPointerDown(event: React.PointerEvent) {
    if ((event.target as HTMLElement).closest('button')) return;
    dragState.current = { px: event.clientX, py: event.clientY, ox: view.x, oy: view.y };
    setDragging(true);
    setAutoFollow(false);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    const start = dragState.current;
    if (!start) return;
    lastDragAt.current = Date.now();
    setView(current => clampView({ ...current, x: start.ox + (event.clientX - start.px), y: start.oy + (event.clientY - start.py) }, size));
  }

  function endDrag(event: React.PointerEvent) {
    if (!dragState.current) return;
    dragState.current = null;
    setDragging(false);
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    window.setTimeout(() => {
      if (Date.now() - lastDragAt.current > 2500) setAutoFollow(true);
    }, 2500);
  }

  function onWheel(event: React.WheelEvent) {
    event.preventDefault();
    setAutoFollow(false);
    setView(current => {
      const next = Math.min(1.25, Math.max(0.55, current.scale - event.deltaY * 0.0008));
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return { ...current, scale: next };
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;
      const ratio = next / current.scale;
      return clampView({ scale: next, x: cx - (cx - current.x) * ratio, y: cy - (cy - current.y) * ratio }, size);
    });
  }

  function resetView() {
    setAutoFollow(true);
    centred.current = '';
    const scale = 0.85;
    setView(clampView({ scale, x: size.w / 2 - (focus.x + focus.w / 2) * scale, y: size.h / 2 - CONTENT_CY * scale }, size));
  }

  const tasksPerStage = Math.ceil(DEMO_TASKS.length / DEMO_STEPS.length);

  return <section className="panel demo-canvas-panel">
    <div
      className={`demo-canvas${dragging ? ' is-dragging' : ''}`}
      ref={viewportRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={onWheel}
      role="img"
      aria-label={`制作流程画布：已生成 ${visible.length} 个节点`}
    >
      <div className="demo-canvas-overlay">
        <div className="demo-canvas-title">
          <span className="eyebrow">制作画布</span>
          <strong>{playback.done ? '世界已经成形' : '正在生成这个世界'}</strong>
          <span className="demo-canvas-progress">
            {playback.done ? '五个阶段全部通过' : `阶段 ${playback.stepIndex + 1} · ${DEMO_STEPS[playback.stepIndex].title}`}
            <em>{playback.finishedSteps} / {DEMO_STEPS.length}</em>
          </span>
        </div>
        <div className="demo-canvas-actions">
          {!autoFollow && <button type="button" className="button ghost small" onClick={resetView}><Icon name="refresh" size={14} />回到最新</button>}
          <button type="button" className="button secondary small" onClick={onOpenArtifacts}><Icon name="image" size={15} />查看素材与插件</button>
        </div>
      </div>
      <span className="demo-canvas-band" style={{ width: `${(playback.finishedSteps / DEMO_STEPS.length) * 100}%` }} aria-hidden="true" />
      <i className="demo-canvas-corner corner-tl" aria-hidden="true" />
      <i className="demo-canvas-corner corner-tr" aria-hidden="true" />
      <i className="demo-canvas-corner corner-bl" aria-hidden="true" />
      <i className="demo-canvas-corner corner-br" aria-hidden="true" />
      <div className="demo-canvas-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
        <svg className="demo-canvas-edges" width={WORLD_W} height={WORLD_H} aria-hidden="true">
          {EDGES.map(edge => {
            const from = byId(edge.from), to = byId(edge.to);
            if (playback.elapsed < to.at) return null;
            return <path key={`${edge.from}-${edge.to}`} d={edgePath(from, to, edge.vertical)} className="demo-edge" />;
          })}
        </svg>

        {NODES.map(node => {
          if (playback.elapsed < node.at) return null;
          const state = nodeState(node, playback);
          return <article
            key={node.id}
            className={`demo-node kind-${node.kind} state-${state}`}
            style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
          >
            {node.kind === 'requirement' && <>
              <span className="demo-node-tag">文字材料 · 228 字</span>
              <h3>《三体 Ⅱ · 黑暗森林》</h3>
              <p>以罗辑为第一视角，把关键抉择改编成可探索的像素游戏。</p>
            </>}

            {node.kind === 'stage' && node.stage !== undefined && <>
              <header className="demo-node-head">
                <span className="demo-node-index">{String(node.stage + 1).padStart(2, '0')}</span>
                <h3>{DEMO_STEPS[node.stage].title}</h3>
                <span className={`demo-node-state is-${state}`}>{state === 'done' ? '已通过' : state === 'active' ? '制作中' : '排队中'}</span>
              </header>
              <ul className="demo-node-tasks">
                {DEMO_TASKS.slice(node.stage * tasksPerStage, node.stage * tasksPerStage + 2).map(task => <li key={task}>{task}</li>)}
              </ul>
              {node.stage === 2 && <div className="demo-node-assets">
                {DEMO_ASSETS.map(asset => <figure key={asset.name} title={`${asset.name} · ${asset.kind}`}>
                  <img src={asset.src} alt={asset.name} loading="lazy" />
                </figure>)}
              </div>}
            </>}

            {node.kind === 'plugins' && <>
              <span className="demo-node-tag">已使用的插件 · {DEMO_PLUGINS.length}</span>
              <div className="demo-node-plugins">
                {DEMO_PLUGINS.map(plugin => <span key={plugin.slug} title={plugin.use}>{plugin.name}</span>)}
              </div>
            </>}

            {node.kind === 'deliver' && <>
              <span className="demo-node-tag">交付</span>
              <h3>可试玩版本</h3>
              <p>3 个场景 · 3 位角色 · 5 个阶段通过</p>
              <span className="demo-node-ready"><Icon name="check" size={13} />{playback.done ? '已就绪' : '收尾中'}</span>
            </>}
          </article>;
        })}
      </div>
      <span className="demo-canvas-hint">拖动平移 · 滚轮缩放</span>
    </div>
  </section>;
}
