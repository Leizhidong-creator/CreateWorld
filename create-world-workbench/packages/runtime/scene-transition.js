import { clone, condition } from './state.js';
import { canStand, sceneSolids } from './geometry.js';

/**
 * The single scene-transition semantic used by manual exits, automatic exits
 * and scene commands. Destination, spawn and onEnter effects are validated as
 * one candidate; a failure restores the previous run instead of leaving half
 * of the new scene published.
 *
 * @param {import('./state.js').StoryStore} store
 * @param {import('./types.js').GameConfig} config
 * @param {string} id
 * @param {{x:number,y:number}|undefined} position
 * @returns {any} the entered scene
 */
export function transitionScene(store, config, id, position) {
  const scene = config.scenes.find(candidate => candidate.id === id);
  if (!scene) throw new Error('场景不存在：' + id);
  const next = clone(store.run);
  next.scene = id;
  Object.assign(next.player, position, { moving: false });
  next.visits[id] = (next.visits[id] || 0) + 1;
  const radius = config.player.radius || 7;
  if (!canStand(next.player, scene, sceneSolids(scene, value => condition(value, next)), radius)) {
    throw new Error('场景 ' + id + ' 的落点被物件阻挡');
  }
  const previous = store.run;
  store.run = next;
  try {
    store.commit(scene.onEnter || [], 'enter:' + id);
  } catch (error) {
    store.run = previous;
    throw error;
  }
  return scene;
}
