import type {
  Project,
  ProjectDetailPayload,
  Run,
  RunDetailPayload,
  Revision,
  Task,
} from '../../../packages/contracts/index.js';
import type { Workbench } from '../../../packages/orchestrator/service.js';
import type { RevisionQueryService } from './revisions.js';

/** Read-side application service used by HTTP and future entry points. */
export class ProjectQueryService {
  constructor(
    private readonly workbench: Workbench,
    private readonly revisions: RevisionQueryService,
  ) {}

  list(): Project[] {
    return this.workbench.store.list<Project>('project');
  }

  detail(projectId: string): ProjectDetailPayload {
    const project = this.workbench.project(projectId);
    return {
      project,
      runs: this.workbench.store.list<Run>('run', project.id),
      revisions: this.workbench.store.list<Revision>('revision', project.id).map(revision => this.revisions.summary(revision)),
    };
  }

  runDetail(runId: string): RunDetailPayload {
    const run = this.workbench.run(runId);
    return {
      run,
      tasks: this.workbench.store.list<Task>('task', run.projectId).filter(task => task.runId === run.id),
      events: this.workbench.store.events(run.projectId, run.id),
    };
  }
}
