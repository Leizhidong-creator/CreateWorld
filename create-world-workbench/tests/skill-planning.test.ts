import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SkillPlanning, type SkillDecision } from '../packages/orchestrator/skill-planning.js';
import { loadSkillCatalog, skillDescription } from '../packages/skill-adapters/catalog.js';
import { ToolPreconditionError } from '../packages/contracts/index.js';
import { candidateHash } from '../packages/orchestrator/candidate.js';

const catalog = ['story', 'art', 'assembly', 'review', 'optional'].map(id => ({ id, entry: id + '/SKILL.md', description: id + ' capability', revision: id + '-v1' }));
const decision = (id: string, stages: SkillDecision['stages'], skill: string, extra: Partial<SkillDecision> = {}): SkillDecision => ({
  id, requirement: id + ' requirement', stages, consideredSkills: [skill], selectedSkills: [skill], strategy: 'reuse', reason: 'Existing capability covers this requirement', ...extra,
});
function temporary(t: any) { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-skill-plan-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; }

test('production is blocked before read-and-plan evidence, without invoking the expensive operation', async t => {
  const root = temporary(t), planning = new SkillPlanning(path.join(root, 'host'), () => catalog, 'request1');
  let imageRequests = 0;
  const assets = planning.guard('cw_assets', async () => { imageRequests++; return 'produced'; });
  await assert.rejects(assets({ ids: ['hero'] }), ToolPreconditionError);
  const story = decision('story', ['content'], 'story'), art = decision('hero', ['assets'], 'art', { targetIds: ['hero'] });
  assert.throws(() => planning.update({ decisions: [story, art] }), /先实际读取/);
  assert.equal(planning.view().decisions.length, 0);
  // A workspace self-report cannot create host read or decision evidence.
  fs.writeFileSync(path.join(root, 'work.json'), JSON.stringify({ skillPlan: { decisions: [story, art], readSkills: ['story', 'art'] } }));
  await assert.rejects(assets({ ids: ['hero'] }), ToolPreconditionError);
  planning.recordRead('story'); planning.recordRead('art');
  planning.update({ decisions: [story, art] });
  assert.equal(await assets({ ids: ['hero'] }), 'produced');
  assert.equal(imageRequests, 1);
  await assert.rejects(assets({ ids: ['unplanned-background'] }), /unplanned-background/);
  assert.equal(imageRequests, 1);
  assert.deepEqual(planning.view().readSkills, ['story', 'art']); // no forced all-skills read
  planning.assertToolReady('cw_check'); // inspection remains available before production
});

test('extending or replacing a capability requires a read candidate and an explicit gap', t => {
  const root = temporary(t), planning = new SkillPlanning(root, () => catalog, 'request1');
  planning.recordRead('assembly');
  assert.throws(() => planning.update({ decisions: [decision('custom', ['build'], 'assembly', { strategy: 'extend' })] }), /具体缺口/);
  assert.throws(() => planning.update({ decisions: [decision('custom', ['build'], 'assembly', { strategy: 'custom', selectedSkills: [] })] }), /具体缺口/);
  planning.update({ decisions: [decision('custom', ['build'], 'assembly', { strategy: 'custom', selectedSkills: [], gap: 'Existing assembly has no story-specific vehicle mechanic' })] });
  assert.equal(planning.view().decisions[0].strategy, 'custom');
  assert.throws(() => planning.recordRead('missing'), /未知技能/);
  const empty = new SkillPlanning(path.join(root, 'empty'), () => [], 'request1');
  empty.update({ decisions: [decision('empty', ['content', 'build'], '', { consideredSkills: [], selectedSkills: [], strategy: 'custom', gap: 'No skills are installed' })] });
  empty.assertToolReady('cw_build_test');
});

test('plans survive restart, local changes reuse unaffected decisions, and only changed skills become stale', t => {
  const root = temporary(t); let entries = structuredClone(catalog);
  const source = () => entries;
  let planning = new SkillPlanning(root, source, 'request1');
  for (const id of ['story', 'art', 'assembly', 'review']) planning.recordRead(id);
  const decisions = [decision('story', ['content'], 'story'), decision('art', ['assets'], 'art'), decision('build', ['build'], 'assembly'), decision('review', ['review'], 'review')];
  planning.update({ decisions });
  planning = new SkillPlanning(root, source, 'request1');
  planning.assertToolReady('cw_finish');
  entries.find(s => s.id === 'art')!.revision = 'art-v2';
  planning.assertToolReady('cw_build_test');
  assert.throws(() => planning.assertToolReady('cw_assets', ['hero']), /适配判断/);
  assert.throws(() => planning.update({ unchanged: ['art'] }), /先实际读取/);
  planning.recordRead('art'); planning.update({ decisions: [decisions[1]] });
  planning.assertToolReady('cw_assets', ['hero']);
  // A new request must be assessed, but unchanged skill bodies need not be read again.
  const changed = new SkillPlanning(path.join(root, 'next-revision'), source, 'request2', root);
  assert.throws(() => changed.assertToolReady('cw_build_test'), /适配判断/);
  changed.update({ unchanged: ['story', 'build', 'review'] });
  changed.assertToolReady('cw_build_test');
  assert.throws(() => changed.assertToolReady('cw_assets', ['hero']), /适配判断/);
  changed.update({ decisions: [decision('art', ['assets'], 'art', { requirement: 'Only the coat color changed' })] });
  changed.assertToolReady('cw_assets', ['hero']);
  assert.deepEqual(changed.view().readSkills.sort(), ['art', 'assembly', 'review', 'story']);
});

test('invalid mixed plan updates are atomic, and planning does not invalidate game or asset evidence', t => {
  const root = temporary(t), host = path.join(root, 'host'), workspace = path.join(root, 'workspace'); fs.mkdirSync(workspace);
  const planning = new SkillPlanning(host, () => catalog, 'request1');
  planning.recordRead('story');
  const valid = decision('story', ['content'], 'story');
  assert.throws(() => planning.update({ decisions: [valid, decision('invalid', ['build'], 'missing')] }), /技能不存在/);
  assert.equal(planning.view().decisions.length, 0);
  const before = candidateHash(workspace);
  planning.update({ decisions: [valid] });
  fs.writeFileSync(path.join(workspace, 'work.json'), JSON.stringify({ skillPlan: planning.view() }));
  assert.equal(candidateHash(workspace), before);
});

test('skill descriptions come from front matter and the release catalog contains all 18 capabilities', () => {
  assert.equal(skillDescription('---\r\nname: example\r\ndescription: >-\r\n  Supports existing\r\n  mechanisms.\r\n---\r\nbody'), 'Supports existing mechanisms.');
  assert.throws(() => skillDescription('---\nname: missing\n---\nbody'), /description/);
  const real = loadSkillCatalog(path.resolve('skills'));
  assert.equal(real.length, 18);
  assert.ok(real.every(skill => skill.description.trim() && skill.revision && fs.existsSync(skill.entry)));
});
