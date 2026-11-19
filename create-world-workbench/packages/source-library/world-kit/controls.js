import { mountJoystick } from './joystick.js';
import { mountInteractionKey } from './interaction-key.js';
import { mountKeyboard } from './keyboard.js';

export function mountWorldControls(options = {}) {
  const joystick = options.joystick === false ? null : mountJoystick(options);
  const interaction = options.interaction === false ? null : mountInteractionKey(options);
  const keyboard = options.keyboard === false ? null : mountKeyboard({
    onKeyDown: (action, code) => ['up', 'down', 'left', 'right'].includes(action) ? options.onKeyDown?.(action, code) : action === 'interact' ? options.onActionDown?.(code) : options.onAction?.(action, code),
    onKeyUp: (action, code) => action === 'interact' ? options.onActionUp?.(code) : options.onKeyUp?.(action, code),
  });
  const controls = {
    setContext(next = {}) { const visible = next.visible !== false; joystick?.setVisible(visible && next.joystickVisible !== false); interaction?.setContext(next); keyboard?.setEnabled(visible && next.keyboardEnabled !== false); },
    releaseAll() { joystick?.release(); interaction?.release(); keyboard?.reset(); },
    destroy() { joystick?.destroy(); interaction?.destroy(); keyboard?.destroy(); },
  };
  controls.setContext({ visible: false, actionEnabled: false, keyboardEnabled: false });
  return controls;
}
