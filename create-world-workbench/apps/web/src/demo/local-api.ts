import type { NewProject, Project, ProjectDetail, Revision, Run } from '../types.js';

const KEY = 'cw.frontend-projects.v1';
const PREVIEW = '/export-assets/three-body/play.html';
let fallback: ProjectDetail[] = [];
function read(): ProjectDetail[] {
  try { const value = JSON.parse(localStorage.getItem(KEY) || 'null'); return Array.isArray(value) ? value : fallback; }
  catch { return fallback; }
}
function save(rows: ProjectDetail[]) {
  fallback = rows;
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* Session remains usable when storage is full. */ }
}
function version(detail: ProjectDetail, instruction = ''): Run {
  const now = new Date().toISOString();
  const run: Run = { id: crypto.randomUUID(), projectId: detail.project.id, revisionId: crypto.randomUUID(), mode: instruction ? 'change' : 'generate', instruction, status: 'passed', stage: 'completed', createdAt: now, updatedAt: now };
  const revision: Revision = { id: run.revisionId, projectId: detail.project.id, runId: run.id, baseRevisionId: detail.project.currentRevisionId, status: 'accepted', title: `版本 ${detail.revisions.length + 1}`, summary: instruction || '初始版本', createdAt: now, previewUrl: PREVIEW };
  detail.runs.unshift(run);
  detail.revisions.unshift(revision);
  detail.project.currentRevisionId = revision.id;
  detail.project.status = 'completed';
  detail.project.updatedAt = now;
  return run;
}

/** Browser-only prototype transport. Never falls through to a network request. */
export async function demoRequest<T>(path: string, options: { body?: unknown; method?: string; signal?: AbortSignal } = {}): Promise<T> {
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const rows = read();
  const parts = path.split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  const method = options.method || (options.body === undefined ? 'GET' : 'POST');
  const body = (options.body || {}) as Record<string, unknown>;
  let result: unknown;
  if (parts[1] === 'bootstrap') result = { csrfToken: 'browser-demo', version: 'demo', capabilities: { storage: { available: true } }, projects: rows.map(row => row.project) };
  else if (parts[1] === 'projects') {
    if (!parts[2]) {
      if (method === 'POST') {
        const now = new Date().toISOString();
        const project: Project = { ...(body as unknown as NewProject), id: crypto.randomUUID(), status: 'completed', currentRevisionId: null, createdAt: now, updatedAt: now };
        const detail: ProjectDetail = { project, runs: [], revisions: [] };
        version(detail);
        rows.unshift(detail);
        result = project;
      } else result = rows.map(row => row.project);
    } else {
      const detail = rows.find(row => row.project.id === parts[2]);
      if (!detail) throw new Error('未找到这个项目，请从“我的项目”选择。');
      if (method === 'DELETE') { rows.splice(rows.indexOf(detail), 1); result = detail.project; }
      else if (parts[3] === 'runs') result = version(detail, String(body.instruction || ''));
      else if (parts[3] === 'rollback') { detail.project.currentRevisionId = String(body.revisionId); result = detail.project; }
      else if (method === 'PATCH') { Object.assign(detail.project, body, { updatedAt: new Date().toISOString() }); result = detail.project; }
      else result = detail;
    }
  } else if (parts[1] === 'runs') {
    const run = rows.flatMap(row => row.runs).find(item => item.id === parts[2]);
    if (!run) throw new Error('未找到制作记录。');
    if (parts[3]) run.status = parts[3] === 'cancel' ? 'cancelled' : 'passed';
    result = { run, tasks: [], events: [] };
  } else if (parts[1] === 'revisions') {
    const revision = rows.flatMap(row => row.revisions).find(item => item.id === parts[2]);
    result = { revision, previewUrl: PREVIEW, bundle: {}, evidence: {}, manifest: {}, changes: [] };
  } else if (parts[1] === 'builtin-games') result = { previewUrl: parts[2] === 'walls' ? '/local-games/walls/index.html' : PREVIEW };
  else throw new Error(`Unknown demo route: ${path}`);
  if (method !== 'GET') save(rows);
  return structuredClone(result) as T;
}
