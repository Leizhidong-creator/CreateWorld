import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export interface SkillCatalogEntry { id: string; entry: string; description: string; revision: string; }

/** Capability summaries have one authoring source: the skill's front matter. */
export function skillDescription(markdown: string): string {
  const front = markdown.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const description = front ? parse(front[1])?.description : undefined;
  if (typeof description !== 'string' || !description.trim()) throw Error('Skill front matter requires a non-empty description');
  return description.trim();
}

export function loadSkillCatalog(skillsDir: string): SkillCatalogEntry[] {
  const manifest = JSON.parse(fs.readFileSync(path.join(skillsDir, 'manifest.json'), 'utf8'));
  return manifest.skills.map((skill: any) => ({
    id: skill.id, entry: path.join(skillsDir, skill.entry),
    description: skill.description || skillDescription(fs.readFileSync(path.join(skillsDir, skill.entry), 'utf8')),
    revision: skill.productionRevision || skill.treeSha256 || skill.sha256,
  }));
}
