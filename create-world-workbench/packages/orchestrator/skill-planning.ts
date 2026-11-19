import fs from 'node:fs';
import path from 'node:path';
import type { SkillCatalogEntry } from '../skill-adapters/catalog.js';
import { ToolPreconditionError } from '../contracts/index.js';
import { readJson, writeJson } from '../shared/files.js';
import { HOST_RECORD_FILE } from './workspace-layout.js';

export const SKILL_STAGES = ['content', 'assets', 'build', 'review'] as const;
type SkillStage = typeof SKILL_STAGES[number];
export interface SkillDecision {
  id: string;
  requirement: string;
  stages: SkillStage[];
  consideredSkills: string[];
  selectedSkills: string[];
  strategy: 'reuse' | 'compose' | 'extend' | 'custom';
  reason: string;
  gap?: string;
  targetIds?: string[];
}
interface ConfirmedDecision extends SkillDecision { requestKey: string; evidence: Record<string, string>; }
interface PlanningState {
  reads: Record<string, { revision: string; readAt: string }>;
  decisions: Record<string, ConfirmedDecision>;
}
export interface SkillPlanUpdate { decisions?: SkillDecision[]; unchanged?: string[]; }

const strings = { type: 'array', items: { type: 'string' }, uniqueItems: true };
export const SKILL_PLAN_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    unchanged: strings,
    decisions: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['id', 'requirement', 'stages', 'consideredSkills', 'selectedSkills', 'strategy', 'reason'],
      properties: {
        id: { type: 'string' }, requirement: { type: 'string' }, reason: { type: 'string' }, gap: { type: 'string' },
        stages: { type: 'array', items: { enum: SKILL_STAGES }, minItems: 1, uniqueItems: true },
        consideredSkills: strings, selectedSkills: strings, targetIds: strings,
        strategy: { enum: ['reuse', 'compose', 'extend', 'custom'] },
      },
    } },
  },
};

function requirePlan(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ToolPreconditionError('技能优先：' + message);
}
const nonempty = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const uniqueStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every(nonempty) && new Set(value).size === value.length;

/** Host-owned evidence, separate from the model-writable work.json projection. */
export class SkillPlanning {
  private state: PlanningState;
  private readonly filename: string;
  constructor(root: string, private readonly catalog: () => SkillCatalogEntry[], private readonly requestKey: string, inheritedRoot?: string) {
    this.filename = path.join(root, HOST_RECORD_FILE.skillPlan);
    const inherited = inheritedRoot && path.join(inheritedRoot, HOST_RECORD_FILE.skillPlan);
    this.state = fs.existsSync(this.filename) ? readJson(this.filename) : inherited && fs.existsSync(inherited) ? readJson(inherited) : { reads: {}, decisions: {} };
  }

  recordRead(id: string): void {
    const skill = this.catalog().find(s => s.id === id);
    requirePlan(skill, '未知技能：' + id);
    this.state.reads[id] = { revision: skill.revision, readAt: new Date().toISOString() };
    this.save();
  }

  update(patch: SkillPlanUpdate): void {
    requirePlan(patch && typeof patch === 'object', 'skillPlan 必须是对象');
    const decisions = patch.decisions ?? [], unchanged = patch.unchanged ?? [];
    requirePlan(Array.isArray(decisions) && uniqueStrings(unchanged), '决策和 unchanged 格式无效');
    const ids = [...decisions.map(d => d.id), ...unchanged];
    requirePlan(new Set(ids).size === ids.length, '同一次更新不能重复声明需求 ID');
    const next = structuredClone(this.state.decisions);
    const catalog = new Map(this.catalog().map(s => [s.id, s]));
    for (const decision of decisions) next[decision.id] = this.confirm(decision, catalog);
    for (const id of unchanged) {
      requirePlan(this.state.decisions[id], '无法复用不存在的需求判断：' + id);
      next[id] = this.confirm(this.state.decisions[id], catalog);
    }
    // Commit once: an invalid later decision must not leave a partially accepted plan.
    this.state.decisions = next;
    this.save();
  }

  assertToolReady(name: string, targetIds: string[] = []): void {
    const stages: SkillStage[] = name === 'cw_assets' ? ['content', 'assets'] : name === 'cw_build_test' ? ['content', 'build'] : name === 'cw_review' ? ['review'] : name === 'cw_finish' ? ['content', 'build', 'review'] : [];
    if (!stages.length) return;
    const catalog = new Map(this.catalog().map(s => [s.id, s]));
    for (const stage of stages) {
      const relevant = Object.values(this.state.decisions).filter(d => d.stages.includes(stage) && d.requestKey === this.requestKey && this.current(d, catalog));
      const targets = stage === 'assets' ? targetIds : [];
      const missing = targets.length ? targets.filter(id => !relevant.some(d => !d.targetIds?.length || d.targetIds.includes(id))) : relevant.length ? [] : [stage];
      requirePlan(!missing.length, `请先查看技能目录、cw_read_skill 读取相关技能，再通过 cw_checkpoint.skillPlan 提交 ${stage} 的适配判断（缺少：${missing.join('、')}）。只需更新受影响需求；无关判断可用 unchanged 复用。`);
    }
  }

