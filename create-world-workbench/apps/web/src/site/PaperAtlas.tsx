import { useEffect, useRef, useState } from 'react';
import './PaperAtlas.css';

/** Separate, opt-in art direction study. The original WorldAtlas stays intact. */
export function PaperAtlas() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.atlasPreview = 'paper';
    const surface = canvas.current!;
    const ctx = surface.getContext('2d')!;
    const draft = document.createElement('canvas');
    const ink = draft.getContext('2d')!;
    const terrain = document.createElement('canvas');
    const art = terrain.getContext('2d')!;
    const reveal = document.createElement('canvas');
    const out = reveal.getContext('2d')!;
    const mask = document.createElement('canvas');
    const brush = mask.getContext('2d')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    const random = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    let width = 0, height = 0, ratio = 1, cols = 0, rows = 0;
    let amounts = new Float32Array(0), quietCells = new Float32Array(0), frame = 0, last = 0;
    let pointer = { x: -9999, y: -9999 }, active = false, pinned = false;
    const cell = 6;
    type Land = { x: number; y: number; rx: number; ry: number; phase: number };
    let lands: Land[] = [];
    let protectedAreas: DOMRect[] = [];
    const protectionSelectors = 'h1,h2,h3,p,button,a,input,textarea,select,label,.creation-composer,.market-toolbar,.market-filter-label,.market-tabs,.market-game-copy,.market-feature-copy,.site-header,.paper-atlas-preview-note';
    const quiet = (x: number, y: number) => {
      // Use the live UI, not a viewport-centred ellipse: scrolling and narrow
      // layouts keep the same quiet padding around their actual text and controls.
      let amount = 1;
      for (const r of protectedAreas) {
        const dx = Math.max(r.left - 10 - x, 0, x - r.right - 10);
        const dy = Math.max(r.top - 8 - y, 0, y - r.bottom - 8);
        amount = Math.min(amount, smooth(0, 22, Math.hypot(dx, dy)));
        if (amount === 0) break;
      }
      return amount;
    };
    const landValue = (x: number, y: number) => Math.max(...lands.map(l => {
      const nx = (x - l.x) / l.rx, ny = (y - l.y) / l.ry;
      const t = Math.atan2(ny, nx);
      const edge = 1 + .15 * Math.sin(t * 3 + l.phase) + .08 * Math.sin(t * 7 - l.phase) + .035 * Math.cos(t * 13);
      return 1 - Math.hypot(nx, ny) / edge;
    }));
    const river = (x: number, y: number) => Math.abs(x - (width * .135 + Math.sin(y / height * 7.3) * width * .043));
    function resize() {
      width = innerWidth; height = innerHeight; ratio = Math.min(devicePixelRatio || 1, 1.5);
      [surface, draft, terrain, reveal, mask].forEach(c => { c.width = Math.ceil(width * ratio); c.height = Math.ceil(height * ratio); });
      [ctx, ink, art, out, brush].forEach(c => { c.setTransform(ratio, 0, 0, ratio, 0, 0); c.imageSmoothingEnabled = false; });
      lands = [
        { x: width * .07, y: height * .47, rx: width * .255, ry: height * .55, phase: .8 },
        { x: width * .94, y: height * .29, rx: width * .20, ry: height * .40, phase: 2.1 },
        { x: width * .88, y: height * .97, rx: width * .25, ry: height * .27, phase: 5.6 },
      ];
      protectedAreas = Array.from(document.querySelectorAll(protectionSelectors))
        .map(element => element.getBoundingClientRect())
        .filter(r => r.width > 0 && r.height > 0 && r.bottom > -30 && r.top < height + 30);
      cols = Math.ceil(width / cell); rows = Math.ceil(height / cell); amounts = new Float32Array(cols * rows);
      quietCells = new Float32Array(cols * rows);
      for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
        quietCells[gy * cols + gx] = quiet(gx * cell + cell / 2, gy * cell + cell / 2);
      }
      ink.clearRect(0, 0, width, height); art.clearRect(0, 0, width, height);
      // One occupancy grid drives BOTH states. Draft shoreline is traced along
      // the very edges of the cells later filled by the pixel terrain.
      const occupied = new Uint8Array(cols * rows);
      for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
        occupied[gy * cols + gx] = Number(landValue(gx * cell + cell / 2, gy * cell + cell / 2) > 0);
      }
      const isLand = (gx: number, gy: number) => gx >= 0 && gy >= 0 && gx < cols && gy < rows && occupied[gy * cols + gx] === 1;
      function shore(x: number, y: number, ex: number, ey: number, seed: number) {
        const q = quiet((x + ex) / 2, (y + ey) / 2);
        if (q < .01 || random(seed) < .16) return;
        ink.strokeStyle = `rgba(81,80,74,${(.34 + random(seed + 7) * .12) * q})`;
        ink.lineWidth = .85 + random(seed + 3) * .35;
        ink.beginPath(); ink.moveTo(x, y); ink.lineTo(ex, ey); ink.stroke();
      }
      for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
        if (!isLand(gx, gy)) continue;
        const x = gx * cell, y = gy * cell, seed = gx * 31 + gy * 73;
        if (!isLand(gx - 1, gy)) shore(x, y, x, y + cell, seed);
        if (!isLand(gx + 1, gy)) shore(x + cell, y, x + cell, y + cell, seed + 1);
        if (!isLand(gx, gy - 1)) shore(x, y, x + cell, y, seed + 2);
        if (!isLand(gx, gy + 1)) shore(x, y + cell, x + cell, y + cell, seed + 3);
        const q = quiet(x, y), h = landValue(x + cell / 2, y + cell / 2);
        if (Math.abs(h - .23) < .014 && random(seed + 9) > .35) {
          ink.strokeStyle = `rgba(100,97,87,${.20 * q})`; ink.lineWidth = .6;
          ink.beginPath(); ink.moveTo(x, y); ink.lineTo(x + cell, y + 1); ink.stroke();
        }
        // River sketch follows the same cell-centre test as its pixel water.
        if (h >= .045 && river(x + cell / 2, y + cell / 2) < 5) {
          ink.fillStyle = `rgba(96,117,116,${.32 * q})`; ink.fillRect(x + 2, y, 1.5, cell);
        }
      }
      const phrases = ['她在旧码头停下……', '雾还没有散', '北境的来信', '此处或有一座桥？', '后来，他没有回头', '未命名的山谷', '灯熄灭之前——', '归途 / 待续', '河流往哪里去？', '有人记得这片森林', '……另一种结局', '旧城？'];
      lands.forEach((l, li) => {
        for (let i = 0; i < 12; i++) {
          const t = i / 12 * Math.PI * 2 + li * .41;
          const warp = 1 + .15 * Math.sin(t * 3 + l.phase) + .08 * Math.sin(t * 7 - l.phase) + .035 * Math.cos(t * 13);
          const x = l.x + Math.cos(t) * l.rx * warp * (.67 + random(i + 18) * .25);
          const y = l.y + Math.sin(t) * l.ry * warp * (.67 + random(i + 18) * .25);
          const q = quiet(x, y); if (q < .55 || x < 12 || x > width - 80 || y < 20 || y > height - 15) continue;
          ink.save(); ink.translate(x, y); ink.rotate(Math.sin(t) * .22);
          ink.font = `${11 + random(i * 8 + li) * 1.5}px "Songti SC", SimSun, serif`;
          ink.fillStyle = `rgba(91,85,76,${.32 * q})`;
          const phrase = phrases[(i + li * 5) % phrases.length];
          let offset = 0;
          for (const char of phrase) { ink.fillText(char, offset, Math.sin(offset / 55) * 3); offset += ink.measureText(char).width; }
          if (i % 4 === 0) { ink.strokeStyle = 'rgba(91,85,76,.23)'; ink.lineWidth = .6; ink.beginPath(); ink.moveTo(-2, -3); ink.lineTo(offset * .6, -4); ink.stroke(); }
          ink.restore();
        }
      });
      for (let y = 0; y < height; y += cell) for (let x = 0; x < width; x += cell) {
        const h = landValue(x + cell / 2, y + cell / 2), q = quiet(x, y);
        if (h <= 0 || q < .015) continue;
        art.globalAlpha = 1;
        const v = Math.floor(random(x * .17 + y * 13) * 6);
        art.fillStyle = h < .045 ? '#d5ceb3' : river(x + cell / 2, y + cell / 2) < 5 ? '#8eafb5' : ['#b8c9a8','#b5c5a3','#afc29f','#bfceaf','#b9c7a9','#b3c4a4'][v];
        art.fillRect(x, y, cell, cell);
        if (h > .15 && river(x, y) > 20 && random(x * 7 + y * 19) > .989) {
          // Small flat pixel clusters, without perspective or raised terraces.
          art.fillStyle = '#7f9e79'; art.fillRect(x + 2, y - 5, 6, 6); art.fillRect(x, y - 1, 10, 5);
          art.fillStyle = '#a1b58c'; art.fillRect(x + 2, y - 5, 4, 5);
          art.fillStyle = '#988e75'; art.fillRect(x + 4, y + 4, 2, 4);
        }
        if (h > .1 && random(x * 29 + y * 31) > .9991) {
          art.fillStyle = '#a3a18e'; art.fillRect(x, y - 4, 3, 11); art.fillRect(x + 9, y - 2, 3, 9); art.fillRect(x, y - 4, 10, 3);
        }
      }
      // Clip entire glyphs and sprite footprints against the same UI exclusion
      // field, not just their anchor points. Long phrases cannot enter controls.
      brush.clearRect(0, 0, width, height);
      for (let y = 0; y < height; y += cell) for (let x = 0; x < width; x += cell) {
        brush.fillStyle = `rgba(0,0,0,${quiet(x + cell / 2, y + cell / 2)})`;
        brush.fillRect(x, y, cell, cell);
      }
      for (const context of [ink, art]) {
        context.globalAlpha = 1;
        context.globalCompositeOperation = 'destination-in'; context.drawImage(mask, 0, 0, width, height);
        context.globalCompositeOperation = 'source-over';
      }
      ctx.clearRect(0, 0, width, height); ctx.drawImage(draft, 0, 0, width, height);
      surface.dataset.phase = 'draft';
    }
    function schedule() { if (!frame && !document.hidden) frame = requestAnimationFrame(paint); }
    function paint(now: number) {
      frame = 0;
      const dt = Math.min(64, now - last || 32); last = now;
      brush.clearRect(0, 0, width, height);
      let moving = false, maximum = 0;
      const radius = Math.min(145, width * .22);
      for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
        const i = gy * cols + gx, x = gx * cell, y = gy * cell;
        const distance = Math.hypot(x - pointer.x, y - pointer.y);
        const target = (pinned || active && !reduced.matches && fine.matches) ? (1 - smooth(radius * .35, radius, distance)) * quietCells[i] : 0;
        const old = amounts[i];
        const value = reduced.matches ? target : old + (target - old) * (1 - Math.exp(-dt / (target > old ? 210 : 340)));
        amounts[i] = value < .002 ? 0 : value;
        if (Math.abs(target - value) > .003) moving = true;
        if (value < .006) continue;
        maximum = Math.max(maximum, value);
        // A stable spatial threshold creates a quiet grain dissolve, never flicker.
        const grain = random(gx * 11 + gy * 53) * .12;
        const alpha = smooth(grain, .60 + grain, value) * .96;
        brush.fillStyle = `rgba(0,0,0,${alpha})`; brush.fillRect(x, y, cell, cell);
      }
      ctx.clearRect(0, 0, width, height); ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(draft, 0, 0, width, height);
      ctx.globalCompositeOperation = 'destination-out'; ctx.drawImage(mask, 0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
      out.globalCompositeOperation = 'source-over'; out.clearRect(0, 0, width, height); out.drawImage(terrain, 0, 0, width, height);
      out.globalCompositeOperation = 'destination-in'; out.drawImage(mask, 0, 0, width, height);
      ctx.drawImage(reveal, 0, 0, width, height);
      surface.dataset.phase = maximum > .08 ? 'revealing' : 'draft';
      if (moving) schedule();
    }
    const controls = 'button,a,input,textarea,select,[role="dialog"],[contenteditable="true"]';
    function move(event: PointerEvent) {
      if (event.pointerType !== 'mouse') return;
      if (pinned) return;
      pointer = { x: event.clientX, y: event.clientY };
      active = !(event.target instanceof Element && event.target.closest(controls)); schedule();
    }
    function leave() { active = false; schedule(); }
    function demonstrate(event: Event) {
      pinned = Boolean((event as CustomEvent<boolean>).detail);
      pointer = { x: width * .12, y: height * .72 };
      // Place the demonstration in actual open land, not on a fixed button row.
      let best = -Infinity;
      const margin = Math.min(95, width * .14);
      for (let y = 120; y < height - 90; y += 24) for (let x = margin; x < width - margin; x += 24) {
        const h = landValue(x, y);
        if (h < .12 || quiet(x, y) < .98) continue;
        const space = [quiet(x - 42, y), quiet(x + 42, y), quiet(x, y - 42), quiet(x, y + 42)].reduce((a, b) => a + b, 0);
        const score = space + h * .2 - Math.hypot(x / width - .84, y / height - .66) * .3;
        if (score > best) { best = score; pointer = { x, y }; }
      }
      active = false; schedule();
    }
    function focusControl(event: FocusEvent) {
      if (event.target instanceof Element && event.target.closest(controls)) leave();
    }
    let rebuildFrame = 0;
    function rebuild() {
      if (rebuildFrame) return;
      rebuildFrame = requestAnimationFrame(() => {
        rebuildFrame = 0; cancelAnimationFrame(frame); frame = 0; active = false;
        resize(); if (pinned) demonstrate(new CustomEvent('cw:paper-demo', { detail: true }));
      });
    }
    function visibility() { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else rebuild(); }
    resize();
    window.addEventListener('cw:paper-demo', demonstrate);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('resize', rebuild);
    window.addEventListener('scroll', rebuild, { passive: true });
    window.addEventListener('hashchange', rebuild);
    const layoutObserver = new ResizeObserver(rebuild);
    const main = document.querySelector('.portal main');
    if (main) layoutObserver.observe(main);
    window.addEventListener('blur', leave);
    document.addEventListener('pointerleave', leave);
    document.addEventListener('focusin', focusControl);
    document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', leave);
    fine.addEventListener('change', leave);
    return () => {
      cancelAnimationFrame(frame); cancelAnimationFrame(rebuildFrame); layoutObserver.disconnect(); delete document.documentElement.dataset.atlasPreview;
      window.removeEventListener('cw:paper-demo', demonstrate);
      window.removeEventListener('pointermove', move); window.removeEventListener('resize', rebuild);
      window.removeEventListener('scroll', rebuild); window.removeEventListener('hashchange', rebuild); window.removeEventListener('blur', leave);
      document.removeEventListener('pointerleave', leave); document.removeEventListener('focusin', focusControl);
      document.removeEventListener('visibilitychange', visibility); reduced.removeEventListener('change', leave); fine.removeEventListener('change', leave);
    };
  }, []);
  return <><div className="paper-atlas" aria-hidden="true"><canvas ref={canvas} /><div className="paper-atlas-fibres" /></div><div className="paper-atlas-preview-note"><span>纸上世界 · 效果预览</span><button type="button" aria-pressed={demo} onClick={() => { setDemo(!demo); window.dispatchEvent(new CustomEvent('cw:paper-demo', { detail: !demo })); }}>{demo ? '收起显影' : '显影演示'}</button><a href={location.pathname + '#/'}>返回当前版 ↗</a></div></>;
}
