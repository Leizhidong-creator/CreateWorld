import { Events } from './events.js';
import { canStand, sceneSolids } from './geometry.js';
export const clone = value => structuredClone(value);
const safeId = id => typeof id==='string' && id.length>0 && !['__proto__','prototype','constructor'].includes(id);
export function initialRun(config) {
  const scene=config.scenes.find(s=>s.id===config.start.scene);
  return {scene:scene.id,player:{...config.start.position,facing:'down'},flags:Object.fromEntries((config.state?.variables||[]).map(v=>[v.id,clone(v.initial)])),items:{},clues:[],quests:Object.fromEntries(config.quests.map(q=>[q.id,q.initial?'active':'locked'])),once:[],visits:{[scene.id]:1},explored:{},discovered:[],counters:{},elapsed:0,ending:null,tutorialSeen:false};
}
export function condition(c,s) {
  if(c==null)return true;if(typeof c==='boolean')return c;if(Array.isArray(c))return c.every(x=>condition(x,s));
  if(c.all)return c.all.every(x=>condition(x,s));if(c.any)return c.any.some(x=>condition(x,s));if('not'in c)return !condition(c.not,s);
  if(c.var){const v=s.flags[c.var];switch(c.op||'eq'){case'eq':return v===c.value;case'ne':return v!==c.value;case'lt':return v<c.value;case'lte':return v<=c.value;case'gt':return v>c.value;case'gte':return v>=c.value;default:return false;}}
  if(c.flag)return s.flags[c.flag]===(c.equals??true);if(c.item)return(s.items[c.item]||0)>=(c.count??1);if(c.clue)return s.clues.includes(c.clue);
  if(c.quest)return s.quests[c.quest]===(c.status||'done');if(c.visited)return(s.visits[c.visited]||0)>=(c.count??1);if(c.discovered)return s.discovered.includes(c.discovered);if(c.counter)return(s.counters[c.counter]||0)>=(c.atLeast??1);if(c.scene)return s.scene===c.scene;return false;
}
/** Validate the complete candidate before publishing either state or UI commands. */
export function assertState(config,run){
  for(const [id,n]of Object.entries(run.items)){if(!safeId(id)||!config.items.some(x=>x.id===id)||!Number.isSafeInteger(n)||n<0)throw Error('物品状态非法：'+id);}
  for(const [id,n]of Object.entries(run.counters))if(!safeId(id)||!Number.isSafeInteger(n)||n<0)throw Error('计数状态非法：'+id);
  for(const v of config.state?.variables||[]){const value=run.flags[v.id];if(v.type==='bool'&&typeof value!=='boolean'||v.type==='int'&&(!Number.isSafeInteger(value)||value<v.min||value>v.max)||v.type==='enum'&&!v.values.includes(value))throw Error('状态变量类型或边界非法：'+v.id);}
  if(config.state?.strict)for(const id of Object.keys(run.flags))if(!config.state.variables.some(v=>v.id===id))throw Error('未声明状态变量：'+id);
  for(const inv of config.state?.invariants||[])if(condition(inv.if,run)&&!condition(inv.then,run))throw Error('状态不变量失败：'+inv.id);
}
export class StoryStore extends Events {
  constructor(config,run=null,profile={}){super();this.config=config;this.run=run?clone(run):initialRun(config);this.profile={achievements:{},endings:[],settings:{music:.25,sound:.45},...clone(profile)};this.revision=0;this.trace=[];assertState(config,this.run);}
  test(c){return condition(c,this.run);}
  /** guard observes the old state. Rejected guard/once returns false; invalid effects throw without side effects. */
  /** @param {any[]} actions @param {string|null} onceId @param {any} guard */
  commit(actions=[],onceId=null,guard=null){
    if(!this.test(guard)||onceId&&this.run.once.includes(onceId))return false;
    if(!Array.isArray(actions))throw Error('actions 必须为数组');
    const next=clone(this.run),profile=clone(this.profile),events=[];
    const ref=(kind,id)=>{if(!safeId(id)||!this.config[kind]?.some(v=>v.id===id))throw Error('不存在的 '+kind+'：'+id);};
    const unlock=id=>{ref('achievements',id);if(!profile.achievements[id]){profile.achievements[id]={unlockedAt:Date.now()};events.push(['achievement',id]);}};
    const apply=list=>{for(const a of list){if(!a||typeof a.type!=='string')throw Error('非法动作');if(a.type!=='notice'&&!safeId(a.id))throw Error('非法动作 ID');switch(a.type){
      case'flag':next.flags[a.id]=clone(a.value??true);break;
      case'give':case'take':{ref('items',a.id);const n=a.count??1;if(!Number.isSafeInteger(n)||n<1)throw Error('物品数量必须是正整数');const old=next.items[a.id]||0;if(a.type==='take'&&old<n)throw Error('物品不足：'+a.id);next.items[a.id]=old+(a.type==='take'?-n:n);if(a.type==='give')events.push(['notice',{kind:'item',id:a.id}]);break;}
      case'clue':ref('clues',a.id);if(!next.clues.includes(a.id)){next.clues.push(a.id);events.push(['notice',{kind:'clue',id:a.id}]);}break;
      case'quest':ref('quests',a.id);if(a.status&&!['locked','active','done'].includes(a.status))throw Error('非法任务状态');if(next.quests[a.id]!=='done')next.quests[a.id]=a.status||'active';break;
      case'discover':if(!next.discovered.includes(a.id))next.discovered.push(a.id);break;
      case'count':{const n=a.amount??1;if(!Number.isSafeInteger(n))throw Error('计数增量必须为整数');next.counters[a.id]=(next.counters[a.id]||0)+n;break;}
      case'achievement':unlock(a.id);break;
      case'notice':events.push(['notice',{text:String(a.text||'')}]);break;
      case'dialogue':case'scene':case'ending':case'minigame':ref({dialogue:'dialogues',scene:'scenes',ending:'endings',minigame:'minigames'}[a.type],a.id);if(a.type==='scene'){const target=this.config.scenes.find(s=>s.id===a.id);if(!canStand(a.position,target,sceneSolids(target,c=>condition(c,next)),this.config.player.radius||7))throw Error('场景落点不可通行：'+a.id);}
        events.push(['command',clone(a)]);break;
      case'custom':events.push(['command',clone(a)]);break;
      default:throw Error('未知动作类型：'+a.type);
    }}};
    apply(actions);
    let changed=true,steps=0;
    while(changed){if(++steps>this.config.quests.length*2+3)throw Error('任务状态循环');changed=false;for(const q of this.config.quests){
      if(next.quests[q.id]==='locked'&&q.unlock&&condition(q.unlock,next)){next.quests[q.id]='active';changed=true;}
      if(next.quests[q.id]==='active'&&q.complete&&condition(q.complete,next)){next.quests[q.id]='done';const key='quest-reward:'+q.id;if(!next.once.includes(key)){apply(q.onComplete||[]);next.once.push(key);}events.push(['notice',{text:'目标完成 · '+q.title}]);changed=true;}
    }}
    for(const a of this.config.achievements||[])if(a.when&&condition(a.when,next))unlock(a.id);
    assertState(this.config,next);
    if(onceId)next.once.push(onceId);
    // Publishing is a single pointer swap; event consumers cannot observe a half transaction.
    this.run=next;this.profile=profile;this.revision++;
    this.trace.push({revision:this.revision,onceId,actions:clone(actions)});if(this.trace.length>1000)this.trace.shift();
    for(const [type,value]of events)this.emit(type,value);this.emit('change',this.run);return true;
  }
  currentQuest(){return this.config.quests.find(q=>this.run.quests[q.id]==='active'&&!q.optional)||null;}
  restart(){this.run=initialRun(this.config);this.trace=[];this.revision++;this.emit('change',this.run);}
  snapshot(){return clone({run:this.run,profile:this.profile});}
}
