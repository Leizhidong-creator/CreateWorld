import path from 'node:path';

/**
 * Every host-owned workspace artifact is declared here once. Initialisation,
 * candidate hashing, model protection, API projection and export all derive
 * from this contract instead of repeating literal filenames.
 */
export const WORKSPACE_FILE = {
  project: 'project.json',
  source: 'source.json',
  design: 'design.json',
  game: 'game.json',
  gameProject: 'game.project.json',
  journeys: 'journeys.json',
  assetsPlan: 'assets-plan.json',
  assetsManifest: 'assets-manifest.json',
  assetPatch: 'asset-config-patch.json',
  scope: 'scope.json',
  slice: 'slice.json',
  assembly: 'assembly.json',
  review: 'review.json',
  work: 'work.json',
  change: 'change.json',
  agents: 'AGENTS.md',
} as const;

export const SOURCE_FILE = {
  sourceText: 'sources/source.txt',
  contentYaml: 'sources/game-content.yaml',
  contentIndex: 'sources/content-index.json',
  sceneSliceYaml: 'sources/scene-slice.yaml',
  sceneSliceBrief: 'sources/scene-slice.md',
} as const;

export const CONTENT_SPEC_DIR = 'content-spec';
export const REVIEW_FILE = WORKSPACE_FILE.review;

/** Order is part of the candidate fingerprint; append new inputs at the end. */
export const CANDIDATE_FILE_ORDER = [
  WORKSPACE_FILE.project,
  WORKSPACE_FILE.source,
  WORKSPACE_FILE.design,
  WORKSPACE_FILE.game,
  WORKSPACE_FILE.gameProject,
  WORKSPACE_FILE.journeys,
  WORKSPACE_FILE.assetsPlan,
  WORKSPACE_FILE.assetsManifest,
  WORKSPACE_FILE.assetPatch,
  WORKSPACE_FILE.scope,
  WORKSPACE_FILE.slice,
] as const;

/** Order is part of the candidate fingerprint. */
export const CANDIDATE_TREES = ['sources', 'parts', 'assets', 'extensions'] as const;

/** Host inputs the production model must not modify. */
export const PROTECTED_MODEL_INPUTS = [
  'sources',
  WORKSPACE_FILE.project,
  WORKSPACE_FILE.agents,
  WORKSPACE_FILE.slice,
  WORKSPACE_FILE.scope,
  CONTENT_SPEC_DIR,
] as const;

/** Inputs an independent reviewer may read but never rewrite. */
export const REVIEW_PROTECTED_INPUTS = [
  WORKSPACE_FILE.source,
  WORKSPACE_FILE.design,
  WORKSPACE_FILE.game,
  WORKSPACE_FILE.gameProject,
  'parts',
  WORKSPACE_FILE.journeys,
  'assets',
  'extensions',
  WORKSPACE_FILE.assetsManifest,
  WORKSPACE_FILE.slice,
  WORKSPACE_FILE.scope,
  'sources',
] as const;

export const HOST_RECORD_FILE = {
  build: 'build.json',
  review: 'review.json',
  session: 'session.json',
  check: 'check.json',
  skillPlan: 'skill-plan.json',
} as const;

export const BUILD_FILE = {
  manifest: 'manifest.json',
  evidence: 'evidence.json',
  index: 'index.html',
} as const;

export const REVISION_BUNDLE_FILE = {
  source: WORKSPACE_FILE.source,
  design: WORKSPACE_FILE.design,
  game: WORKSPACE_FILE.game,
  assets: WORKSPACE_FILE.assetsManifest,
  review: WORKSPACE_FILE.review,
  slice: WORKSPACE_FILE.slice,
  scope: WORKSPACE_FILE.scope,
} as const;

export const ARTIFACT_CATEGORY = {
  evidence: 'evidence',
  assets: 'assets',
  work: 'work',
} as const;

export type ArtifactCategory = (typeof ARTIFACT_CATEGORY)[keyof typeof ARTIFACT_CATEGORY];
export const WORK_ARTIFACT_PATTERN = /^[\w-]+\.json$/;

export interface RevisionPaths {
  workspace: string;
  build: string;
  evidence: string;
  record: string;
  graybox: string;
}

export function revisionPaths(dataRoot: string, projectId: string, revisionId: string): RevisionPaths {
  return {
    workspace: path.join(dataRoot, 'projects', projectId, 'work', revisionId),
    build: path.join(dataRoot, 'builds', revisionId),
    evidence: path.join(dataRoot, 'evidence', revisionId),
    record: path.join(dataRoot, 'autonomous', revisionId),
    graybox: path.join(dataRoot, 'graybox', revisionId),
  };
}

export function workspaceFile(workspace: string, file: string): string {
  return path.join(workspace, file);
}

export function exportFile(dataRoot: string, revisionId: string): string {
  return path.join(dataRoot, 'exports', revisionId + '.zip');
}
