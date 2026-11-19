(() => {
  'use strict';
  const data = structuredClone(window.__SKILL_GAME_DATA__);
  delete window.__SKILL_GAME_DATA__;
  const byId = new Map(data.interactions.map(a => [a.id, a]));
  const variables = new Map(data.state.variables.map(v => [v.id, v]));
  const screens = new Map(data.flow.screens.map(s => [s.id, s]));
  const el = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const canonical = value => {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    return JSON.stringify(value);
  };
  const initial = () => ({screenId:data.flow.startScreen,values:Object.fromEntries(data.state.variables.map(v=>[v.id,v.initial])),completed:[]});
  let state = initial(), trace = [], paused = false;
  function guardMet(guard, values) {
    return guard.every(c => {
      const a = values[c.var], b = c.value;
      return ({eq:()=>a===b,ne:()=>a!==b,lt:()=>a<b,lte:()=>a<=b,gt:()=>a>b,gte:()=>a>=b})[c.op]();
    });
  }
  function validValue(v, value) {
    if(v.type==='bool') return typeof value==='boolean';
    if(v.type==='int') return Number.isSafeInteger(value)&&value>=v.min&&value<=v.max;
    return typeof value==='string'&&v.values.includes(value);
  }
  function reducer(old, id) {
    const a = byId.get(id);
    if(data.flow.terminals.includes(old.screenId)) throw Error('旅程已结束，请重新开始。');
    if(!a || a.screenId!==old.screenId) throw Error('此处没有这项行动。');
    if(a.repeat==='once'&&old.completed.includes(id)) throw Error('这项行动已经完成。');
    if(!guardMet(a.guard,old.values)) throw Error(a.failure);
    const values = {...old.values};
    for(const e of a.effects){
      const value=e.op==='set'?e.value:old.values[e.var]+e.value;
      if(!validValue(variables.get(e.var),value)) throw Error('行动会使状态越界，已保持原进度。');
      values[e.var]=value;
    }
    if(!data.state.invariants.every(i=>!guardMet(i.if,values)||guardMet(i.then,values))) throw Error('行动不符合世界规则，已保持原进度。');
    return {screenId:a.targetScreen,values,completed:a.repeat==='once'?[...old.completed,id].sort():[...old.completed]};
  }
  function render(){
    const screen=screens.get(state.screenId), terminal=data.flow.terminals.includes(state.screenId);
    el('game').dataset.screenId=state.screenId;
    el('game').dataset.terminal=String(terminal);
    el('game').dataset.paused=String(paused);
    el('game-title').textContent=data.title;
    document.title=data.title;
    el('screen-title').textContent=paused?'旅程已暂停':screen.title;
    el('screen-kind').textContent=terminal?'旅程结束':({title:'开始',world:'探索',dialogue:'交谈',puzzle:'解谜',journal:'记录',pause:'暂停'})[screen.kind];
    el('scene-description').textContent=screen.description||(terminal?'这个结局由刚才的行动决定。你可以保存，或重新开始另一条旅程。':'观察当前状态，选择下一步行动。');
    el('actions').replaceChildren();
    for(const a of data.interactions.filter(a=>a.screenId===state.screenId)){
      const button=document.createElement('button');
      button.textContent=a.label;button.dataset.actionId=a.id;
      button.dataset.available=String(guardMet(a.guard,state.values)&&!(a.repeat==='once'&&state.completed.includes(a.id)));
      button.disabled=paused||terminal;
      button.title=a.input;
      button.addEventListener('click',()=>{
        if(paused)return;
        try{const next=reducer(state,a.id);if(trace.length>=20000)throw Error('行动记录达到上限，请重新开始新旅程。');state=next;trace.push(a.id);render();el('feedback').textContent=a.feedback;}
        catch(error){el('feedback').textContent=error.message;}
      });
      el('actions').append(button);
    }
    el('state-values').replaceChildren();
    for(const v of data.state.variables){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=v.label||v.id;dd.textContent=typeof state.values[v.id]==='boolean'?(state.values[v.id]?'是':'否'):String(state.values[v.id]);el('state-values').append(dt,dd);}
    el('scene-media').replaceChildren();
    for(const id of screen.assetIds||[]){const asset=data.assembly.assets.find(a=>a.id===id);const audio=/\.(wav|ogg|mp3)$/i.test(asset.path);const node=document.createElement(audio?'audio':'img');node.src=asset.path;if(audio)node.controls=true;else node.alt=asset.alt||screen.title;el('scene-media').append(node);}
    el('pause-game').hidden=paused;el('resume-game').hidden=!paused;
  }
  el('pause-game').addEventListener('click',()=>{paused=true;render();el('feedback').textContent='进度已暂停。';});
  el('resume-game').addEventListener('click',()=>{paused=false;render();el('feedback').textContent='继续旅程。';});
  el('restart-game').addEventListener('click',()=>{state=initial();trace=[];paused=false;render();el('feedback').textContent='已重新开始。';});
  el('export-save').addEventListener('click',()=>{el('save-data').value=JSON.stringify({schemaVersion:1,bundleSha256:data.bundleSha256,...state,trace});el('feedback').textContent='已生成存档代码，可复制保存。';});
  el('import-save').addEventListener('click',()=>{
    try{
      const raw=el('save-data').value;if(raw.length>2*1024*1024)throw Error('存档过大。');
      const save=JSON.parse(raw);
      if(!save||save.schemaVersion!==1||save.bundleSha256!==data.bundleSha256)throw Error('存档不属于当前版本。');
      if(!Array.isArray(save.trace)||save.trace.length>20000||save.trace.some(a=>typeof a!=='string'))throw Error('存档行动记录无效。');
      let next=initial();for(const id of save.trace)next=reducer(next,id);
      if(canonical(next)!==canonical({screenId:save.screenId,values:save.values,completed:save.completed}))throw Error('存档状态与行动记录不一致。');
      state=next;trace=[...save.trace];paused=false;render();el('feedback').textContent='存档已恢复。';
    }catch(error){el('feedback').textContent='无法载入：'+error.message;}
  });
  Object.defineProperty(window,'__SKILL_GAME_STATE__',{get:()=>clone({bundleSha256:data.bundleSha256,...state,trace,paused}),configurable:false});
  render();
})();
