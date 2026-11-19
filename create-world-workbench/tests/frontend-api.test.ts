import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapFrom, projectDetailFrom, projectListFrom, runDetailFrom } from '../apps/web/src/api.js';

const project = (id: string, updatedAt: string) => ({ id, title: id, updatedAt } as any);

test('transport normalisation owns sorting and legacy response envelopes', () => {
  const projects = projectListFrom({ projects: [project('old', '2026-01-01'), project('new', '2026-02-01')] });
  assert.deepEqual(projects.map(item => item.id), ['new', 'old']);
  assert.deepEqual(projectListFrom(undefined as any), []);
});

test('detail normalisation fills only missing collections and preserves order semantics', () => {
  const detail = projectDetailFrom({
    project: project('p1', '2026-01-01'),
    runs: [{ id: 'old', createdAt: '2026-01-01' }, { id: 'new', createdAt: '2026-02-01' }],
    revisions: [{ id: 'r1', createdAt: '2026-01-01', status: 'candidate' }],
  } as any);
  assert.deepEqual(detail.runs.map(item => item.id), ['new', 'old']);
  const run = runDetailFrom({ run: {}, tasks: undefined, events: undefined } as any);
  assert.deepEqual(run.tasks, []);
  assert.deepEqual(run.events, []);
  const bootstrap = bootstrapFrom({ csrfToken: 't', projects: undefined, capabilities: undefined } as any);
  assert.deepEqual(bootstrap.projects, []);
  assert.deepEqual(bootstrap.capabilities, {});
});
