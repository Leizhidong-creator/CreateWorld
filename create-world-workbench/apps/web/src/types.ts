import type {
  ArtifactCategory,
  BootstrapPayload,
  Capabilities,
  Project,
  ProjectDetailPayload,
  ProjectInput,
  RevisionDetailPayload,
  RevisionSummary,
  Run,
  RunDetailPayload,
  Task,
  WorkEvent,
} from '../../../packages/contracts/api.js';

export type {
  ArtifactCategory,
  BootstrapPayload as Bootstrap,
  Capabilities,
  Project,
  ProjectDetailPayload as ProjectDetail,
  ProjectInput as NewProject,
  RevisionDetailPayload as RevisionDetail,
  RevisionSummary as Revision,
  Run,
  RunDetailPayload as RunDetail,
  Task,
  WorkEvent as RunEvent,
};

export type WorkspaceTab = 'production' | 'preview' | 'artifacts' | 'versions';
