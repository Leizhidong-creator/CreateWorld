import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../packages/orchestrator/store.js';
import { ToolRuntime } from '../packages/orchestrator/tool-runtime.js';
import type { Task } from '../packages/contracts/index.js';
import { ToolPreconditionError } from '../packages/contracts/index.js';

test('tool runtime records each call, serialises execution and trips a bounded breaker', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-tool-runtime-'));
  const store = new Store(root);
  try {
    store.put('run', { id: 'run', projectId: 'project', status: 'running' });
    let blocked = '';
    let active = 0;
    let maximumActive = 0;
    const runtime = new ToolRuntime({
      store,
      projectId: 'project',
      runId: 'run',
      signal: new AbortController().signal,
      event: () => {},
      check: () => {},
      blockedReason: () => blocked,
      setBlocked: message => (blocked = message),
      hasPendingAcceptance: () => false,
    });
    const tool = runtime.define('cw_build_test', '构建并执行真实操作。graybox用于试验。', { type: 'object' }, async () => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active--;
      return { passed: false, failures: [{ message: 'same failure' }] };
    });
    await tool.execute({ mode: 'formal' });
    await tool.execute({ mode: 'formal' });
    assert.equal(blocked, '');
    await tool.execute({ mode: 'formal' });
    assert.equal(maximumActive, 1);
    assert.equal(blocked, '同一问题重复三次未解决：same failure');
    const tasks = store.list<Task>('task', 'project');
    assert.equal(tasks.length, 3);
    assert.ok(tasks.every(task => task.status === 'failed' && task.stage === 'build_test'));
    assert.ok(tasks.every(task => task.label === '构建并执行真实操作 · formal'));
    await runtime.idle();
  } finally {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('tool runtime refuses work after final acceptance is pending', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-tool-runtime-'));
  const store = new Store(root);
  try {
    const runtime = new ToolRuntime({
      store,
      projectId: 'project',
      runId: 'run',
      signal: new AbortController().signal,
      event: () => {},
      check: () => {},
      blockedReason: () => '',
      setBlocked: () => {},
      hasPendingAcceptance: () => true,
    });
    const tool = runtime.define('cw_check', '检查当前内容。', { type: 'object' }, async () => ({ valid: true }));
    await assert.rejects(tool.execute({}), /最终候选已提交/);
    assert.equal(store.list('task', 'project').length, 0);
  } finally {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('asset repair failures stay local and reference reads do not wait behind production', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-tool-scheduling-'));
  const store = new Store(root);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const running = new Promise<void>(resolve => { started = resolve; });
  try {
    store.put('run', { id: 'run', projectId: 'project', status: 'running' });
    let blocked = '', read = false, nextStarted = false;
    const runtime = new ToolRuntime({ store, projectId: 'project', runId: 'run', signal: new AbortController().signal,
      event: () => {}, check: () => {}, blockedReason: () => blocked, setBlocked: message => { blocked = message; }, hasPendingAcceptance: () => false });
    const assets = runtime.define('cw_assets', '生产素材。', {}, async () => {
      started(); await gate;
      return { status: 'failed', failures: [{ assetId: 'one', message: 'resource needs geometry repair' }] };
    });
    const reference = runtime.define('cw_read_skill', '读取技能。', {}, async () => { read = true; return { instructions: 'reference' }; }, { readOnly: true });
    const check = runtime.define('cw_check', '检查。', {}, async () => { nextStarted = true; return { valid: true }; });
    const active = assets.execute({ ids: ['one'] }); await running;
    const waiting = check.execute({});
    await reference.execute({ id: 'scene-generation' });
    assert.equal(read, true); assert.equal(nextStarted, false);
    await new Promise(resolve => setTimeout(resolve, 25));
    release(); await active; await waiting;
    for (let i = 0; i < 3; i++) await assets.execute({ ids: ['one'] });
    assert.equal(blocked, ''); // assets have their own persistent, resource-scoped policy
    const tasks = store.list<Task>('task', 'project');
    const queued = tasks.find(task => task.stage === 'check')!;
    assert.ok(queued.queuedAt && queued.completedAt);
    assert.ok(queued.queueDurationMs! >= 20);
    assert.ok(queued.executionDurationMs! >= 0);
    await runtime.idle();
  } finally { release(); store.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('missing preparation gives recoverable feedback instead of tripping the execution breaker', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-tool-precondition-')), store = new Store(root);
  try {
    store.put('run', { id: 'run', projectId: 'project', status: 'running' });
    let blocked = '', prepared = false, executions = 0;
    const runtime = new ToolRuntime({ store, projectId: 'project', runId: 'run', signal: new AbortController().signal,
      event: () => {}, check: () => {}, blockedReason: () => blocked, setBlocked: reason => { blocked = reason; }, hasPendingAcceptance: () => false });
    const tool = runtime.define('cw_build_test', '构建。', {}, async () => {
      if (!prepared) throw new ToolPreconditionError('read and plan first');
      executions++; return { passed: true };
    });
    for (let i = 0; i < 4; i++) await assert.rejects(tool.execute({ mode: 'graybox' }), ToolPreconditionError);
    assert.equal(blocked, ''); assert.equal(executions, 0);
    prepared = true; await tool.execute({ mode: 'graybox' });
    assert.equal(executions, 1);
  } finally { store.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
