import { useCallback, useEffect, useRef, useState } from 'react';
import {
  apiUrl,
  bootstrapFrom,
  errorMessage,
  isAbort,
  projectDetailFrom,
  projectFrom,
  projectListFrom,
  request,
  revisionDetailFrom,
  runDetailFrom,
  runFrom,
} from '../api.js';
import type {
  Bootstrap,
  Capabilities,
  NewProject,
  Project,
  ProjectDetail,
  RevisionDetail,
  Run,
  RunDetail,
  WorkspaceTab,
} from '../types.js';
import { DEMO_MODE } from '../demo/mode.js';

interface Notice {
  message: string;
  error?: boolean;
}

/**
 * Owns workspace resources and their transitions. Components only render this
 * state and call actions; they never assemble request shapes or refresh arrays.
 */
export function useWorkspace(initialProjectId = '') {
  const [csrf, setCsrf] = useState('');
  const [capabilities, setCapabilities] = useState<Capabilities>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [booting, setBooting] = useState(true);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [startupError, setStartupError] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [detail, setDetail] = useState<ProjectDetail>();
  const [selectedRunId, setSelectedRunId] = useState('');
  const [runDetail, setRunDetail] = useState<RunDetail>();
  const [selectedRevisionId, setSelectedRevisionId] = useState('');
  const [revisionDetail, setRevisionDetail] = useState<RevisionDetail>();
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [projectLoading, setProjectLoading] = useState(false);
  const [tab, setTab] = useState<WorkspaceTab>('production');
  const [actionBusy, setActionBusy] = useState(false);
  const [connection, setConnection] = useState('connecting');
  const [refreshTick, setRefreshTick] = useState(0);
  const [serviceError, setServiceError] = useState('');
  const [notice, setNotice] = useState<Notice>();
  const newProjectCreated = useRef(false);
  const refresh = useCallback(() => setRefreshTick(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setBooting(true);
    setStartupError('');
    request<Bootstrap>('/api/bootstrap', { signal: controller.signal })
      .then(data => {
        const bootstrap = bootstrapFrom(data);
        setCsrf(bootstrap.csrfToken);
        setCapabilities(bootstrap.capabilities);
        const list = bootstrap.projects;
        setProjects(list);
        setSelectedProjectId(current => (list.some(project => project.id === current) ? current : list[0]?.id || ''));
        setBooting(false);
      })
      .catch(error => {
        if (!isAbort(error)) {
          setStartupError(errorMessage(error));
          setBooting(false);
        }
      });
    return () => controller.abort();
  }, [bootAttempt]);

  useEffect(() => {
    if (booting || !csrf) return;
    const controller = new AbortController();
    request<Project[] | { projects: Project[] }>('/api/projects', { signal: controller.signal })
      .then(data => setProjects(projectListFrom(data)))
      .catch(error => {
        if (!isAbort(error)) setServiceError(errorMessage(error));
      });
    return () => controller.abort();
  }, [refreshTick, booting, csrf]);

  useEffect(() => {
    if (!selectedProjectId || booting) return;
    const controller = new AbortController();
    setProjectLoading(previous => (detail?.project.id === selectedProjectId ? previous : true));
    request<ProjectDetail>(`/api/projects/${encodeURIComponent(selectedProjectId)}`, { signal: controller.signal })
      .then(data => {
        const normalized = projectDetailFrom(data);
        setDetail(normalized);
        setProjectLoading(false);
        setServiceError('');
        setProjects(current => {
          const updated = current.some(project => project.id === data.project.id)
            ? current.map(project => (project.id === data.project.id ? data.project : project))
            : [data.project, ...current];
          return updated.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        });
        setSelectedRunId(current => (normalized.runs.some(run => run.id === current) ? current : normalized.runs[0]?.id || ''));
        setSelectedRevisionId(current =>
          normalized.revisions.some(revision => revision.id === current)
            ? current
            : data.project.currentRevisionId || normalized.revisions[0]?.id || '',
        );
      })
      .catch(error => {
        if (!isAbort(error)) {
          setServiceError(errorMessage(error));
          setProjectLoading(false);
        }
      });
    return () => controller.abort();
  }, [selectedProjectId, refreshTick, booting]);

  useEffect(() => {
    if (!selectedRunId) {
      setRunDetail(undefined);
      return;
    }
    const controller = new AbortController();
    request<RunDetail>(`/api/runs/${encodeURIComponent(selectedRunId)}`, { signal: controller.signal })
      .then(data => setRunDetail(runDetailFrom(data)))
      .catch(error => {
        if (!isAbort(error)) setServiceError(errorMessage(error));
      });
    return () => controller.abort();
  }, [selectedRunId, refreshTick]);

  useEffect(() => {
    if (!selectedRevisionId) {
      setRevisionDetail(undefined);
      return;
    }
    const controller = new AbortController();
    setRevisionLoading(true);
    request<RevisionDetail>(`/api/revisions/${encodeURIComponent(selectedRevisionId)}`, { signal: controller.signal })
      .then(data => {
        setRevisionDetail(revisionDetailFrom(data));
        setRevisionLoading(false);
      })
      .catch(error => {
        if (!isAbort(error)) {
          setServiceError(errorMessage(error));
          setRevisionLoading(false);
        }
      });
    return () => controller.abort();
  }, [selectedRevisionId, refreshTick]);

  useEffect(() => {
    if (!selectedProjectId || booting) return;
    if (DEMO_MODE) { setConnection('live'); return; }
    let pending: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (!pending) {
        pending = setTimeout(() => {
          pending = undefined;
          refresh();
        }, 250);
      }
    };
    let source: EventSource | undefined;
    setConnection('connecting');
    try {
      source = new EventSource(apiUrl(`/api/projects/${encodeURIComponent(selectedProjectId)}/events`), { withCredentials: true });
      source.onopen = () => setConnection('live');
      source.addEventListener('update', schedule);
      source.onerror = () => setConnection('polling');
    } catch {
      setConnection('polling');
    }
    // Occasional reconciliation also recovers updates missed across a disconnected stream.
    const poll = setInterval(() => {
      if (document.visibilityState !== 'hidden') refresh();
    }, 7000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      source?.close();
      clearInterval(poll);
      if (pending) clearTimeout(pending);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [selectedProjectId, booting, refresh]);

  useEffect(() => {
    if (!notice || notice.error) return;
    const timeout = setTimeout(() => setNotice(undefined), 6000);
    return () => clearTimeout(timeout);
  }, [notice]);

  async function manualRefresh() {
    try {
      const data = bootstrapFrom(await request<Bootstrap>('/api/bootstrap'));
      setCsrf(data.csrfToken);
      setCapabilities(data.capabilities);
      setProjects(data.projects);
      setServiceError('');
      refresh();
    } catch (error) {
      setServiceError(errorMessage(error));
    }
  }

  function selectProject(id: string) {
    if (id !== selectedProjectId) {
      setDetail(undefined);
      setRunDetail(undefined);
      setRevisionDetail(undefined);
      setSelectedRunId('');
      setSelectedRevisionId('');
      setServiceError('');
      setSelectedProjectId(id);
      setTab('production');
      const url = new URL(window.location.href);
      url.searchParams.delete('project');
      url.hash = `/studio/${encodeURIComponent(id)}`;
      window.history.replaceState(null, '', url);
    }
  }

  function selectRun(id: string) {
    setRunDetail(undefined);
    setSelectedRunId(id);
  }

  function selectRevision(id: string) {
    if (id !== selectedRevisionId) {
      setRevisionDetail(undefined);
      setSelectedRevisionId(id);
    }
  }

  async function createProject(value: NewProject) {
    const project = projectFrom(await request<Project | { project: Project }>('/api/projects', { body: value, csrfToken: csrf }));
    newProjectCreated.current = true;
    setProjects(current => [project, ...current.filter(item => item.id !== project.id)]);
    selectProject(project.id);
    if (DEMO_MODE) {
      // 演示态：不创建真实制作任务，避免消耗模型额度。
      setTab('production');
      refresh();
      setNotice({ message: '演示项目已创建，正在播放制作流程。' });
      return;
    }
    try {
      const run = runFrom(
        await request<Run | { run: Run }>(`/api/projects/${encodeURIComponent(project.id)}/runs`, {
          body: { mode: 'generate' },
          csrfToken: csrf,
        }),
      );
      setSelectedRunId(run.id);
      setTab('production');
      refresh();
      setNotice({ message: '项目已创建，自动制作已开始。' });
    } catch (error) {
      // The project already exists: don't keep the create form open and risk creating a duplicate.
      setNotice({ message: `项目已保存，但制作未启动：${errorMessage(error)}`, error: true });
      refresh();
    }
  }

  async function deleteProject(id: string) {
    const target = projects.find(item => item.id === id);
    await request<{ id: string; title: string }>(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      csrfToken: csrf,
    });
    setProjects(current => current.filter(item => item.id !== id));
    if (selectedProjectId === id) {
      setSelectedProjectId('');
      setDetail(undefined);
      setRunDetail(undefined);
      setRevisionDetail(undefined);
      setSelectedRunId('');
      setSelectedRevisionId('');
      window.history.replaceState(null, '', '#/studio');
    }
    setNotice({ message: `已删除项目「${target?.title || id}」` });
  }

  async function startRun(mode: 'generate' | 'change', instruction?: string) {
    if (!selectedProjectId) return;
    const run = runFrom(
      await request<Run | { run: Run }>(`/api/projects/${encodeURIComponent(selectedProjectId)}/runs`, {
        body: { mode, ...(instruction ? { instruction } : {}) },
        csrfToken: csrf,
      }),
    );
    setSelectedRunId(run.id);
    setRunDetail(undefined);
    setTab('production');
    refresh();
    setNotice({ message: mode === 'change' ? '修改任务已提交，当前版本仍可试玩。' : '自动制作已开始。' });
  }

  async function mutate(operation: () => Promise<void>) {
    setActionBusy(true);
    try {
      await operation();
    } catch (error) {
      setNotice({ message: errorMessage(error), error: true });
    } finally {
      setActionBusy(false);
    }
  }

  async function controlRun(id: string, action: 'cancel' | 'resume') {
    await request(`/api/runs/${encodeURIComponent(id)}/${action}`, { body: {}, csrfToken: csrf });
    refresh();
    setNotice({ message: action === 'cancel' ? '已发送停止请求。已有产物会保留。' : '已恢复执行，将复用仍然有效的产物。' });
  }

  async function updateSource(value: { sourceText: string; requirements: string }, resume: boolean) {
    await request(`/api/projects/${encodeURIComponent(selectedProjectId)}`, { body: value, method: 'PATCH', csrfToken: csrf });
    refresh();
    if (resume && selectedRunId) {
      try {
        await controlRun(selectedRunId, 'resume');
      } catch (error) {
        setNotice({ message: `材料已保存，但任务未恢复：${errorMessage(error)}`, error: true });
        return;
      }
    }
    setNotice({ message: resume ? '材料已保存，已继续制作并重新检查受影响部分。' : '材料已保存。下次执行将使用更新后的材料。' });
  }

  async function rollbackTo(revisionId: string) {
    if (!selectedProjectId) return;
    await request(`/api/projects/${encodeURIComponent(selectedProjectId)}/rollback`, { body: { revisionId }, csrfToken: csrf });
    setSelectedRevisionId(revisionId);
    refresh();
    setNotice({ message: '已切换到所选版本，其他版本记录仍然保留。' });
  }

  return {
    csrf,
    capabilities,
    projects,
    booting,
    startupError,
    selectedProjectId,
    detail,
    selectedRunId,
    runDetail,
    selectedRevisionId,
    revisionDetail,
    revisionLoading,
    projectLoading,
    tab,
    actionBusy,
    connection,
    serviceError,
    notice,
    newProjectCreated,
    setNotice,
    setTab,
    refresh,
    retryBoot: () => setBootAttempt(value => value + 1),
    manualRefresh,
    selectProject,
    selectRun,
    selectRevision,
    createProject,
    deleteProject,
    startRun,
    mutate,
    controlRun,
    updateSource,
    rollbackTo,
  };
}

export type WorkspaceController = ReturnType<typeof useWorkspace>;
