import {z} from 'zod';

export class TextError extends Error {
  constructor(public code:string,message:string,public status=409){super(message);}
}
export const idSchema=z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const requestKey=z.string().min(1).max(160);
export const createInput=z.object({title:z.string().trim().min(1).max(180),inputKind:z.enum(['text','title']),sourceText:z.string().max(2_000_000).default(''),requirements:z.string().max(20_000).default('')});
export const uploadInput=z.object({requestKey,fileName:z.string().min(1).max(255),base64:z.string().max(15_000_000),questionId:idSchema.optional()});
export const startInput=z.object({requestKey,kind:z.enum(['script','revise','yaml']),baseVersionId:idSchema.nullable(),instruction:z.string().max(20_000).default('')});
export const editInput=z.object({requestKey,baseVersionId:idSchema,body:z.string().min(1).max(2_000_000)});
export const answerInput=z.object({requestKey,text:z.string().max(30_000).default(''),choiceIds:z.array(idSchema).default([]),sourceIds:z.array(idSchema).default([])});
export const questionSchema=z.object({key:idSchema,role:z.enum(['reader','adapter','yaml_author','reviewer']),shortText:z.string().min(1).max(300),details:z.string().min(1).max(20_000),answerMode:z.enum(['text','choice','material']),choices:z.array(z.object({id:idSchema,label:z.string().min(1).max(300)})).default([])});
export type QuestionDraft=z.infer<typeof questionSchema>;
export type Role=QuestionDraft['role'];
export type Stage='creative'|'read'|'design'|'write'|'review'|'precheck'|'expand'|'audit';
export type RunStatus='queued'|'running'|'waiting_user'|'interrupted'|'cancelled'|'failed'|'completed';
export interface TextProject {id:string;title:string;inputKind:'text'|'title';requirements:string;sourceIds:string[];currentScriptId:string|null;currentYamlId:string|null;createdAt:string;updatedAt:string;}
export interface Source {id:string;projectId:string;name:string;hash:string;textHash:string;status:'readable'|'needs_material';text:string;issues:string[];units:{label:string;start:number;end:number}[];createdAt:string;}
export interface Version {id:string;projectId:string;runId?:string;kind:'script'|'yaml';baseVersionId:string|null;sourceScriptId?:string;status:'current'|'candidate'|'historical';checkStatus:'unreviewed'|'text_review_passed'|'checks_passed';bodyHash:string;synopsis:string;summary:string;createdAt:string;checks?:unknown;}
export interface Checkpoint {snapshotId:string;stage:Stage;inputHash:string;files:Record<string,string>;createdAt:string;}
export interface TextRun {id:string;projectId:string;kind:'script'|'revise'|'yaml';baseVersionId:string|null;instruction:string;status:RunStatus;stage:Stage;stages?:Stage[];attempt:number;stageRetries:number;inputHash:string;input:unknown;methods:Record<string,string>;checkpoints:Checkpoint[];threadId?:string;threadStage?:Stage;error?:string;createdAt:string;updatedAt:string;resultVersionId?:string;recovery?:string;}
export interface Question extends QuestionDraft {id:string;projectId:string;runId:string;inputHash:string;batchId:string;status:'pending'|'answered'|'stale';answer?:z.infer<typeof answerInput>;createdAt:string;answeredAt?:string;}
export const stagesFor=(kind:TextRun['kind']):Stage[]=>kind==='yaml'?['precheck','expand','audit']:kind==='revise'?['write','review']:['read','design','write','review'];
export const stageRole:Record<Stage,Role>={creative:'adapter',read:'reader',design:'adapter',write:'adapter',review:'reviewer',precheck:'reviewer',expand:'yaml_author',audit:'reviewer'};
export const stageLabels:Record<Stage,string>={creative:'判断与补全创意',read:'阅读并核对原作',design:'设计角色经历与玩家参与',write:'展开完整粗剧本',review:'审阅粗剧本',precheck:'检查当前粗剧本',expand:'展开完整 YAML',audit:'检查 YAML 与状态关系'};
export const stageOutput=z.discriminatedUnion('status',[
  z.object({status:z.literal('questions'),questions:z.array(questionSchema).min(1).max(20)}),
  z.object({status:z.literal('complete'),summary:z.string().min(1),synopsis:z.string().optional()}),
  z.object({status:z.literal('revise'),summary:z.string().min(1),issues:z.array(z.string()).min(1)})
]);
export type StageOutput=z.infer<typeof stageOutput>;

export const phasesFor=(run:TextRun)=>run.stages||stagesFor(run.kind);
