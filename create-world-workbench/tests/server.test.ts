import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createWorkbenchApp } from '../apps/server/app.js';
import type { Revision } from '../packages/contracts/index.js';

function listen(server: http.Server): Promise<number> {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)));
}

function chunkedPost(origin: string, pathname: string, body: string, headers: Record<string, string>): Promise<{ status: number; text: string }> {
  const data = Buffer.from(body, 'utf8');
  // Split inside a multi-byte UTF-8 sequence; per-chunk decoding would corrupt it.
  let split = data.findIndex((byte, index) => byte >= 0xe0 && index + 1 < data.length && (data[index + 1] & 0xc0) === 0x80);
  if (split < 0) split = Math.floor(data.length / 2);
  split += 1;
  const url = new URL(pathname, origin);
  return new Promise((resolve, reject) => {
    const request = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers: { ...headers, 'content-length': data.length } },
      response => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', chunk => (text += chunk));
        response.on('end', () => resolve({ status: response.statusCode || 0, text }));
      },
    );
    request.on('error', reject);
    request.write(data.subarray(0, split));
    setTimeout(() => {
      request.write(data.subarray(split));
      request.end();
    }, 10);
  });
}

test('HTTP adapters preserve DTO shapes, chunked UTF-8 and artifact boundaries', async () => {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-server-test-'));
  const token = 'test-csrf-token';
  let origin = '';
  let previewOrigin = '';
  const app = createWorkbenchApp({
    root: process.cwd(),
    dataRoot,
    token,
    origin: () => origin,
    previewOrigin: () => previewOrigin,
    allowedOrigins: [],
  });
  const server = http.createServer(app.handler);
  const preview = http.createServer(app.previewHandler);
  try {
    origin = `http://127.0.0.1:${await listen(server)}`;
    previewOrigin = `http://127.0.0.1:${await listen(preview)}`;

    const bootstrap = await (await fetch(`${origin}/api/bootstrap`)).json() as any;
    assert.equal(bootstrap.csrfToken, token);
    assert.deepEqual(bootstrap.projects, []);

    const cwd = { 'content-type': 'application/json', 'x-csrf-token': token };
    const rejected = await fetch(`${origin}/api/projects`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(rejected.status, 403);

    const title = '分块请求体中的中文标题';
    const chunked = await chunkedPost(origin, '/api/projects', JSON.stringify({ title, inputKind: 'title', sourceText: '', requirements: '' }), cwd);
    assert.equal(chunked.status, 201, chunked.text);
    const project = JSON.parse(chunked.text);
    assert.equal(project.title, title);

    const detail = await (await fetch(`${origin}/api/projects/${project.id}`)).json() as any;
    assert.equal(detail.project.id, project.id);
    assert.deepEqual(detail.runs, []);
    assert.deepEqual(detail.revisions, []);

    const revisionId = 'rev_test';
    const directory = path.join(dataRoot, 'projects', project.id, 'work', revisionId);
    const buildDir = path.join(dataRoot, 'builds', revisionId);
    const evidenceDir = path.join(dataRoot, 'evidence', revisionId);
    for (const folder of [directory, buildDir, evidenceDir]) fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(directory, 'game.json'), JSON.stringify({ title: 'fixture' }));
    fs.writeFileSync(path.join(directory, 'assets-manifest.json'), JSON.stringify({ assets: [{ id: 'bg', path: 'scene.png', source: { type: 'generated' } }] }));
    fs.writeFileSync(path.join(directory, 'assembly.json'), JSON.stringify({ mode: 'graybox' }));
    fs.writeFileSync(path.join(directory, 'check.json'), JSON.stringify({ valid: true }));
    fs.writeFileSync(path.join(buildDir, 'index.html'), '<!doctype html>');
    fs.writeFileSync(path.join(buildDir, 'manifest.json'), JSON.stringify({ files: [] }));
    fs.writeFileSync(path.join(evidenceDir, 'evidence.json'), JSON.stringify({ status: 'passed', screenshots: [{ path: 'start.png', label: 'start' }] }));
    const revision: Revision = {
      id: revisionId,
      projectId: project.id,
      runId: 'run_test',
      baseRevisionId: null,
      status: 'candidate',
      title: 'Fixture revision',
      summary: 'fixture',
      createdAt: new Date().toISOString(),
      directory,
      buildDir,
      evidenceDir,
    };
    app.service.store.put('revision', revision);

    const revisionDetail = await (await fetch(`${origin}/api/revisions/${revisionId}`)).json() as any;
    assert.equal(revisionDetail.revision.buildMode, 'graybox');
    assert.equal(revisionDetail.revision.directory, undefined);
    assert.equal(revisionDetail.revision.previewUrl, `${previewOrigin}/${revisionId}/`);
    assert.equal(revisionDetail.bundle.assets.assets[0].id, 'bg');
    assert.equal(revisionDetail.manifest.assets[0].url, `${origin}/api/revisions/${revisionId}/files/assets/scene.png`);
    assert.equal(revisionDetail.manifest.assets[0].mimeType, 'image/png');
    assert.equal(revisionDetail.evidence.screenshots[0].url, `${origin}/api/revisions/${revisionId}/files/evidence/start.png`);
    assert.equal(revisionDetail.previewUrl, `${previewOrigin}/${revisionId}/`);

    const workFile = await fetch(`${origin}/api/revisions/${revisionId}/files/work/check.json`);
    assert.equal(workFile.status, 200);
    const wrongCategory = await fetch(`${origin}/api/revisions/${revisionId}/files/other/check.json`);
    assert.equal(wrongCategory.status, 400);

    const exportRejected = await fetch(`${origin}/api/revisions/${revisionId}/export`);
    assert.equal(exportRejected.status, 400);
    assert.match((await exportRejected.json() as any).error, /只有通过验收的版本可以导出/);

    const previewPage = await fetch(`${previewOrigin}/${revisionId}/`);
    assert.equal(previewPage.status, 200);
    assert.match(previewPage.headers.get('content-security-policy') || '', /frame-ancestors/);
    assert.equal((await fetch(`${previewOrigin}/missing/`)).status, 404);
  } finally {
    await app.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await new Promise<void>(resolve => preview.close(() => resolve()));
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});
