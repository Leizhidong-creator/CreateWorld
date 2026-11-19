import { Events } from './events.js';
export const clone = value => structuredClone(value);
export function initialRun(config) {
  const scene = config.scenes.find(s=>s.id===config.start.scene);
  return { scene:scene.id, player:{...config.start.position, facing:'down'}, flags:{}, items:{}, clues:[],
    quests:Object.fromEntries(config.quests.map(q=>[q.id,q.initial?'active':'locked'])), once:[], visits:{[scene.id]:1},
    explored:{}, discovered:[], counters:{}, elapsed:0, ending:null, tutorialSeen:false };
}
export function condition(c, s) {
  if(c == null) return true;
  if(typeof c === 'boolean') return c;
  if(c.all) return c.all.every(x=>condition(x,s));
  if(c.any) return c.any.some(x=>condition(x,s));
  if('not' in c) return !condition(c.not,s);
  if(c.flag) return s.flags[c.flag] === (c.equals ?? true);
  if(c.item) return (s.items[c.item]||0) >= (c.count??1);
  if(c.clue) return s.clues.includes(c.clue);
  if(c.quest) return s.quests[c.quest] === (c.status||'done');
  if(c.visited) return (s.visits[c.visited]||0) >= (c.count??1);
  if(c.discovered) return s.discovered.includes(c.discovered);
  if(c.counter) return (s.counters[c.counter]||0) >= (c.atLeast??1);
  if(c.scene) return s.scene===c.scene;
  return false;
}
/** Shared serializable state; all progression effects go through this store. */
export class StoryStore extends Events {
  constructor(config, run = null, profile = {}) {
    super(); this.config=config; this.run=run?clone(run):initialRun(config);
    this.profile={achievements:{},endings:[],settings:{music:.25,sound:.45},...clone(profile)};
    this.revision=0; this.settling=false;
  }
  test(c) { return condition(c,this.run); }
  commit(actions=[], onceId=null) {
    if(onceId && this.run.once.includes(onceId)) return false;
    if(onceId) this.run.once.push(onceId);
    this.apply(actions); this.settle(); this.revision++; this.emit('change',this.run); return true;
  }
  apply(actions) {
    for(const a of actions) {
      switch(a.type) {
        case 'flag': this.run.flags[a.id]=a.value??true; break;
        case 'give': this.run.items[a.id]=(this.run.items[a.id]||0)+(a.count??1); this.emit('notice',{kind:'item',id:a.id}); break;
        case 'take': this.run.items[a.id]=Math.max(0,(this.run.items[a.id]||0)-(a.count??1)); break;
        case 'clue': if(!this.run.clues.includes(a.id)) { this.run.clues.push(a.id); this.emit('notice',{kind:'clue',id:a.id}); } break;
        case 'quest': if(this.run.quests[a.id]!=='done') this.run.quests[a.id]=a.status||'active'; break;
        case 'discover': if(!this.run.discovered.includes(a.id)) this.run.discovered.push(a.id); break;
        case 'count': this.run.counters[a.id]=(this.run.counters[a.id]||0)+(a.amount??1); break;
        case 'achievement': this.unlock(a.id); break;
        case 'notice': this.emit('notice',{text:a.text}); break;
        default: this.emit('command',clone(a));
      }
    }
  }
  settle() {
    if(this.settling) return;
    this.settling=true;
    try {
      // State transitions are monotonic in a single settlement. Bound malformed cycles.
      let changed=true, steps=0;
      while(changed && ++steps<=this.config.quests.length*2+2) {
        changed=false;
        for(const q of this.config.quests) {
          if(this.run.quests[q.id]==='locked' && q.unlock && this.test(q.unlock)) { this.run.quests[q.id]='active'; changed=true; }
          if(this.run.quests[q.id]==='active' && q.complete && this.test(q.complete)) {
            this.run.quests[q.id]='done'; const rewardKey='quest-reward:'+q.id; if(!this.run.once.includes(rewardKey)) { this.run.once.push(rewardKey); this.apply(q.onComplete||[]); } this.emit('notice',{text:'目标完成 · '+q.title}); changed=true;
          }
        }
      }
      if(changed) throw new Error('任务状态出现循环，请检查 onComplete。');
      for(const a of this.config.achievements||[]) if(a.when && this.test(a.when)) this.unlock(a.id);
    } finally { this.settling=false; }
  }
  unlock(id) {
    if(this.profile.achievements[id]) return;
    this.profile.achievements[id]={unlockedAt:Date.now()}; this.emit('achievement',id);
  }
  currentQuest() { return this.config.quests.find(q=>this.run.quests[q.id]==='active' && !q.optional) || null; }
  restart() { this.run=initialRun(this.config); this.revision++; this.emit('change',this.run); }
  snapshot() { return clone({run:this.run,profile:this.profile}); }
}
