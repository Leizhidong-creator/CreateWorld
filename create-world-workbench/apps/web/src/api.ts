import { DEMO_MODE } from './demo/mode.js';
import { demoRequest } from './demo/local-api.js';
import type { Bootstrap, Project, ProjectDetail, RevisionDetail, Run, RunDetail } from './types.js';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = 'ApiError'; }
}

/**
 * The local workbench serves the API from the same origin.  A hosted build
 * (for example a Zion Web app) can point at a separately deployed workbench
 * server by setting VITE_API_BASE_URL at build time. Keeping this in the API
 * module avoids spreading deployment-specific URL logic through components.
 */
export const apiBaseUrl = ((import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  if (DEMO_MODE && /\/(?:export|files\/.*)$/.test(path)) return '/downloads/three-body-concept.png';
  if (!apiBaseUrl) return path;
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function request<T>(path: string, options: { body?: unknown; method?: 'POST' | 'PATCH' | 'DELETE'; csrfToken?: string; signal?: AbortSignal } = {}): Promise<T> {
  if (DEMO_MODE) return demoRequest<T>(path, options);
  const method = options.method || (options.body === undefined ? 'GET' : 'POST');
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-CSRF-Token'] = options.csrfToken ?? '';
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal, cache: 'no-store', credentials: apiBaseUrl ? 'include' : 'same-origin',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('无法连接本地工作台服务。请确认启动器仍在运行，然后重试。');
  }
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new ApiError(typeof payload?.error === 'string' ? payload.error : `请求未完成（${response.status}）`, response.status);
  }
  if (payload === null) throw new Error('服务返回了无法读取的数据，请刷新后重试。');
  return payload as T;
}

export const errorMessage = (error: unknown) => error instanceof Error ? error.message : '操作未完成，请重试。';
export const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

/** Only display URLs served by this local workbench or its separate local preview origin. */
export function localUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value, window.location.href);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    const allowedOrigins = new Set([window.location.origin]);
    if (apiBaseUrl) {
      try { allowedOrigins.add(new URL(apiBaseUrl, window.location.href).origin); } catch { /* invalid build-time value */ }
    }
    if (!allowedOrigins.has(url.origin) && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return undefined;
    return url.href;
  } catch { return undefined; }
}

export function previewUrl(value: unknown): string | undefined {
  const url = localUrl(value);
  if (DEMO_MODE && url && new URL(url).pathname === '/export-assets/three-body/play.html') return url;
  return url && new URL(url).origin !== window.location.origin ? url : undefined;
}

/** Normalise every accepted response shape once, at the transport boundary. */
export function projectListFrom(data: Project[] | { projects?: Project[] } | null | undefined): Project[] {
  const list = Array.isArray(data) ? data : data?.projects;
  return Array.isArray(list) ? [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
}

export function projectFrom(data: Project | { project: Project }): Project {
  return 'project' in data ? data.project : data;
}

export function runFrom(data: Run | { run: Run }): Run {
  return 'run' in data ? data.run : data;
}

export function projectDetailFrom(data: ProjectDetail): ProjectDetail {
  return {
    ...data,
    runs: Array.isArray(data.runs) ? [...data.runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [],
    revisions: Array.isArray(data.revisions) ? [...data.revisions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [],
  };
}

export function runDetailFrom(data: RunDetail): RunDetail {
  return {
    ...data,
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    events: Array.isArray(data.events) ? data.events : [],
  };
}

export function revisionDetailFrom(data: RevisionDetail): RevisionDetail {
  return { ...data, bundle: data.bundle ?? {}, evidence: data.evidence ?? null, manifest: data.manifest ?? {} };
}

export function bootstrapFrom(data: Bootstrap): Bootstrap {
  return { ...data, capabilities: data.capabilities || {}, projects: Array.isArray(data.projects) ? data.projects : [] };
}
