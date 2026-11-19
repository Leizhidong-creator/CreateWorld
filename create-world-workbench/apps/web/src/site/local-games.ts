import type { Project, Revision } from '../types.js';

/** Prefer the current version, then accepted builds, then previewable candidates. */
export function playableRevision(project: Partial<Pick<Project, 'currentRevisionId'>>, revisions: Revision[]) {
  const available = revisions.filter(revision => revision.status !== 'rejected' && revision.previewUrl)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return available.find(revision => revision.id === project.currentRevisionId)
    || available.find(revision => revision.status === 'accepted')
    || available[0];
}

export const revisionLabel = (revision: Revision) => revision.status === 'accepted'
  ? '可试玩' : revision.buildMode === 'graybox' ? '基础原型 · 待验收' : '试玩版本 · 待验收';
