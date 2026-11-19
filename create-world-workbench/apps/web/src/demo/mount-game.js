// Reuse the existing runtime and fixtures; this is a local prototype, not a new
// generated or formally accepted game. Keep its saves separate from other builds.
import { createGame } from '../../../../packages/runtime/engine.js';
import harbor from '../../../../fixtures/harbor.json';
import station from '../../../../fixtures/station.json';

export function mountDemo(target, id) {
  const config = structuredClone(id === 'station' ? station : harbor);
  config.id = 'public-preview-' + config.id;
  config.assetBase = new URL('/demo-assets/', window.location.origin);
  delete config.alternate;
  const game = createGame(config, { target });
  return game;
}
