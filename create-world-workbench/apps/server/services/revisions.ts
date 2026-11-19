import fs from 'node:fs';
import path from 'node:path';
import type {
  RevisionDetailPayload,
  RevisionManifest,
  RevisionSummary,
} from '../../../packages/contracts/index.js';
import type { Revision } from '../../../packages/contracts/index.js';
import { readJson, safePath } from '../../../packages/shared/files.js';
import {
  ARTIFACT_CATEGORY,
  BUILD_FILE,
  REVISION_BUNDLE_FILE,
  WORKSPACE_FILE,
  WORK_ARTIFACT_PATTERN,
  workspaceFile,
} from '../../../packages/orchestrator/workspace-layout.js';
import { MIME } from '../http.js';

const load = (folder: string, name: string): any => {
  try {
    return readJson(path.join(folder, name));
  } catch {
    return null;
  }
};

/** Host-side revision projections. No physical workspace path is serialised. */
export class RevisionQueryService {
  constructor(
    private readonly origin: () => string,
    private readonly previewOrigin: () => string,
  ) {}

  summary(revision: Revision): RevisionSummary {
    let buildMode: string | undefined;
    try {
      buildMode = readJson(workspaceFile(revision.directory, WORKSPACE_FILE.assembly)).mode;
    } catch {
      /* an older candidate may not have an assembly record yet */
    }
    return {
      id: revision.id,
      projectId: revision.projectId,
      runId: revision.runId,
      baseRevisionId: revision.baseRevisionId,
      status: revision.status,
      buildMode,
      title: revision.title,
      summary: revision.summary,
      createdAt: revision.createdAt,
      buildHash: revision.buildHash,
      configHash: revision.configHash,
      previewUrl: fs.existsSync(path.join(revision.buildDir, BUILD_FILE.index)) ? this.previewOrigin() + '/' + revision.id + '/' : null,
    };
  }

  detail(revision: Revision): RevisionDetailPayload {
    const evidence = load(revision.evidenceDir, BUILD_FILE.evidence);
    if (evidence) {
      evidence.screenshots = (evidence.screenshots || []).map((screenshot: any) => ({
        ...screenshot,
        url: this.origin() + '/api/revisions/' + revision.id + '/files/evidence/' + screenshot.path,
      }));
    }
    const assets = load(revision.directory, WORKSPACE_FILE.assetsManifest);
    const builtManifest = load(revision.buildDir, BUILD_FILE.manifest) || {};
    const manifest: RevisionManifest = {
      ...builtManifest,
      assets: (assets?.assets || []).map((asset: any) => ({
        ...asset,
        url: this.origin() + '/api/revisions/' + revision.id + '/files/assets/' + asset.path,
        mimeType: MIME[path.extname(asset.path)] || 'application/octet-stream',
        provenance: asset.source || 'native generation',
      })),
    };
    const summary = this.summary(revision);
    return {
      revision: summary,
      bundle: {
        source: load(revision.directory, REVISION_BUNDLE_FILE.source),
        design: load(revision.directory, REVISION_BUNDLE_FILE.design),
        game: load(revision.directory, REVISION_BUNDLE_FILE.game),
        assets,
        review: load(revision.directory, REVISION_BUNDLE_FILE.review),
        slice: load(revision.directory, REVISION_BUNDLE_FILE.slice),
        scope: load(revision.directory, REVISION_BUNDLE_FILE.scope),
      },
      evidence,
      manifest,
      previewUrl: summary.previewUrl,
      changes: load(revision.directory, WORKSPACE_FILE.change),
    };
  }

  artifactFile(revision: Revision, category: string, relative: string): string {
    const folder =
      category === ARTIFACT_CATEGORY.evidence
        ? revision.evidenceDir
        : category === ARTIFACT_CATEGORY.assets
          ? path.join(revision.directory, 'assets')
          : category === ARTIFACT_CATEGORY.work
            ? revision.directory
            : undefined;
    if (!folder) throw new Error('无效产物类别');
    if (category === ARTIFACT_CATEGORY.work && !WORK_ARTIFACT_PATTERN.test(relative)) throw new Error('只允许读取阶段JSON');
    return safePath(folder, relative);
  }
}
