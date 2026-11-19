import { BlockedError, ToolPreconditionError, type Run, type Task } from '../contracts/index.js';
import type { HostTool } from '../codex-adapter/index.js';
import { now, uid } from '../shared/files.js';
import type { Store } from './store.js';
import { PRODUCTION_POLICY } from './production-policy.js';

export interface ToolRuntimeOptions {
  store: Store;
  projectId: string;
  runId: string;
  signal: AbortSignal;
  event: (type: string, message: string, data?: any) => void;
  /** Throws CancelledError when the run or signal is no longer active. */
  check: () => void;
  blockedReason: () => string;
  setBlocked: (message: string) => void;
  hasPendingAcceptance: () => boolean;
}

/**
 * Mutating tools share one serial lane. Explicitly read-only reference tools
 * can return while production runs; validation and publication stay ordered.
 */
export class ToolRuntime {
  private sequence: Promise<any> = Promise.resolve();
  private readonly readers = new Set<Promise<any>>();
  private readonly failures = new Map<string, number>();

  constructor(private readonly options: ToolRuntimeOptions) {}

  idle(): Promise<void> {
    return Promise.all([this.sequence, ...this.readers]).then(() => undefined);
  }

  define(name: string, description: string, schema: any, execute: (args: any) => Promise<any>, scheduling: { readOnly?: boolean } = {}): HostTool {
    return {
      name,
      description,
      schema,
      execute: (args: any) => {
        const queuedAt = now(), queuedTime = performance.now();
        const run = async () => {
          const executionTime = performance.now();
          const { store, runId, projectId, signal, event, check, blockedReason, setBlocked, hasPendingAcceptance } = this.options;
          check();
          const blocked = blockedReason();
          if (blocked) throw new BlockedError(blocked);
          if (hasPendingAcceptance()) throw Error('最终候选已提交，请结束本回合；宿主将在回合结束后复核并接受。');
          const task: Task = {
            id: uid('task'),
            projectId,
            runId,
            stage: name.replace('cw_', ''),
            label:
              description.split('。')[0] +
              (name === 'cw_read_skill'
                ? ' · ' + args.id
                : name === 'cw_assets'
                  ? ' · ' + args.ids.join('、')
                  : name === 'cw_build_test'
                    ? ' · ' + args.mode
                    : ''),
            status: 'running',
            attempt: 1,
            startedAt: now(),
            queuedAt,
            queueDurationMs: Math.round(executionTime - queuedTime),
            evidenceKind: 'host',
          };
          store.put('task', task);
          store.patch<Run>('run', runId, { stage: task.stage, updatedAt: now() });
          event('tool', task.label, { name });
          try {
            const result = await execute(args);
            check();
            for (const failure of result?.failures || []) {
              // Assets own durable per-resource repair budgets. Do not also
              // turn one blocked resource into a session-wide failure breaker.
              if (name === 'cw_assets') continue;
              this.recordFailure(name + ':' + failure.assetId + ':' + failure.message, failure.message, setBlocked);
            }
            store.patch<Task>('task', task.id, {
              status: result?.valid === false || result?.passed === false || result?.status === 'failed' ? 'failed' : 'passed',
              error: result?.failures?.map((failure: any) => failure.message).join('; ') || result?.errors?.join('; ') || undefined,
              completedAt: now(),
              executionDurationMs: Math.round(performance.now() - executionTime),
            });
            return { text: JSON.stringify(result) };
          } catch (error) {
            store.patch<Task>('task', task.id, {
              status: signal.aborted ? 'cancelled' : 'failed',
              error: String(error),
              completedAt: now(),
              executionDurationMs: Math.round(performance.now() - executionTime),
            });
            if (name !== 'cw_assets' && !(error instanceof ToolPreconditionError)) this.recordFailure(name + ':' + String(error), String(error), setBlocked);
            event('tool-error', String(error), { name });
            throw error;
          }
        };
        const job = scheduling.readOnly ? run() : this.sequence.then(run);
        if (scheduling.readOnly) {
          this.readers.add(job);
          const done = () => { this.readers.delete(job); };
          void job.then(done, done);
        } else this.sequence = job.catch(() => {});
        return job;
      },
    };
  }

  private recordFailure(key: string, message: string, setBlocked: (message: string) => void): void {
    const count = (this.failures.get(key) || 0) + 1;
    this.failures.set(key, count);
    if (count >= PRODUCTION_POLICY.tools.repeatedFailureLimit) setBlocked('同一问题重复三次未解决：' + message);
  }
}
