import type { ProjectInput, Status } from './project.js';

export interface ConfirmedYamlOrigin {confirmationId:string;textProjectId:string;yamlVersionId:string;yamlHash:string;}

export interface Project extends ProjectInput {
  confirmedYaml?: ConfirmedYamlOrigin;
  id: string;
  status: string;
  currentRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Run {
  handoffId?: string;
  id: string;
  projectId: string;
  revisionId: string;
  mode: 'generate' | 'change';
  instruction: string;
  status: Status;
  stage: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId?: string;
  runId: string;
  stage: string;
  label: string;
  status: Status;
  attempt: number;
  inputHash?: string;
  outputHash?: string;
  error?: string;
  startedAt?: string;
  queuedAt?: string;
  queueDurationMs?: number;
  executionDurationMs?: number;
  completedAt?: string;
  skillHash?: string;
  order?: number;
  evidenceKind?: 'model' | 'host';
}

export interface Revision {
  id: string;
  projectId: string;
  runId: string;
  baseRevisionId: string | null;
  status: 'candidate' | 'accepted' | 'rejected';
  title: string;
  summary: string;
  createdAt: string;
  buildHash?: string;
  configHash?: string;
  directory: string;
  buildDir: string;
  evidenceDir: string;
  previewUrl?: string;
  sourceHash?: string;
  trustSignature?: string;
  acceptance?: {
    version: 2;
    fingerprint: string;
    buildHash: string;
    evidenceHash: string;
  };
}

export interface WorkEvent {
  id: number;
  projectId: string;
  runId?: string;
  createdAt: string;
  type: string;
  message: string;
  data?: unknown;
}
