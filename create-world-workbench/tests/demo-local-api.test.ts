import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoRequest } from '../apps/web/src/demo/local-api.js';
import type { Project, ProjectDetail, Run } from '../apps/web/src/types.js';

test('demo projects persist, revise, roll back and delete without network access', async () => {
  const storage = new Map<string, string>();
  const originalFetch = globalThis.fetch;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
  globalThis.fetch = () => { throw new Error('Demo must never use fetch'); };
  try {
    const project = await demoRequest<Project>('/api/projects', { body: { title: '测试世界', inputKind: 'title', sourceText: '', requirements: '' } });
    assert.equal((await demoRequest<Project[]>('/api/projects'))[0].id, project.id);
    assert.ok(storage.size);
    const initial = project.currentRevisionId;
    const run = await demoRequest<Run>(`/api/projects/${project.id}/runs`, { body: { instruction: '修改对白' } });
    const detail = await demoRequest<ProjectDetail>(`/api/projects/${project.id}`);
    assert.equal(detail.revisions.length, 2);
    assert.equal(detail.project.currentRevisionId, run.revisionId);
    await demoRequest(`/api/projects/${project.id}/rollback`, { body: { revisionId: initial } });
    assert.equal((await demoRequest<ProjectDetail>(`/api/projects/${project.id}`)).project.currentRevisionId, initial);
    await demoRequest(`/api/projects/${project.id}`, { method: 'PATCH', body: { sourceText: '新的故事' } });
    assert.equal((await demoRequest<ProjectDetail>(`/api/projects/${project.id}`)).project.sourceText, '新的故事');
    await demoRequest(`/api/projects/${project.id}`, { method: 'DELETE' });
    assert.equal((await demoRequest<Project[]>('/api/projects')).length, 0);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(demoRequest('/api/bootstrap', { signal: controller.signal }), { name: 'AbortError' });
  } finally {
    globalThis.fetch = originalFetch;
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