  guard<T>(name: string, execute: (args: any) => Promise<T>): (args: any) => Promise<T> {
    return async args => { this.assertToolReady(name, args.ids); return execute(args); };
  }

  view() {
    const catalog = new Map(this.catalog().map(s => [s.id, s]));
    return {
      decisions: Object.values(this.state.decisions).map(d => {
        const { requestKey, evidence, ...decision } = d;
        return { ...decision, current: requestKey === this.requestKey && this.current(d, catalog) };
      }),
      readSkills: Object.keys(this.state.reads).filter(id => this.state.reads[id].revision === catalog.get(id)?.revision),
    };
  }

  private current(decision: ConfirmedDecision, catalog: Map<string, SkillCatalogEntry>): boolean {
    return decision.consideredSkills.every(id => decision.evidence[id] === catalog.get(id)?.revision && decision.evidence[id] === this.state.reads[id]?.revision);
  }

  private confirm(decision: SkillDecision, catalog: Map<string, SkillCatalogEntry>): ConfirmedDecision {
    requirePlan(decision && /^[\w-]{1,80}$/.test(decision.id) && nonempty(decision.requirement) && nonempty(decision.reason), '需求判断必须包含稳定 ID、具体需求与适配理由');
    requirePlan(uniqueStrings(decision.stages) && decision.stages.length && decision.stages.every(s => SKILL_STAGES.includes(s)), '需求判断包含无效工作范围');
    requirePlan(uniqueStrings(decision.consideredSkills) && (decision.consideredSkills.length || !catalog.size) && uniqueStrings(decision.selectedSkills), '必须列出已考察技能和选用技能');
    requirePlan(decision.targetIds === undefined || uniqueStrings(decision.targetIds), 'targetIds 必须是不重复的目标 ID');
    requirePlan(['reuse', 'compose', 'extend', 'custom'].includes(decision.strategy), '未知技能适配方式');
    requirePlan(decision.selectedSkills.every(id => decision.consideredSkills.includes(id)), '选用技能必须在已考察范围内');
    requirePlan(decision.strategy === 'custom' ? !decision.selectedSkills.length : decision.selectedSkills.length > 0, '复用/组合/扩展必须选技能；custom 表示现有技能不适用');
    requirePlan(decision.strategy !== 'compose' || decision.selectedSkills.length >= 2, '组合使用至少需要两个技能');
    requirePlan(!['extend', 'custom'].includes(decision.strategy) || nonempty(decision.gap), '扩展或自行实现必须说明现有技能的具体缺口');
    const evidence: Record<string, string> = {};
    for (const id of decision.consideredSkills) {
      const skill = catalog.get(id);
      requirePlan(skill, '技能不存在：' + id);
      requirePlan(this.state.reads[id]?.revision === skill.revision, `请先实际读取当前版本技能 ${id}，不能仅自报已阅读`);
      evidence[id] = skill.revision;
    }
    return { ...structuredClone(decision), requestKey: this.requestKey, evidence };
  }
  private save() { writeJson(this.filename, this.state); }
}

export const SKILL_FIRST_INSTRUCTION = `严格执行技能优先：开始实现前先看下方技能能力目录，判断哪些现有技能覆盖当前需求，再用 cw_read_skill 实际读取相关技能。通过 cw_checkpoint 的 skillPlan:{decisions:[{id,requirement,stages:['content'|'assets'|'build'|'review'],consideredSkills:[],selectedSkills:[],strategy:'reuse'|'compose'|'extend'|'custom',reason,gap?,targetIds?}],unchanged?:[]} 记录需求—技能对应关系。reuse复用、compose组合、extend局部扩展、custom现有技能不适用；后两者必须给出具体能力缺口，不得未经判断另造一套。stages表示此判断覆盖的实际工作，targetIds可限定素材ID，省略表示该阶段整体范围。素材生产前需content和assets判断，构建前需content和build判断，审阅前需review判断。只选相关技能，不强制读取全部技能或改变原作。普通进度checkpoint不重复交skillPlan；局部需求变化只更新受影响条目，其余用unchanged显式确认沿用，未变技能不必重读。判断与读取不是产物验收，不新增人工审批或模型审查。`;
