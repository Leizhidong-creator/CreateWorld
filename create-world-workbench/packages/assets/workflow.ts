import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type RepairOwner = 'artwork' | 'geometry' | 'environment' | 'contract' | 'review';
export interface AssetDiagnostic {
  code: string;
  owner: RepairOwner;
  nextAction: string;
  resumeCandidate?: string;
}
export class AssetCheckError extends Error {
  constructor(message: string, readonly diagnostic: AssetDiagnostic) { super(message); }
}

/** Production failures describe the repair owner; they never imply “generate again”. */
export function diagnoseAssetFailure(error: unknown): AssetDiagnostic {
  if (error instanceof AssetCheckError) return error.diagnostic;
  const message = error instanceof Error ? error.message : String(error);
  if (/EPIPE|ECONN|超时|没有返回进展|Codex 进程结束|拒绝访问|permission denied|EACCES|ENOENT|unable to create process/i.test(message))
    return { code: 'environment-unavailable', owner: 'environment', nextAction: '修复解释器、文件或服务后继续；保留已有母版，不为环境错误重新生图。' };
  if (/步态|相位|frame border|跨格|截脚|same.*phase|duplicated.*gait/i.test(message))
    return { code: 'artwork-motion', owner: 'artwork', nextAction: '只修失败方向或帧，保留其余方向和原生母版。' };
  return { code: 'asset-contract', owner: 'contract', nextAction: '检查候选协议与具体错误；先修引用、元数据或处理参数，不直接重新生图。' };
}

export const ASSET_RETRY_POLICY = { sameFailureLimit: 2, generationAttemptLimit: 3 } as const;
interface FailureEntry { input: string; code: string; owner: RepairOwner; message: string; at: string; resumeCandidate?: string; }
interface History { generationAttempts: number; failures: FailureEntry[]; }
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

/** Host-owned, per-resource history survives new attempts and service restarts. */
export class AssetRetryHistory {
  private constructor(private readonly filename: string, private readonly state: History) {}
  static async open(root: string, workspace: string, assetId: string, artRevision: string) {
    const filename = path.join(root, 'retry-history', digest(JSON.stringify([path.resolve(workspace).toLowerCase(), assetId.toLowerCase(), artRevision])) + '.json');
    let state: History = { generationAttempts: 0, failures: [] };
    try { state = JSON.parse(await readFile(filename, 'utf8')); }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    return new AssetRetryHistory(filename, state);
  }
  decision(input: string, operation: 'generate' | 'validate'): AssetDiagnostic | undefined {
    const matching = this.state.failures.filter(f => f.input === input);
    const last = matching.at(-1);
    if (last && matching.filter(f => f.code === last.code).length >= ASSET_RETRY_POLICY.sameFailureLimit)
      return { code: 'repeated-asset-failure', owner: last.owner, resumeCandidate: last.resumeCandidate, nextAction: `同一输入的 ${last.code} 已失败两次。先修负责层的输入，再重验已有候选；新建 attempt 不会重置计数。最近错误：${last.message}` };
    if (operation === 'generate' && last?.resumeCandidate && last.owner !== 'artwork')
      return { code: 'existing-candidate-needs-repair', owner: last.owner, resumeCandidate: last.resumeCandidate, nextAction: '已有原生候选。修正负责层的输入后设置 resumeCandidate 重验，不为下游检查失败重新生图。' };
    if (operation === 'generate' && this.state.generationAttempts >= ASSET_RETRY_POLICY.generationAttemptLimit)
      return { code: 'generation-budget-exhausted', owner: last?.owner || 'artwork', nextAction: '本资源已用完三次生产尝试。使用 resumeCandidate 修复并重验现有母版，不能新开任务继续整图生成。' };
    return undefined;
  }
  async beginGeneration() { this.state.generationAttempts++; await this.save(); }
  async cancelGeneration() { this.state.generationAttempts = Math.max(0, this.state.generationAttempts - 1); await this.save(); }
  async fail(input: string, diagnostic: AssetDiagnostic, message: string) {
    this.state.failures.push({ input, code: diagnostic.code, owner: diagnostic.owner, message, at: new Date().toISOString(), resumeCandidate: diagnostic.resumeCandidate });
    await this.save();
  }
  async succeeded() { this.state.generationAttempts = 0; this.state.failures = []; await this.save(); }
  private async save() { await mkdir(path.dirname(this.filename), { recursive: true }); await writeFile(this.filename, JSON.stringify(this.state, null, 2) + '\n'); }
}

export interface SceneContentOwnership {
  baked?: string[];
  runtime?: string[];
  state?: string;
}

export function assetWorkflowInstruction(): string {
  return `素材生产失败先看 failures 的 owner、code、nextAction 和 resumeCandidate。几何或审阅问题应修负责层，再在 assets-plan 对应任务设置 resumeCandidate 为返回的候选JSON路径，继续调用 cw_assets；此操作不生图且仍执行必要QA。原生母版及override保持原字节，只修候选碰撞/处理元数据或审阅范围。宿主按资源持久化累计：同输入同类失败${ASSET_RETRY_POLICY.sameFailureLimit}次后须修输入，同一美术版本最多${ASSET_RETRY_POLICY.generationAttemptLimit}次生产尝试，新开attempt或重启不会清零；主动取消不计失败。单资源受阻继续不受影响项，不以整批重生替代局部修复。背景可用 sceneContent:{baked:[],runtime:[],state:''} 明确归属；坐标估计不作像素级硬门槛。已通过且未变化的素材由宿主复用证据，最终真实运行同屏审阅仍需执行。`;
}
/** One ownership contract is shared by production and review, with no game-specific rules. */
export function sceneReviewScope(ownership?: SceneContentOwnership): string {
  return `本次只审背景本体与可见几何。${ownership?.state ? `背景状态：${ownership.state}。` : ''}
明确烘焙元素：${JSON.stringify(ownership?.baked || [])}；运行时叠加元素：${JSON.stringify(ownership?.runtime || [])}。
运行时角色、可获得道具及可变剧情状态不要求预先画入背景；只有明确归属本背景且当前状态必需的元素缺失才列为背景缺陷。归属不明时记录待同屏确认，不据剧情用途猜测必须烘焙。
主路线、出口语义和交互关系是约束；未明确锁定的像素坐标与家具尺寸是布局估计。允许沿可见接地范围适配几何并重验路线，不能仅因偏离估计值要求重新生图。
这里只审像素、视角、识别和明显碰撞错位；数值可达性由宿主负责，人物与家具合成及剧情状态由最终运行同屏审阅负责。细小瑕疵列 warnings，只有阻断使用或明显破坏统一风格的问题列 issues。`;
}
