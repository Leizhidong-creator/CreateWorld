import { initialRun } from './state.js';
import { canStand } from './geometry.js';
const VERSION=1;
const record=v=>v && typeof v==='object' && !Array.isArray(v);
const stringList=v=>Array.isArray(v)&&v.every(x=>typeof x==='string');
export function validRun(r,config) {
  if(!record(r)) return false;
  const scene=config.scenes.find(s=>s.id===r.scene);
  if(!scene || !record(r.player) || !Number.isFinite(r.player.x) || !Number.isFinite(r.player.y)) return false;
  if(!canStand(r.player,scene,scene.collisions||[],config.player.radius||7)) return false;
  for(const k of ['flags','items','quests','visits','explored','counters']) if(!record(r[k])) return false;
  for(const k of ['clues','once','discovered']) if(!stringList(r[k])) return false;
  if(!Object.entries(r.items).every(([id,n])=>config.items.some(i=>i.id===id)&&Number.isSafeInteger(n)&&n>=0)) return false;
  if(!config.quests.every(q=>['locked','active','done'].includes(r.quests[q.id]))) return false;
  if(!Object.values(r.explored).every(stringList) || !Object.values(r.visits).every(Number.isFinite) || !Object.values(r.counters).every(Number.isFinite)) return false;
  return Number.isFinite(r.elapsed) && r.elapsed>=0 && (r.ending===null||config.endings.some(e=>e.id===r.ending));
}
export class SaveManager {
  constructor(config,storage,onWarning=()=>{}) { this.config=config; this.storage=storage; this.onWarning=onWarning; this.prefix='pixel-story:'+config.id+':'; this.warned=false; }
  warn(text) { if(!this.warned) { this.warned=true; this.onWarning(text); } }
  read(kind) {
    try {
      const text=this.storage?.getItem(this.prefix+kind); if(!text) return null;
      const v=JSON.parse(text);
      if(v.version!==VERSION || v.gameVersion!==(this.config.saveVersion||1)) { this.warn('存档版本不兼容，已保留原记录；可以开始新游戏。'); return null; }
      return v.data;
    } catch { this.warn('存档无法读取，本次可以继续游玩。'); return null; }
  }
  load() {
    let run=this.read('run'); const p=this.read('profile');
    if(run&&!validRun(run,this.config)) { this.warn('进度记录不完整，请开始新游戏。'); run=null; }
    const profile={achievements:{},endings:[],settings:{music:.25,sound:.45}};
    if(record(p)) {
      if(record(p.achievements)) for(const a of this.config.achievements||[]) if(record(p.achievements[a.id])) profile.achievements[a.id]=p.achievements[a.id];
      if(stringList(p.endings)) profile.endings=p.endings.filter(id=>this.config.endings.some(e=>e.id===id));
      if(record(p.settings)) for(const k of ['music','sound']) if(Number.isFinite(p.settings[k])) profile.settings[k]=Math.max(0,Math.min(1,p.settings[k]));
    }
    return {run,profile};
  }
  write(kind,data) {
    try {
      if(!this.storage) throw new Error('Storage unavailable');
      this.storage.setItem(this.prefix+kind,JSON.stringify({version:VERSION,gameVersion:this.config.saveVersion||1,data})); return true;
    } catch { this.warn('浏览器未允许保存，本次进度仅在当前页面有效。'); return false; }
  }
  save(store) { const a=this.write('profile',store.profile), b=this.write('run',store.run); return a&&b; }
  clearRun() { try { this.storage?.removeItem(this.prefix+'run'); } catch { this.warn('无法清除本地进度。'); } }
  clearAll() { try { this.storage?.removeItem(this.prefix+'run'); this.storage?.removeItem(this.prefix+'profile'); return true; } catch { this.warn('无法清除本地记录。'); return false; } }
}
