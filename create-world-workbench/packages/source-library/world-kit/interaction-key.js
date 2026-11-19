import { CONTROL_LAYOUT, VIEWPORT, logicalPercent } from './layout.js';
export function mountInteractionKey(options = {}) {
  const target = options.target || document.body;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cw-source-interaction-key';
  button.dataset.testid = 'action-button';
  button.setAttribute('aria-label', options.label || '交互');
  button.style.setProperty('--cw-action-left', logicalPercent(CONTROL_LAYOUT.action.x, VIEWPORT.width));
  button.style.setProperty('--cw-action-top', logicalPercent(CONTROL_LAYOUT.action.y, VIEWPORT.height));
  button.style.setProperty('--cw-action-size', logicalPercent(CONTROL_LAYOUT.action.size, VIEWPORT.width));
  target.append(button);
  let held = false;
  let pointer = null;
  let enabled = true;
  let destroyed = false;
  const onDown = options.onActionDown || (() => {});
  const onUp = options.onActionUp || (() => {});

  const release = event => {
    if (!held || (event && event.pointerId !== undefined && pointer !== event.pointerId)) return;
    held = false; pointer = null; button.classList.remove('is-held'); onUp();
  };
  const press = event => {
    if (destroyed || !enabled || held) return;
    event.preventDefault(); held = true; pointer = event.pointerId; button.classList.add('is-held');
    try { button.setPointerCapture(event.pointerId); } catch {}
    onDown();
  };
  const reset = () => { if (held) { held = false; onUp(); } pointer = null; button.classList.remove('is-held'); };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release, true);
  button.addEventListener('pointercancel', release, true);
  window.addEventListener('blur', reset);
  window.addEventListener('pagehide', reset);
  document.addEventListener('visibilitychange', reset);

  return {
    setContext(next = {}) {
      enabled = next.actionEnabled ?? enabled;
      button.hidden = next.visible === false || next.actionVisible === false;
      button.disabled = !enabled;
      button.textContent = next.actionLabel || options.label || '交互';
      button.setAttribute('aria-label', next.actionLabel || options.label || '交互');
      button.classList.toggle('is-highlighted', Boolean(next.actionHighlighted ?? enabled));
      if (button.hidden || button.disabled) reset();
    },
    release,
    destroy() {
      if (destroyed) return;
      destroyed = true; reset();
      button.removeEventListener('pointerdown', press);
      button.removeEventListener('pointerup', release, true);
      button.removeEventListener('pointercancel', release, true);
      window.removeEventListener('blur', reset);
      window.removeEventListener('pagehide', reset);
      document.removeEventListener('visibilitychange', reset);
      button.remove();
    },
  };
}


