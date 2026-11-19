import assert from 'node:assert/strict';
import test from 'node:test';
import { playableRevision } from '../apps/web/src/site/local-games.js';
import type { Revision } from '../apps/web/src/types.js';

const revision = (id: string, status: Revision['status'], day: string, preview = true): Revision => ({
  id, status, projectId: 'project', runId: 'run', baseRevisionId: null, title: id, summary: '', createdAt: `2026-10-${day}T00:00:00Z`,
  previewUrl: preview ? `http://127.0.0.1:8790/${id}/` : null,
});

test('local library selects current runnable build before newer candidates', () => {
  const revisions = [revision('old', 'accepted', '10'), revision('new', 'candidate', '20')];
  assert.equal(playableRevision({ currentRevisionId: 'old' }, revisions)?.id, 'old');
});
test('without current version the library prefers accepted builds and preserves source ordering', () => {
  const revisions = [revision('old', 'accepted', '10'), revision('new', 'candidate', '20')];
  assert.equal(playableRevision({}, revisions)?.id, 'old');
  assert.deepEqual(revisions.map(item => item.id), ['old', 'new']);
});
test('previewable candidates are available but missing builds and rejected revisions are excluded', () => {
  assert.equal(playableRevision({}, [revision('no-build', 'accepted', '20', false), revision('rejected', 'rejected', '19')]), undefined);
  assert.equal(playableRevision({}, [revision('a', 'candidate', '10'), revision('b', 'candidate', '20')])?.id, 'b');
});
