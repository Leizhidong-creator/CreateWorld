import { useEffect, useRef } from 'react';
import './WorldAtlas.css';
import { useTheme } from './theme.js';

type Land = { x: number; y: number; rx: number; ry: number; phase: number; color: string };

type Scene = { x: number; y: number; kind: 'house' | 'lake' | 'flowers' | 'tree'; scale: number; seed: number };

type Stroke = { x: number; y: number; ex: number; ey: number; ink: string; seed: number; gap: boolean };

/** A pencil atlas becomes its own pixel game terrain in a small hover region. */
export function WorldAtlas() {
  const theme = useTheme();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const dark = theme === 'dark';
    const nightInk: Record<string, string> = { '86,122,141':'133,177,176', '117,124,148':'179,164,130', '96,128,147':'126,154,179', '97,130,141':'137,162,155', '109,136,142':'155,161,143', '114,130,149':'189,170,129' };
    const surface = canvas.current!;
    const ctx = surface.getContext('2d');
    if (!ctx) return;
    const paper = document.createElement('canvas');
    const base = paper.getContext('2d')!;
    const terrain = document.createElement('canvas');
    const pixels = terrain.getContext('2d')!;
    const details = document.createElement('canvas');
    const art = details.getContext('2d')!;
    const reveal = document.createElement('canvas');
    const mask = reveal.getContext('2d')!;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    let strokes: Stroke[] = [];
    let width = 0, height = 0, ratio = 1, frame = 0, previous = 0;
    let pointer = { x: -1000, y: -1000 };
    let lands: Land[] = [];
    let unit = 1;
    let hovered = false;
    let strength = 0;
    let focus = { x: -1000, y: -1000 };
    let scenes: Scene[] = [];
    let interacting = false;

    const random = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    // Smooth, seeded irregularity resembles hand pressure without a repeated sine ripple.
    function pencilNoise(t: number, count: number, seed: number) {
      const position = t / (Math.PI * 2) * count;
      const index = Math.floor(position), fraction = position - index;
      const blend = fraction * fraction * (3 - 2 * fraction);
      const a = random((index % count + count) % count + seed);
      const b = random(((index + 1) % count + count) % count + seed);
      return (a + (b - a) * blend) * 2 - 1;
    }
    function add(x: number, y: number, ex: number, ey: number, index: number, ink: string, gap = false) {
      strokes.push({ x, y, ex, ey, ink: dark ? nightInk[ink] || ink : ink, seed: random(index), gap });
    }
    function resize() {
      width = window.innerWidth; height = window.innerHeight;
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      surface.width = paper.width = Math.round(width * ratio);
      surface.height = paper.height = Math.round(height * ratio);
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
      base.setTransform(ratio, 0, 0, ratio, 0, 0);
      strokes = [];
      terrain.width = surface.width; terrain.height = surface.height;
      pixels.setTransform(ratio, 0, 0, ratio, 0, 0);
      details.width = surface.width; details.height = surface.height;
      art.setTransform(ratio, 0, 0, ratio, 0, 0);
      strength = 0;
      focus = { x: -1000, y: -1000 };
      unit = Math.min(width / 1400, 1.2);
      // An asymmetric landscape sweeps inward; the drawing has room to breathe.
      lands = [
        { x: width * .27, y: height * .62, rx: 380, ry: 235, phase: .8, color: '86,122,141' },
        { x: width * .80, y: height * .23, rx: 220, ry: 120, phase: 2.1, color: '117,124,148' },
        { x: width * .76, y: height * .93, rx: 220, ry: 115, phase: 5.6, color: '109,136,142' },
      ];
      const contours: { path: Path2D; echo: Path2D; ink: string; alpha: number }[] = [];
      lands.forEach((g, gi) => {
        const rings = gi === 0 ? 8 : 5;
        for (let ring = 0; ring < rings; ring++) {
          const count = 320;
          const point = (i: number, pass = 0) => {
            const t = i / count * Math.PI * 2;
            const warp = 1 + .15 * Math.sin(3 * t + g.phase) + .07 * Math.cos(5 * t - g.phase);
            const r = .34 + ring * (gi === 0 ? .12 : .20);
            const seed = gi * 793 + ring * 31;
            const hand = pencilNoise(t, 27, seed) * 1.45 + pencilNoise(t, 73, seed + 131) * .38
              + (pass ? pencilNoise(t, 11, seed + 271) * 1.6 : 0);
            return { x: g.x + Math.cos(t) * (g.rx * unit * r * warp + hand),
              y: g.y + Math.sin(t) * (g.ry * Math.max(unit, .7) * r * warp + hand) };
          };
          const path = new Path2D(), echo = new Path2D();
          for (let i = 0; i < count; i++) {
            const a = point(i), b = point(i + 1), id = gi * 1700 + ring * 131 + i;
            if (i === 0) path.moveTo(a.x, a.y);
            path.lineTo(b.x, b.y);
            const ea = point(i, 1), eb = point(i + 1, 1);
            if (i === 0) echo.moveTo(ea.x, ea.y);
            echo.lineTo(eb.x, eb.y);
            add(a.x, a.y, b.x, b.y, id, g.color);
          }
          path.closePath(); echo.closePath();
          contours.push({ path, echo, ink: dark ? nightInk[g.color] || g.color : g.color,
            alpha: (dark ? .25 : .24) * (gi === 0 ? .88 : .8) * (.92 + ring * .015) });
        }
      });
      base.clearRect(0, 0, width, height);
      base.lineJoin = 'round'; base.lineCap = 'round';
      for (const contour of contours) {
        // A continuous graphite core, with an independently redrawn soft first attempt.
        base.strokeStyle = `rgba(${contour.ink},${contour.alpha * .8})`;
        base.lineWidth = .66; base.stroke(contour.path);
        base.strokeStyle = `rgba(${contour.ink},${contour.alpha * .27})`;
        base.lineWidth = .42; base.stroke(contour.echo);
      }
      // Pressure and fine graphite grain vary along the line, while its core stays intact.
      for (const stroke of strokes) {
        const pressure = .45 + stroke.seed * .55;
        base.strokeStyle = `rgba(${stroke.ink},${pressure * (dark ? .13 : .12)})`;
        base.lineWidth = .35 + stroke.seed * .65;
        base.beginPath(); base.moveTo(stroke.x,stroke.y); base.lineTo(stroke.ex,stroke.ey); base.stroke();
      }
      renderTerrain();
      paint(performance.now(), true);
    }
    // The pixel terrain uses the very same distorted radius as the contour sketch.
    function elevation(x: number, y: number) {
      let peak = 0;
      for (const land of lands) {
        const nx = (x - land.x) / (land.rx * unit);
        const ny = (y - land.y) / (land.ry * Math.max(unit, .7));
        const angle = Math.atan2(ny, nx);
        const warp = 1 + .15 * Math.sin(3 * angle + land.phase) + .07 * Math.cos(5 * angle - land.phase);
        peak = Math.max(peak, 1 - Math.hypot(nx, ny) / (warp * 1.3));
      }
      return Math.max(.045, peak);
    }
    function renderTerrain() {
      pixels.clearRect(0, 0, width, height);
      const cell = 5;
      // Muted game palette: moss terraces, shaded stone, and a sparse rocky summit.
      const palette = dark ? [[28,45,44], [35,60,48], [43,74,52], [54,83,58], [66,87,66], [79,94,80], [95,105,96], [111,117,104]] : [[142,179,150], [137,179,139], [129,174,124], [147,184,131], [164,190,147], [179,196,164], [192,203,185], [210,216,200]];
      for (let y = -30; y < height + 40; y += cell) {
        for (let x = 0; x < width; x += cell) {
          const h = elevation(x, y);
          if (h < .025) continue;
          const level = Math.min(7, Math.floor(h * 8));
          const northwest = elevation(x - cell, y - cell);
          const southeast = elevation(x + cell, y + cell);
          const edge = Math.floor(southeast * 8) < level;
          const shade = edge ? -7 : Math.floor(northwest * 8) < level ? 5 : 0;
          const grain = Math.floor(random(x * .21 + y * 13) * 5) - 2;
          const color = palette[level].map((c, channel, rgb) => {
            const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
            return Math.round(Math.max(0, Math.min(255, luminance + (c - luminance) * 1.35 + shade + grain)));
          });
          pixels.fillStyle = `rgb(${color.join(',')})`;
          const top = y - Math.round(h * 24 / cell) * cell;
          pixels.fillRect(x, top, cell, cell + 5);
          if (edge && level > 1) {
            pixels.fillStyle = 'rgba(72,104,88,.3)';
            pixels.fillRect(x, top + cell - 1, cell, 1);
          }
        }
      }
      art.clearRect(0, 0, width, height);
      scenes = [
        {x:width*.19,y:height*.36,kind:'house',scale:1.7,seed:13},
        {x:width*.64,y:height*.53,kind:'lake',scale:1.8,seed:29},
        {x:width*.78,y:height*.27,kind:'house',scale:1.8,seed:47},
        {x:width*.43,y:height*.78,kind:'flowers',scale:1.8,seed:61},
        {x:width*.12,y:height*.73,kind:'tree',scale:1.6,seed:73},
        {x:width*.87,y:height*.63,kind:'flowers',scale:1.7,seed:89},
        {x:width*.67,y:height*.86,kind:'house',scale:1.6,seed:101},
        {x:width*.42,y:height*.49,kind:'tree',scale:1.5,seed:113},
      ];
      for (let y = 130; y < height - 25; y += 155) {
        for (let x = 80; x < width - 30; x += 180) {
          const seed = x * 3 + y * 11;
          const sx = x + random(seed) * 65, sy = y + random(seed + 1) * 35;
          if (random(seed + 2) < .4 || scenes.some(s => Math.hypot(s.x - sx, s.y - sy) < 100)) continue;
          scenes.push({x:sx,y:sy,seed,scale:1.1,kind:random(seed+3) > .5 ? 'tree' : 'flowers'});
        }
      }
      for (const scene of scenes) {
        drawScene(scene);
      }
    }
    function drawScene(scene: Scene) {
      const target = art;
      const scale = scene.scale * (width < 700 ? .6 : .8);
      target.save(); target.translate(Math.round(scene.x), Math.round(scene.y)); target.scale(scale, scale);
        const fill=(color:string,x:number,y:number,w:number,h:number)=>{target.fillStyle=color;target.fillRect(x,y,w,h);};
        if(scene.kind==='house') {
          fill(dark?'#40533c':'#9cba85',-15,12,32,4);
          fill(dark?'#c1ae83':'#e6cf9e',-10,-1,22,15); fill(dark?'#9b9471':'#c2b58a',8,0,5,14);
          fill(dark?'#b97d75':'#cf9284',-14,-3,30,4); fill(dark?'#b97d75':'#cf9284',-10,-7,22,4); fill(dark?'#ca9485':'#dfaa96',-5,-11,12,4); fill('#a17b72',0,-14,3,3);
          fill('#866d62',8,-14,4,10); fill('#f0d995',-6,3,4,4); fill('#6b7968',1,6,4,8);
        } else if(scene.kind==='lake') {
          for(let row=-4;row<=4;row++) {
            const span=[5,12,18,21,22,20,17,12,5][row+4];
            fill(dark?'#426a57':'#a4be8a',-span-2,row*3,span*2+4,3);
            fill(row<0?(dark?'#5c97a9':'#82bdcd'):(dark?'#497d9e':'#70abc8'),-span,row*3,span*2,3);
          }
          fill('#c3dfdb',-12,-3,10,2); fill('#9fcbd4',3,4,12,2);
        } else if(scene.kind==='tree') {
          fill('#8e8a66',-1,0,3,15); fill(dark?'#3c684c':'#83ae77',-11,-4,23,10);
          fill(dark?'#527d56':'#98bc80',-8,-10,17,9); fill(dark?'#6a9564':'#adc990',-3,-14,9,6);
          fill('#789c65',8,0,7,5);
        } else {
          const petals=dark?['#c38fa8','#d8bb6d','#a89bc8']:['#d39bae','#e0c374','#b0a0d0'];
          for(let f=0;f<5;f++) {
            const x=Math.round((random(scene.seed+f*9)-.5)*25), y=Math.round((random(scene.seed+f*7+1)-.5)*12);
            fill('#799454',x,y,2,9); fill(petals[f%3],x-3,y-2,8,3); fill(petals[f%3],x,y-5,2,9); fill('#efda98',x,y-2,2,2);
          }
        }
      target.restore();
    }
    function paint(now: number, still = false) {
      const dt = Math.min((now - previous) || 40, 80);
      const time = motion.matches || still ? 0 : now;
      // Both sketch and finished terrain share a slow, sub-pixel breathing motion.
      const driftX = Math.sin(time / 12000) * 1.6;
      const driftY = Math.sin(time / 15000) * 1.2;
      ctx!.clearRect(0, 0, width, height);
      ctx!.drawImage(paper, driftX, driftY, width, height);
      const active = hovered && !interacting && fine.matches && !motion.matches;
      strength += ((active ? 1 : 0) - strength) * Math.min(dt / (active ? 85 : 140), 1);
      if (active) focus = { ...pointer };
      if (!motion.matches) {
        for (const s of strokes) {
          const breathing = s.seed > .72 ? Math.pow(Math.max(0, Math.sin(now / 9000 + s.x / 350 + s.y / 320)), 6) * .065 : 0;
          if (breathing < .01) continue;
          ctx!.strokeStyle = `rgba(${s.ink},${breathing})`; ctx!.lineWidth = .6;
          ctx!.beginPath(); ctx!.moveTo(s.x + driftX, s.y + driftY);
          ctx!.lineTo(s.ex + driftX, s.ey + driftY); ctx!.stroke();
        }
      }
      if (strength < .005) return;
      const radius = 104;
      const size = radius * 2 + 4;
      if (reveal.width !== Math.round(size * ratio)) {
        reveal.width = Math.round(size * ratio); reveal.height = Math.round(size * ratio);
        mask.setTransform(ratio, 0, 0, ratio, 0, 0);
      }
      const left = focus.x - size / 2, top = focus.y - size / 2;
      mask.clearRect(0, 0, size, size); mask.globalCompositeOperation = 'source-over';
      mask.filter = 'saturate(1.18)';
      mask.drawImage(terrain, driftX - left, driftY - top, width, height);
      mask.drawImage(details, driftX - left, driftY - top, width, height);
      mask.filter = 'none'; mask.globalCompositeOperation = 'destination-in';
      const fade = mask.createRadialGradient(size / 2, size / 2, radius * .32, size / 2, size / 2, radius);
      fade.addColorStop(0, `rgba(0,0,0,${strength * .99})`);
      fade.addColorStop(.4, `rgba(0,0,0,${strength * .94})`);
      fade.addColorStop(.75, `rgba(0,0,0,${strength * .32})`); fade.addColorStop(1, 'transparent');
      mask.fillStyle = fade; mask.fillRect(0, 0, size, size);
      ctx!.drawImage(reveal, left, top, size, size);
    }
    function tick(now: number) {
      frame = 0;
      if (document.hidden || motion.matches) return;
      if (now - previous >= 40) { paint(now); previous = now; }
      frame = requestAnimationFrame(tick);
    }
    function start() {
      cancelAnimationFrame(frame); frame = 0;
      if (!motion.matches && !document.hidden) frame = requestAnimationFrame(tick);
      else paint(performance.now(), true);
    }
    const controls = 'button,a,input,textarea,select,label,summary,[role="button"],[role="link"],[role="checkbox"],[role="dialog"],[contenteditable="true"],[tabindex]:not([tabindex="-1"])';
    function move(event: PointerEvent) {
      if (event.pointerType !== 'mouse') return;
      interacting = event.target instanceof Element && Boolean(event.target.closest(controls));
      pointer = { x: event.clientX, y: event.clientY }; hovered = true;
    }
    function focusControl(event: FocusEvent) {
      if (event.target instanceof Element && event.target.closest(controls)) { interacting = true; hovered = false; }
    }
    function leave() { hovered = false; }
    function route() { surface.classList.toggle('is-quiet', /^#\/studio\//.test(window.location.hash)); }
    resize(); route(); start();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerover', move, { passive: true });
    document.addEventListener('focusin', focusControl);
    window.addEventListener('scroll', leave, { passive: true });
    document.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
    document.addEventListener('visibilitychange', start);
    window.addEventListener('hashchange', route);
    motion.addEventListener('change', start);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerover', move);
      document.removeEventListener('focusin', focusControl);
      window.removeEventListener('scroll', leave);
      document.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', leave);
      document.removeEventListener('visibilitychange', start);
      window.removeEventListener('hashchange', route);
      motion.removeEventListener('change', start);
    };
  }, [theme]);
  return <div className="world-atlas" aria-hidden="true"><div className="world-atlas-wash" /><canvas ref={canvas} /><div className="world-atlas-grain" /></div>;
}
