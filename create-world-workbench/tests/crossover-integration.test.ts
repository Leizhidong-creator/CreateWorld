import test from 'node:test';
import assert from 'node:assert/strict';
import { marketplace } from '../apps/web/src/site/marketplace.js';
import { legacyDestination } from '../apps/web/src/site/navigation.js';
import { publishGame, prunePublished } from '../apps/web/src/site/publish-store.js';

test('published projects coexist with crossover examples and combined filters', async () => {
  const values = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } });
  try {
    const published = publishGame('test-project');
    const all = await marketplace.listGames();
    assert.equal(all[0].id, published.id);
    assert.equal(all.filter(game => game.concept).length, 5);
    assert.equal(all.find(game => game.id === published.id)?.sourceProjectId, 'test-project');
    const filtered = await marketplace.listGames({ query: '孙悟空', tag: '叙事', coCreation: '改编', pricing: 'free' });
    assert.deepEqual(filtered.map(game => game.id), ['wukong-daiyu']);
    assert.equal(filtered[0].playable, false);
    assert.equal((await marketplace.listGames({ query: '孙悟空', pricing: 'paid' })).length, 0);
    prunePublished([]);
    assert.equal(await marketplace.getGame(published.id), undefined);
    assert.equal((await marketplace.listGames()).filter(game => game.concept).length, 5);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('legacy routes preserve destinations without reintroducing login or external redirects', () => {
  assert.equal(legacyDestination('/login?next=%2Fgames%2Fwukong-daiyu'), '/games/wukong-daiyu');
  assert.equal(legacyDestination('/login?next=%2Fexport%2Fdemo'), '/export/demo');
  assert.equal(legacyDestination('/explore/harbor'), '/plugins');
  assert.equal(legacyDestination('/login?next=%2Fexplore%2Fharbor'), '/plugins');
  for (const destination of ['https://example.com', '//example.com', '/login', '/games/../../login']) {
    assert.equal(legacyDestination(`/login?next=${encodeURIComponent(destination)}`), '/projects');
  }
  assert.equal(legacyDestination('/plugins'), undefined);
});
