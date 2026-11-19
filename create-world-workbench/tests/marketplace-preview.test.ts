import test from 'node:test';
import assert from 'node:assert/strict';
import { marketplace, marketplacePreviewPath } from '../apps/web/src/site/marketplace.js';
import { worldById } from '../apps/web/src/site/worlds.js';

test('marketplace only advertises previews backed by an existing playable world', async () => {
  const games = await marketplace.listGames();
  for (const game of games) {
    const path = marketplacePreviewPath(game);
    assert.equal(game.playable, Boolean(path), game.id);
    if (path) assert.equal(worldById(game.previewWorldId!)?.playable, true);
  }
  assert.equal(marketplacePreviewPath((await marketplace.getGame('quiet-harbor'))!), '#/games/preview/harbor');
  assert.equal(marketplacePreviewPath((await marketplace.getGame('orbit-echoes'))!), '#/games/preview/station');
  for (const id of ['after-the-walls', 'mountain-return', 'dust-signal']) {
    assert.equal((await marketplace.getGame(id))?.playable, false, id);
  }
});

test('a draft checkbox cannot claim a playable game without a runtime', async () => {
  const draft = await marketplace.publishDraft({ title: '展示草稿', description: '尚未上传可运行游戏', tags: [], pricing: { type: 'free', currency: 'CNY' }, playable: true });
  assert.equal(draft.playable, false);
  assert.equal(marketplacePreviewPath(draft), undefined);
});
