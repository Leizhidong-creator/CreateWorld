export const KEY_BINDINGS = Object.freeze({
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'interact', KeyE: 'interact', KeyM: 'map', KeyI: 'inventory', KeyJ: 'achievements', Escape: 'pause', KeyP: 'pause',
});
export function mountKeyboard(options = {}) {
  const onKeyDown = options.onKeyDown || (() => {}), onKeyUp = options.onKeyUp || (() => {}), held = new Set();
  let enabled = true;
  const reset = () => { for (const code of held) onKeyUp(KEY_BINDINGS[code], code); held.clear(); };
  const down = event => {
    if (!enabled || event.ctrlKey || event.metaKey || event.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return;
    const action = KEY_BINDINGS[event.code]; if (!action || (event.repeat && !['up', 'down', 'left', 'right'].includes(action))) return;
    event.preventDefault(); if (['up', 'down', 'left', 'right', 'interact'].includes(action)) { held.add(event.code); onKeyDown(action, event.code); } else if (!event.repeat) onKeyDown(action, event.code);
  };
  const up = event => { if (!held.has(event.code)) return; held.delete(event.code); onKeyUp(KEY_BINDINGS[event.code], event.code); };
  window.addEventListener('keydown', down); window.addEventListener('keyup', up, true); window.addEventListener('blur', reset); window.addEventListener('pagehide', reset); document.addEventListener('visibilitychange', reset);
  return { setEnabled(value) { enabled = Boolean(value); if (!enabled) reset(); }, reset, destroy() { reset(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up, true); window.removeEventListener('blur', reset); window.removeEventListener('pagehide', reset); document.removeEventListener('visibilitychange', reset); } };
}
