import {StoryStore,condition,initialRun} from '../runtime/state.js';
import {validateConfig} from '../runtime/validate.js';

export interface ReachabilityResult {status:'passed'|'failed'|'unknown';reachableEndings:string[];witnesses:Record<string,any[]>;softlocks:Array<{scene:string;trace:any[]}>;errors:string[];statesExplored:number;limitations:string[];}
/** Finite story abstraction. Does not prove spatial routes, timing, visual output or arbitrary extension code. */
export function analyzeReachability(config:any,{maxStates=10000}:{maxStates?:number}={}):ReachabilityResult{
  const result:ReachabilityResult={status:'unknown',reachableEndings:[],witnesses:{},softlocks:[],errors:[],statesExplored:0,limitations:['空间移动、碰撞和输入时序未枚举，仍须真实浏览器旅程。','访问与交互计数在最大 >= 阈值处等价合并；本抽象不压缩可消耗物品数量。']};
  if(!Number.isSafeInteger(maxStates)||maxStates<1||maxStates>100000){result.errors.push('maxStates必须为1~100000之间的整数');return result;}
  try{validateConfig(config);}catch(e){result.errors.push(String(e));result.status='failed';return result;}
  const limits={visits:new Map<string,number>(),counters:new Map<string,number>()};let unsupported=false;
  const scan=(v:any)=>{if(!v||typeof v!=='object')return;if(v.type==='custom'||v.type==='minigame'||v.type==='count'&&(v.amount??1)<0)unsupported=true;if(v.visited)limits.visits.set(v.visited,Math.max(limits.visits.get(v.visited)||1,v.count??1));if(v.counter)limits.counters.set(v.counter,Math.max(limits.counters.get(v.counter)||1,v.atLeast??1));for(const x of Object.values(v))if(x&&typeof x==='object')Array.isArray(x)?x.forEach(scan):scan(x);};scan(config);
  if(unsupported){result.limitations.push('含自定义代码、小游戏或递减计数，当前有限抽象不能静态证明；必须提供并执行实际旅程。');return result;}
  const cap=(run:any)=>{for(const [kind,map]of Object.entries(limits) as Array<['visits'|'counters',Map<string,number>]>)for(const id of Object.keys(run[kind]))run[kind][id]=Math.min(run[kind][id],map.get(id)||1);return run;};
  const key=(run:any)=>JSON.stringify({...run,player:null,elapsed:0,explored:{},tutorialSeen:false,once:[...run.once].sort(),clues:[...run.clues].sort(),discovered:[...run.discovered].sort(),flags:Object.fromEntries(Object.entries(run.flags).sort()),items:Object.fromEntries(Object.entries(run.items).filter(([,n])=>n!==0).sort()),counters:Object.fromEntries(Object.entries(run.counters).sort()),visits:Object.fromEntries(Object.entries(run.visits).sort())});
  type Branch={run:any;profile:any;trace:any[];pending:any[]};
  const commit=(b:Branch,actions:any[],once:string|null=null,guard:any=null)=>{const store=new StoryStore(config,b.run,b.profile);const pending:any[]=[];store.on('command',(a:any)=>pending.push(a));store.commit(actions,once,guard);return{...b,...store.snapshot(),pending:[...b.pending,...pending]};};
  const resolve=(initial:Branch):Branch[]=>{
    const queue=[initial],finished:Branch[]=[];let steps=0;
    while(queue.length){if(++steps>1000)throw Error('命令/对白展开超过1000步，无法完成验证');const b=queue.shift()!;if(!b.pending.length||b.run.ending){finished.push(b);continue;}const [a,...pending]=b.pending;const next={...b,pending};
      if(a.type==='dialogue'){const d=config.dialogues.find((v:any)=>v.id===a.id);const choices=(d.choices||[]).filter((v:any)=>condition(v.when,b.run));for(const choice of choices.length?choices:[null]){const branch={...next,trace:choice?[...next.trace,{action:'choice',label:choice.label}]:next.trace};queue.push(commit(branch,[...(d.onComplete||[]),...(choice?.actions||[])],d.once?'dialogue:'+d.id:null,choice?.when));}}
      else if(a.type==='scene'){const s=config.scenes.find((v:any)=>v.id===a.id);const branch=structuredClone(next);branch.run.scene=s.id;branch.run.player={...a.position,facing:'down'};branch.run.visits[s.id]=(branch.run.visits[s.id]||0)+1;queue.push(commit(branch,s.onEnter||[],'enter:'+s.id));}
      else if(a.type==='ending'){if(condition(config.endings.find((v:any)=>v.id===a.id).when,next.run))next.run={...next.run,ending:a.id};queue.push(next);}
      else throw Error('无法解释的显示命令：'+a.type);
    }return finished;
  };
  const nodes:Array<{run:any;profile:any;trace:any[];edges:Set<number>}>=[];const lookup=new Map<string,number>();let truncated=false;
  const insert=(b:Branch)=>{cap(b.run);const k=key(b.run);if(lookup.has(k))return lookup.get(k)!;if(nodes.length>=maxStates){truncated=true;return -1;}const index=nodes.length;lookup.set(k,index);nodes.push({...b,edges:new Set()});return index;};
  try{
    const first=new StoryStore(config);const startScene=config.scenes.find((s:any)=>s.id===config.start.scene);for(const b of resolve(commit({...first.snapshot(),trace:[],pending:[]},startScene.onEnter||[],'enter:'+startScene.id)))insert(b);
    for(let i=0;i<nodes.length&&!truncated;i++){const node=nodes[i]!;result.statesExplored++;if(node.run.ending){if(!result.witnesses[node.run.ending]){result.reachableEndings.push(node.run.ending);result.witnesses[node.run.ending]=node.trace;}continue;}
      const scene=config.scenes.find((s:any)=>s.id===node.run.scene);const choices:Array<{step:any;actions:any[];once:string|null;guard:any}>=[];
      for(const e of scene.interactions||[]){if(!condition(e.when,node.run)||e.once&&node.run.once.includes('interaction:'+e.id))continue;const branch=e.branches?.find((b:any)=>condition(b.when,node.run));choices.push({step:{action:'interact',id:e.id},actions:[{type:'count',id:e.id},...(branch?branch.actions:e.actions||[])],once:e.once?'interaction:'+e.id:null,guard:branch?.when??e.when});}
      for(const e of scene.exits||[])if(condition(e.when,node.run))choices.push({step:{action:'exit',id:e.id},actions:[...(e.automatic?[]:[{type:'count',id:e.id}]),{type:'scene',id:e.to,position:e.spawn}],once:null,guard:e.when});
      for(const t of scene.triggers||[])if(condition(t.when,node.run)&&!(t.once!==false&&node.run.once.includes('trigger:'+t.id)))choices.push({step:{action:'trigger',id:t.id},actions:t.actions||[],once:t.once!==false?'trigger:'+t.id:null,guard:t.when});
      for(const choice of choices){try{const branches=resolve(commit({...node,trace:[...node.trace,choice.step],pending:[]},choice.actions,choice.once,choice.guard));for(const b of branches){const target=insert(b);if(target>=0)node.edges.add(target);}}catch(e){result.errors.push('可达动作失败 '+choice.step.id+'：'+String(e));}}
    }
    if(truncated){result.limitations.push('达到 maxStates='+maxStates+'，未完成全量探索；不可标记通过。');return result;}
    const canFinish=new Set<number>();for(let i=0;i<nodes.length;i++)if(nodes[i]!.run.ending)canFinish.add(i);let changed=true;while(changed){changed=false;nodes.forEach((node,i)=>{if(!canFinish.has(i)&&[...node.edges].some(j=>canFinish.has(j))){canFinish.add(i);changed=true;}});}
    nodes.forEach((node,i)=>{if(!canFinish.has(i)&&result.softlocks.length<10)result.softlocks.push({scene:node.run.scene,trace:node.trace});});
    for(const ending of config.endings)if(!result.reachableEndings.includes(ending.id))result.errors.push('结局不可达：'+ending.id);
    result.status=result.errors.length||result.softlocks.length?'failed':'passed';return result;
  }catch(e){result.errors.push(String(e));return result;}
}
