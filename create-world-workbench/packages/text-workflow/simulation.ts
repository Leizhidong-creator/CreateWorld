import {z} from 'zod';
import {parseDocument} from 'yaml';
import {hash} from '../shared/files.js';
const scalar=z.union([z.string(),z.number().finite(),z.boolean(),z.null()]);
const trace=z.object({path:z.string().startsWith('/'),expected:z.unknown()});
const condition:z.ZodType<any>=z.lazy(()=>z.union([
 z.object({all:z.array(condition)}),z.object({any:z.array(condition)}),z.object({not:condition}),
 z.object({variable:z.string(),op:z.enum(['eq','ne','lt','le','gt','ge']),value:scalar})
]));
const effect=z.discriminatedUnion('op',[
 z.object({op:z.literal('set'),variable:z.string(),value:scalar}),
 z.object({op:z.literal('add'),variable:z.string(),value:z.number().finite()}),
 z.object({op:z.literal('save'),checkpoint:z.string()}),z.object({op:z.literal('restore'),checkpoint:z.string()})
]);
export const modelSchema=z.object({
 version:z.literal(1),yamlHash:z.string(),coverage:z.array(trace),unknowns:z.array(z.object({path:z.string(),reason:z.string()})),
 variables:z.record(z.string(),z.object({initial:scalar,domain:z.array(scalar).min(1),trace})),
 checkpoints:z.record(z.string(),z.object({variables:z.array(z.string()),trace})),
 transitions:z.array(z.object({id:z.string(),trace,when:condition,effects:z.array(effect),optional:z.boolean(),
  kind:z.enum(['action','repeat','exit_continue','failure','restart','skip']),progressScope:z.enum(['normal','new_game']).default('normal'),
  equivalentTo:z.string().optional(),compare:z.array(z.string()).optional(),preserve:z.array(z.string()).optional()})).min(1),
 goals:z.array(z.object({when:condition,trace})).min(1),
 invariants:z.array(z.object({id:z.string(),kind:z.enum(['item','reward','state']),when:condition,trace})),
 recoveryCoverage:z.array(z.object({trace,exit_continue:z.array(z.string()),failure:z.array(z.string()),restart:z.array(z.string()),skip:z.array(z.string())}))
});
type Model=z.infer<typeof modelSchema>;
type Value=string|number|boolean|null;
interface State{values:Record<string,Value>;saved:Record<string,Record<string,Value>>}
class Findings extends Array<Finding>{override push(...rows:Finding[]){for(const row of rows)if(this.length<200&&!this.some(x=>x.code===row.code&&x.path===row.path&&x.message===row.message))super.push(row);return this.length;}}
export interface Finding{code:string;message:string;path?:string;steps?:string[];}
const stable=(x:any):string=>x&&typeof x==='object'?Array.isArray(x)?'['+x.map(stable).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);
export function pointer(root:any,p:string){return p.split('/').slice(1).reduce((v,k)=>{const key=k.replaceAll('~1','/').replaceAll('~0','~');if(v===null||typeof v!=='object'||!Object.hasOwn(v,key))throw new Error('不存在的 YAML 路径：'+p);return v[key];},root);}
function matches(c:any,s:State):boolean{
 if(c.all)return c.all.every((x:any)=>matches(x,s));if(c.any)return c.any.some((x:any)=>matches(x,s));if(c.not)return !matches(c.not,s);
 if(!Object.hasOwn(s.values,c.variable))throw new Error('未定义变量：'+c.variable);
 const a=s.values[c.variable],b=c.value;
 if(c.op==='eq')return a===b;if(c.op==='ne')return a!==b;
 if(typeof a!=='number'||typeof b!=='number')throw new Error('数值比较使用了非数值变量：'+c.variable);
 return c.op==='lt'?a<b:c.op==='le'?a<=b:c.op==='gt'?a>b:a>=b;
}
function advance(m:Model,s:State,t:Model['transitions'][number]):State{
 const next:State=structuredClone(s);
 for(const e of t.effects){
  if(e.op==='save'||e.op==='restore'){
   const cp=m.checkpoints[e.checkpoint];if(!cp)throw new Error('未定义检查点：'+e.checkpoint);
   if(e.op==='save')next.saved[e.checkpoint]=Object.fromEntries(cp.variables.map(k=>[k,next.values[k]]));
   else {if(!next.saved[e.checkpoint])throw new Error('检查点尚未建立：'+e.checkpoint);Object.assign(next.values,next.saved[e.checkpoint]);}
  }else{
   if(!m.variables[e.variable])throw new Error('未定义变量：'+e.variable);
   if(e.op==='add'){if(typeof next.values[e.variable]!=='number')throw new Error('非数值变量不能加减');next.values[e.variable]=(next.values[e.variable] as number)+e.value;}
   else next.values[e.variable]=e.value;
   if(!m.variables[e.variable].domain.some(v=>v===next.values[e.variable]))throw new Error('变量越界（可能重复奖励或模型范围不足）：'+e.variable);
  }
 }
 return next;
}
export function simulateYaml(raw:string,input:unknown,limit=10_000){
 const findings:Finding[]=new Findings(),unverified:Finding[]=new Findings(),report={status:'unverified',yamlHash:hash(raw),findings,unverified,explored:{all:0,noOptional:0},transitionCoverage:[] as string[],limits:{states:limit,transitionEvaluations:250_000,diagnosticsPerCategory:200},runtimeTested:false};
 try{
 const doc=parseDocument(raw,{uniqueKeys:true});if(doc.errors.length)throw new Error(doc.errors.map(e=>e.message).join('; '));const yaml=doc.toJS();
 const m=modelSchema.parse(input);if(m.yamlHash!==hash(raw))throw new Error('模型与 YAML 哈希不一致');
 const verifyTrace=(t:z.infer<typeof trace>)=>{if(stable(pointer(yaml,t.path))!==stable(t.expected))throw new Error('溯源内容不匹配：'+t.path);};
 const walk=(x:any)=>{if(!x||typeof x!=='object')return;if(x.trace)verifyTrace(x.trace);for(const v of Object.values(x))if(typeof v==='object')walk(v);};walk(m);m.coverage.forEach(verifyTrace);
 const covered=new Set(m.coverage.map(x=>x.path));
 for(const category of ['事件','物件','状态','检查点','玩法','结局'])if(Array.isArray(yaml[category]))yaml[category].forEach((_:any,i:number)=>{if(!covered.has('/'+category+'/'+i))unverified.push({code:'coverage_missing',message:'未覆盖内容档案',path:'/'+category+'/'+i});});
 if(!covered.has('/初始配置'))unverified.push({code:'initial_missing',message:'未绑定初始配置',path:'/初始配置'});
 for(const q of m.unknowns)unverified.push({code:'unknown_rule',message:q.reason,path:q.path});
 const ids=new Set<string>();for(const t of m.transitions){if(ids.has(t.id))throw new Error('重复转换编号：'+t.id);ids.add(t.id);}
 for(const [key,v] of Object.entries(m.variables)){if(!v.domain.some(x=>x===v.initial))throw new Error('初值超出范围：'+key);}
 for(const cp of Object.values(m.checkpoints))for(const key of cp.variables)if(!m.variables[key])throw new Error('检查点变量不存在：'+key);
 for(const t of m.transitions){for(const key of [...t.compare||[],...t.preserve||[]])if(!m.variables[key])throw new Error('恢复比较变量不存在：'+key);if(t.kind==='exit_continue'&&!t.preserve?.length)unverified.push({code:'recovery_unspecified',message:'退出继续没有声明保留字段',path:t.trace.path});if(t.kind==='skip'&&(!t.equivalentTo||!t.compare?.length))unverified.push({code:'skip_unspecified',message:'跳过没有声明成功等价结果',path:t.trace.path});}
 if(Array.isArray(yaml['玩法']))yaml['玩法'].forEach((p:any,i:number)=>{
  if(p['类别']==='独立小游戏'||String(p['类别']).includes('小游戏')){
   const row=m.recoveryCoverage.find(x=>x.trace.path==='/玩法/'+i);
   for(const kind of ['exit_continue','failure','restart','skip'] as const){if(!row?.[kind].length)unverified.push({code:'minigame_recovery_missing',message:'小游戏未覆盖 '+kind,path:'/玩法/'+i});else for(const id of row[kind])if(!m.transitions.some(t=>t.id===id&&t.kind===kind))throw new Error('恢复转换不存在或种类不符：'+id);}
  }
 });
 const visitedTransitions=new Set<string>();
 for(const noOptional of [false,true]){
  const initial:State={values:Object.fromEntries(Object.entries(m.variables).map(([k,v])=>[k,v.initial])),saved:{}};
  const states=[initial],parents=[{from:-1,via:''}],keys=new Map([[stable(initial),0]]),reverse:number[][]=[[]],goals=new Set<number>();let bounded=false,evaluations=0;
  const route=(index:number)=>{const out:string[]=[];while(parents[index].from>=0){out.push(parents[index].via);index=parents[index].from;}return out.reverse();};
  search: for(let i=0;i<states.length;i++){
   const s=states[i];if(m.goals.some(g=>matches(g.when,s)))goals.add(i);
   for(const inv of m.invariants)if(!matches(inv.when,s))findings.push({code:inv.kind+'_invariant',message:inv.id,path:inv.trace.path,steps:route(i)});
   for(const t of m.transitions){if(++evaluations>250_000){bounded=true;break search;}if(noOptional&&t.optional||!matches(t.when,s))continue;visitedTransitions.add(t.id);let n:State;
    try{n=advance(m,s,t);}catch(e){findings.push({code:'invalid_effect',message:String(e),path:t.trace.path,steps:[...route(i),t.id]});continue;}
    if(t.preserve?.some(k=>n.values[k]!==s.values[k]))findings.push({code:'restore_mismatch',message:'恢复未保留指定字段',path:t.trace.path,steps:[...route(i),t.id]});
    if(t.equivalentTo){const other=m.transitions.find(x=>x.id===t.equivalentTo);if(!other)throw new Error('等价转换不存在：'+t.equivalentTo);if(!matches(other.when,s))unverified.push({code:'equivalence_unavailable',message:'无法在同一前置状态比较成功与跳过',path:t.trace.path,steps:route(i)});else {const alt=advance(m,s,other);if(t.compare?.some(k=>n.values[k]!==alt.values[k]))findings.push({code:'skip_mismatch',message:'跳过与成功的剧情结果不一致',path:t.trace.path,steps:[...route(i),t.id]});}}
    const key=stable(n);let j=keys.get(key);if(j===undefined){if(states.length>=limit){bounded=true;continue;}j=states.length;keys.set(key,j);states.push(n);parents.push({from:i,via:t.id});reverse.push([]);}if(t.progressScope!=='new_game')reverse[j].push(i);
   }
  }
  report.explored[noOptional?'noOptional':'all']=states.length;
  if(bounded)unverified.push({code:'exploration_limit',message:'探索达到状态或转换检查上限；未证明所有状态可通关'});
  if(!goals.size){(bounded?unverified:findings).push({code:'ending_unreachable',message:noOptional?'跳过全部可选内容后结局不可达':'结局不可达'});}
  const canFinish=new Set(goals),queue=[...goals];for(let q=0;q<queue.length;q++)for(const prev of reverse[queue[q]])if(!canFinish.has(prev)){canFinish.add(prev);queue.push(prev);}
  if(!bounded){const bad=states.findIndex((_,i)=>!canFinish.has(i));if(bad>=0)findings.push({code:'dead_end',message:noOptional?'不参与可选内容时存在死路':'合法操作后无法继续至结局',steps:route(bad)});}
 }
 report.transitionCoverage=[...visitedTransitions];for(const t of m.transitions)if(!visitedTransitions.has(t.id))unverified.push({code:'transition_unreached',message:'未触达转换 '+t.id,path:t.trace.path});
 report.status=findings.length?'failed':unverified.length?'unverified':'passed';return report;
 }catch(e){findings.push({code:'invalid_model',message:String(e)});report.status='failed';return report;}
}
