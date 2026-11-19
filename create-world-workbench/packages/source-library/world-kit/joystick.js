import { CONTROL_LAYOUT, VIEWPORT, logicalPercent } from './layout.js';

function noop() {}

/** Mount the fixed-coordinate touch joystick. */
export function mountJoystick(options = {}) {
  const target = options.target || document.body;
  const root = document.createElement('div');
  root.className = 'cw-source-joystick';
  root.dataset.testid = 'joystick';
  root.setAttribute('role', 'button');
  root.setAttribute('aria-label', '移动摇杆');
  root.style.setProperty('--cw-joystick-left', logicalPercent(CONTROL_LAYOUT.joystick.x, VIEWPORT.width));
  root.style.setProperty('--cw-joystick-top', logicalPercent(CONTROL_LAYOUT.joystick.y, VIEWPORT.height));
  root.style.setProperty('--cw-joystick-size', logicalPercent(CONTROL_LAYOUT.joystick.size, VIEWPORT.width));
  root.style.setProperty('--cw-joystick-base', `url("${options.baseImage || new URL('./assets/joystick-base.svg', import.meta.url).href}")`);
  root.style.setProperty('--cw-joystick-knob', `url("${options.knobImage || new URL('./assets/joystick-knob.svg', import.meta.url).href}")`);
  const knob = document.createElement('span');
  knob.className = 'cw-source-joystick-knob';
  root.append(knob);
  target.append(root);

  let pointer = null;
  let destroyed = false;
  let last = '';
  const onMove = options.onMove || noop;
  const deadzone = options.deadzone ?? 0.18;

  const emit = (x, y, force = false) => {
    const keys = { w: y < -deadzone, a: x < -deadzone, s: y > deadzone, d: x > deadzone };
    const payload = { x, y, keys };
    const signature = [x.toFixed(3), y.toFixed(3), keys.w, keys.a, keys.s, keys.d].join(':');
    if (!force && signature === last) return;
    last = signature;
    onMove(payload);
  };
  const update = event => {
    const rect = root.getBoundingClientRect();
    const max = Math.max(1, rect.width * 0.42);
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;
    const length = Math.hypot(dx, dy);
    if (length > max) { dx = dx / length * max; dy = dy / length * max; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    emit(dx / max, dy / max);
  };
  const release = event => {
    if (pointer === null || (event && event.pointerId !== pointer)) return;
    pointer = null;
    knob.style.transform = 'translate(-50%, -50%)';
    emit(0, 0, true);
  };
  const down = event => {
    if (destroyed) return;
    event.preventDefault();
    release();
    pointer = event.pointerId;
    try { root.setPointerCapture(event.pointerId); } catch {}
    update(event);
  };
  const move = event => { if (event.pointerId === pointer) { event.preventDefault(); update(event); } };
  const cancel = event => release(event);
  const reset = () => release();
  root.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', cancel, true);
  window.addEventListener('pointercancel', cancel, true);
  window.addEventListener('blur', reset);
  window.addEventListener('pagehide', reset);
  document.addEventListener('visibilitychange', reset);

  return {
    setVisible(value) { root.hidden = !value; if (!value) release(); },
    release,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      release();
      root.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', cancel, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('blur', reset);
      window.removeEventListener('pagehide', reset);
      document.removeEventListener('visibilitychange', reset);
      root.remove();
    },
  };
}
