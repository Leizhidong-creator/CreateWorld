import type { Project, Revision, Run, Task, WorkEvent } from './records.js';

export type { Project, Revision, Run, Task, WorkEvent } from './records.js';
export type { ProjectInput, ProjectScope } from './project.js';

/** Transport projection of a revision: physical workspaces never leave the host. */
export interface RevisionSummary {
  id: string;
  projectId: string;
  runId: string;
  baseRevisionId: string | null;
  status: Revision['status'];
  buildMode?: string;
  title: string;
  summary: string;
  createdAt: string;
  buildHash?: string;
  configHash?: string;
  previewUrl: string | null;
}

export interface RevisionBundle {
  source: unknown;
  design: unknown;
  game: unknown;
  assets: unknown;
  review: unknown;
  slice: unknown;
  scope: unknown;
}

export interface RevisionManifest {
  [key: string]: unknown;
  assets?: Array<Record<string, unknown> & { path: string; url: string; mimeType: string; provenance: string }>;
}

export interface ProjectDetailPayload {
  project: Project;
  runs: Run[];
  revisions: RevisionSummary[];
}

export interface RunDetailPayload {
  run: Run;
  tasks: Task[];
  events: WorkEvent[];
}

export interface RevisionDetailPayload {
  revision: RevisionSummary;
  bundle: RevisionBundle;
  evidence: unknown;
  manifest: RevisionManifest;
  previewUrl: string | null;
  changes: unknown;
}

export interface Capabilities {
  codex?: { available?: boolean; version?: string; error?: string; [key: string]: unknown };
  browser?: { available?: boolean; kind?: string; supported?: string[]; touch?: string; [key: string]: unknown };
  image?: { status?: string; [key: string]: unknown };
  storage?: { available?: boolean; [key: string]: unknown };
  [key: string]: unknown;
}

export interface BootstrapPayload {
  csrfToken: string;
  version: string;
  capabilities: Capabilities;
  projects: Project[];
}

export type ArtifactCategory = 'evidence' | 'assets' | 'work';
