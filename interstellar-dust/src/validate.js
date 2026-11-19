import { canStand } from './geometry.js';
const kinds=new Set(['flag','give','take','clue','quest','discover','count','achievement','notice','dialogue','scene','ending','minigame','custom']);
export function validateConfig(c) {
  const errors=[]; const fail=(p,m)=>errors.push(p+': '+m);
  if(!c || typeof c!=='object') throw new Error('config: 必须是对象');
  if(!/^[a-z0-9][a-z0-9_-]+$/i.test(c.id||'')) fail('id','请使用稳定的字母、数字、短横线标识');
  const lists=['assets','scenes','characters','dialogues','quests','items','clues','achievements','endings','minigames']; const sets={};
  for(const k of lists) {
    if(!Array.isArray(c[k])) { fail(k,'必须是数组，未启用时用 []'); sets[k]=new Set(); continue; }
    sets[k]=new Set(); c[k].forEach((o,i)=>{if(!o||!o.id||sets[k].has(o.id)) fail(k+'['+i+'].id','缺失或重复'); else sets[k].add(o.id);});
  }
  if(lists.some(k=>!Array.isArray(c[k])))throw new Error('配置检查未通过：\n'+errors.join('\n'));
  const ref=(k,id,p)=>{if(!sets[k].has(id))fail(p,'不存在的 '+k+' 引用 '+id);};
  const rect=(r,p)=>{if(!r||!['x','y','w','h'].every(k=>Number.isFinite(r[k]))||r.w<=0||r.h<=0)fail(p,'需要有效的 x/y/w/h');};
  const cond=(v,p)=>{
    if(v==null||typeof v==='boolean') return;
    if(typeof v!=='object'||Array.isArray(v)) {fail(p,'条件必须是对象');return;}
    const keys=['all','any','not','flag','item','clue','quest','visited','discovered','counter','scene'].filter(k=>k in v);
    if(keys.length!==1) {fail(p,'每个条件必须有且仅有一个判定操作');return;}
    if(v.all||v.any){const a=v.all||v.any; if(!Array.isArray(a))fail(p,'all/any 必须是数组');else a.forEach((x,i)=>cond(x,p+'['+i+']'));}
    else if(v.not!==undefined)cond(v.not,p+'.not');
    else for(const [key,set] of [['item','items'],['clue','clues'],['quest','quests'],['visited','scenes'],['scene','scenes']]) if(v[key])ref(set,v[key],p);
    if(v.quest&&v.status&&!['locked','active','done'].includes(v.status))fail(p,'未知任务状态');
  };
  const actions=(as,p)=>{
    if(!Array.isArray(as)){fail(p,'actions 必须是数组');return;}
    as.forEach((a,i)=>{
      const at=p+'['+i+']'; if(!a||!kinds.has(a.type)){fail(at,'未知动作类型');return;}
      const group={give:'items',take:'items',clue:'clues',quest:'quests',achievement:'achievements',dialogue:'dialogues',scene:'scenes',ending:'endings',minigame:'minigames'}[a.type];
      if(group)ref(group,a.id,at);
      if(a.onSuccess)actions(a.onSuccess,at+'.onSuccess');
      if(a.onFailure)actions(a.onFailure,at+'.onFailure');
      if(a.type==='scene') {const s=c.scenes?.find(s=>s.id===a.id); if(s&&(!a.position||!canStand(a.position,s,s.collisions||[],c.player?.radius||7)))fail(at,'场景动作落点不可通行');}
      if(['give','take'].includes(a.type)&&a.count!==undefined&&(!Number.isSafeInteger(a.count)||a.count<1))fail(at,'数量必须是正整数');
      if(a.type==='quest'&&a.status&&!['locked','active','done'].includes(a.status))fail(at,'未知任务状态');
    });
  };
  if(!c.theme?.accent||!c.theme?.world)fail('theme','需要 accent 和 world 配色');
  if(!c.title||!c.description)fail('title/description','需要标题与简介');
  if(!c.endings.length)fail('endings','至少一个完整结局');
  if(c.start)ref('scenes',c.start.scene,'start.scene');else fail('start','缺少初始场景与位置');
  if(!c.player||!Number.isFinite(c.player.speed)||c.player.speed<=0)fail('player.speed','必须是正数');
  if(c.player?.character)ref('characters',c.player.character,'player.character');else fail('player.character','缺少角色');
  for(const a of c.assets||[]) if(!['image','audio'].includes(a.type)||!a.src)fail('assets.'+a.id,'需要 image/audio 类型和 src');
  if(c.music)ref('assets',c.music,'music');
  for(const [id,sound] of Object.entries(c.sounds||{}))ref('assets',sound,'sounds.'+id);
  for(const a of c.characters||[]) {
    const p='characters.'+a.id;ref('assets',a.asset,p+'.asset');
    if(!Number.isInteger(a.frameWidth)||a.frameWidth<=0||!Number.isInteger(a.frameHeight)||a.frameHeight<=0)fail(p,'缺少有效精灵帧尺寸');
    const count=a.frameCount??3,idle=a.idleFrame??1;
    if(!Number.isInteger(count)||count<1)fail(p+'.frameCount','帧数必须是正整数');
    if(!Number.isInteger(idle)||idle<0||idle>=count)fail(p+'.idleFrame','待机帧超出范围');
    if(a.frameDuration!==undefined&&(!Number.isFinite(a.frameDuration)||a.frameDuration<=0))fail(p+'.frameDuration','帧时长必须是正数');
    if(a.footAnchor&&(!Number.isFinite(a.footAnchor.x)||!Number.isFinite(a.footAnchor.y)||a.footAnchor.x<0||a.footAnchor.x>a.frameWidth||a.footAnchor.y<0||a.footAnchor.y>a.frameHeight))fail(p+'.footAnchor','脚点必须位于精灵格内');
  }
  const ids=new Set();
  const unique=(id,p)=>{if(!id||ids.has(id))fail(p,'场景对象 ID 必须全局唯一');else ids.add(id);};
  for(const s of c.scenes||[]) {
    const p='scenes.'+s.id;
    if(!Number.isFinite(s.width)||!Number.isFinite(s.height)||s.width<640||s.height<360)fail(p,'场景至少为 640×360');
    for(const [i,r] of (s.collisions||[]).entries())rect(r,p+'.collisions['+i+']');
    if(s.music)ref('assets',s.music,p+'.music');
    if(s.background)ref('assets',s.background,p+'.background');
    for(const o of s.objects||[]) {unique(o.id,p+'.objects');cond(o.when,p+'.objects.'+o.id+'.when');if(o.asset)ref('assets',o.asset,p+'.objects.'+o.id+'.asset');if(o.solid)rect(o.solid,p+'.objects.'+o.id+'.solid');}
    for(const npc of s.npcs||[]) {unique(npc.id,p+'.npcs');ref('characters',npc.character,p+'.npcs.'+npc.id);cond(npc.when,p+'.npcs.'+npc.id);}
    for(const e of s.interactions||[]) {unique(e.id,p+'.interactions');rect(e.rect,p+'.interactions.'+e.id);cond(e.when,p+'.interactions.'+e.id+'.when');if(e.hold!==undefined&&(!Number.isFinite(e.hold)||e.hold<=0))fail(p+'.interactions.'+e.id,'hold 必须为正数');
      for(const [i,b] of (e.branches||[]).entries()){cond(b.when,p+'.'+e.id+'.branches['+i+']');actions(b.actions||[],p+'.'+e.id+'.branches['+i+'].actions');}
      actions(e.actions||[],p+'.'+e.id+'.actions');
    }
    for(const e of s.exits||[]) {
      unique(e.id,p+'.exits');rect(e.rect,p+'.exits.'+e.id);ref('scenes',e.to,p+'.exits.'+e.id+'.to');cond(e.when,p+'.exits.'+e.id+'.when');
      const target=c.scenes.find(t=>t.id===e.to);if(target&&(!e.spawn||!canStand(e.spawn,target,target.collisions||[],c.player?.radius||7)))fail(p+'.exits.'+e.id+'.spawn','出口落点不可通行');
    }
    for(const t of s.triggers||[]) {unique(t.id,p+'.triggers');rect(t.rect,p+'.triggers.'+t.id);cond(t.when,p+'.triggers.'+t.id+'.when');actions(t.actions||[],p+'.triggers.'+t.id+'.actions');}
    for(const r of s.regions||[]) {unique(r.id,p+'.regions');rect(r,p+'.regions.'+r.id);}
    actions(s.onEnter||[],p+'.onEnter');
  }
  const first=c.scenes?.find(s=>s.id===c.start?.scene);if(first&&(!c.start.position||!canStand(c.start.position,first,first.collisions||[],c.player?.radius||7)))fail('start.position','初始位置不可通行');
  for(const d of c.dialogues||[]) {
    if(!Array.isArray(d.lines)||!d.lines.length)fail('dialogues.'+d.id,'至少一句 lines');
    for(const [i,l] of (d.lines||[]).entries())if(typeof l.text!=='string')fail('dialogues.'+d.id+'.lines['+i+']','需要 text');
    for(const [i,ch] of (d.choices||[]).entries()){if(!ch.label)fail('dialogues.'+d.id+'.choices['+i+']','需要 label');cond(ch.when,'dialogues.'+d.id+'.choices');actions(ch.actions||[],'dialogues.'+d.id+'.choices['+i+']');}
    actions(d.onComplete||[],'dialogues.'+d.id+'.onComplete');
  }
  for(const q of c.quests||[]){cond(q.unlock,'quests.'+q.id+'.unlock');cond(q.complete,'quests.'+q.id+'.complete');actions(q.onComplete||[],'quests.'+q.id+'.onComplete');if(q.target){ref('scenes',q.target.scene,'quests.'+q.id+'.target');const s=c.scenes.find(s=>s.id===q.target.scene);if(s&&!s.regions?.some(r=>r.id===q.target.region))fail('quests.'+q.id+'.target','目标区域不存在');}}
  for(const a of c.achievements||[])cond(a.when,'achievements.'+a.id+'.when');
  for(const e of c.endings||[]){cond(e.when,'endings.'+e.id+'.when');if(!e.pages?.length)fail('endings.'+e.id,'至少一页结局');for(const page of e.pages||[]){if(typeof page.text!=='string')fail('endings.'+e.id+'.pages','需要 text');if(page.image)ref('assets',page.image,'endings.'+e.id+'.pages.image');}}
  if(errors.length)throw new Error('配置检查未通过：\n'+errors.join('\n'));
  return c;
}
