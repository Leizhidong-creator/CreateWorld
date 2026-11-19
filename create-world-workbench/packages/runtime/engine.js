import {ActionAnimator} from './action-animation.js';
import { validateConfig } from './validate.js';
import { StoryStore, clone } from './state.js';
import { SaveManager } from './storage.js';
import { Input } from './input.js';
import { Resources, AudioService } from './resources.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { MiniGameHost } from './minigames.js';
import { moveBody, nearestInteraction, contains, canStand } from './geometry.js';
import { transitionScene } from './scene-transition.js';

/** @param {import('./types.js').GameConfig} config */
export function createGame(config,options={}) {
  validateConfig(config);
  const root=options.target||document.querySelector('#game');if(!root)throw new Error('找不到游戏挂载容器');
  root.classList.add('psk');root.tabIndex=0;root.style.setProperty('--accent',config.theme.accent);root.style.setProperty('--accent-soft',config.theme.accent+'22');
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;canvas.className='world';canvas.dataset.testid='game-canvas';canvas.setAttribute('aria-label',config.title+'：游戏场景');root.append(canvas);
  let storage;try{storage=options.storage??window.localStorage;}catch{storage=null;}
  const warnings=[];const save=new SaveManager(config,storage,text=>{warnings.push(text);ui?.toast(text);});let ui=null;
  const loaded=save.load(),store=new StoryStore(config,loaded.run,loaded.profile);
  const resources=new Resources(config.assets,config.assetBase||new URL('./',document.baseURI));
  const audio=new AudioService(resources,store.profile.settings);const renderer=new Renderer(canvas,resources,config);const animations=new ActionAnimator();renderer.actions=animations;
  let playing=false,started=false,destroyed=false,raf=0,last=0,target=null,hold=0,holdId=null,holdLatch=false,exitCooldown=0,saveTimer=0;
  const commands=[],actions=new Map(),miniRegistry=new Map(),triggerTimes=new Map(),triggerLatched=new Set();let mini=null,miniRequest=null,miniControls=null,activeCommand=null,settlingCommand=false;
  const persist=()=>{if(playing)store.run.pendingCommands=clone([...(activeCommand?[activeCommand]:[]),...commands]);return save.save(store);};
  const finishCommand=a=>{if(activeCommand===a)activeCommand=null;};
  // Acknowledge only after a valid transaction; persist reward + queue in one run snapshot.
  const completeCommand=(a,effects=[],onceId=null)=>{settlingCommand=true;try{store.commit(effects,onceId);finishCommand(a);}finally{settlingCommand=false;}persist();};
  const eventController=new AbortController();
  const scene=()=>config.scenes.find(s=>s.id===store.run.scene);
  const blocked=()=>!playing||!!ui?.kind;
  const solids=()=>[...(scene().collisions||[]),...(scene().objects||[]).filter(o=>o.solid&&store.test(o.when)).map(o=>o.solid)];
  const api={
    async start(){
      if(started||destroyed)return api;started=true;ui.loading();
      try{await resources.load(n=>{if(!destroyed)ui.loading(n);});if(destroyed)return api;ui.title(!!loaded.run&&!loaded.run.ending);for(const warning of warnings)ui.toast(warning);last=performance.now();raf=requestAnimationFrame(loop);}catch(e){if(!destroyed)ui.error(e.message);}return api;
    },
    pause(){if(playing&&!ui.kind){input.reset();ui.pause(store);}},
    resume(){if(ui.kind==='pause')ui.close();},
    registerAction(id,fn){if(actions.has(id))throw new Error('动作已注册：'+id);actions.set(id,fn);return ()=>actions.delete(id);},
    registerMiniGame(id,loader){if(!config.minigames.some(m=>m.id===id))throw new Error('先在配置 minigames 中声明 '+id);miniRegistry.set(id,loader);return ()=>miniRegistry.delete(id);},
    playAnimation(actor,name,options={}){const characterId=actor==='player'?config.player.character:scene().npcs?.find(n=>n.id===actor)?.character;const definition=config.characters.find(c=>c.id===characterId)?.animations?.[name];if(!definition)throw new Error('动作未声明：'+name);return animations.play(actor,definition,{...options,signal:eventController.signal});},
    getState(){return store.snapshot();},
    observe(){return clone({...store.snapshot(),ui:{kind:ui?.kind||null,minigameId:miniRequest?.id||null},target:target?{id:target.id,label:target.label}:null,revision:store.revision,trace:store.trace});},
    save(){return persist();},
    destroy(){if(destroyed)return;destroyed=true;cancelAnimationFrame(raf);if(playing)persist();eventController.abort();animations.destroy();mini?.destroy();input.destroy();audio.destroy();resources.destroy();store.clear();ui.destroy();canvas.remove();root.classList.remove('psk');}
  };
  const begin=fresh=>{
    commands.length=0;activeCommand=null;if(!fresh)commands.push(...clone(store.run.pendingCommands||[]));triggerTimes.clear();triggerLatched.clear();hold=0;holdId=null;holdLatch=false;
    if(fresh)store.restart();playing=true;ui.close();input.reset();exitCooldown=.7;
    const s=scene();if(!canStand(store.run.player,s,solids(),config.player.radius||7))Object.assign(store.run.player,s.spawn||config.start.position);
    audio.unlock();audio.setMusic(s.music||config.music);store.commit(s.onEnter||[],'enter:'+s.id);config.hooks?.enter?.(s.id,api);persist();
    if(!store.run.tutorialSeen&&config.features?.tutorial!==false)ui.help(()=>{store.run.tutorialSeen=true;persist();ui.close();});
  };
  const title=()=>{persist();playing=false;commands.length=0;input.reset();mini?.destroy();mini=null;ui.title(!store.run.ending);audio.setMusic(config.music);};
  const showMap=()=>{if(!playing||config.features?.map===false)return;if(ui.kind==='map'){ui.close();return;}if(!ui.kind)ui.map(scene(),store,store.currentQuest());};
  const showInventory=()=>{if(!playing)return;if(ui.kind==='inventory'||ui.kind==='item'){ui.close();return;}if(!ui.kind)ui.inventory(store);};
  const showAchievements=()=>{if(!playing)return;if(ui.kind==='achievements'){ui.close();return;}if(!ui.kind)ui.achievements(store);};
  const input=new Input(root,name=>{
    audio.unlock();
    if(name==='map'){showMap();return;}if(name==='inventory'){showInventory();return;}if(name==='achievements'){showAchievements();return;}
    if(name==='pause'){
      if(ui.kind==='dialogue'||ui.kind==='ending'||ui.kind==='title'||ui.kind==='loading'||ui.kind==='help')return;
      if(ui.kind==='minigame'){mini?.cancel();return;}if(ui.kind){ui.close();return;}api.pause();return;
    }
    if(name==='interact'){
      if(ui.kind==='minigame'&&miniControls?.onAction){miniControls.onAction();return;}
      if(ui.kind==='dialogue'){ui.advance();return;}
      if(ui.kind){const focused=document.activeElement;if(focused?.tagName==='BUTTON'&&ui.overlay.contains(focused))focused.click();return;}
      if(playing&&target&&!target.hold)interact(target);
    }
  });
  ui=new UI(root,config,{
    save:()=>persist(),map:showMap,inventory:showInventory,achievements:showAchievements,pause:()=>api.pause(),begin,title,
    modal:value=>{input.block(value||!playing);hold=0;holdId=null;},test:c=>store.test(c),assetUrl:id=>resources.urls.get(id),
    volume:(key,value)=>{store.profile.settings[key]=value;audio.volumes(store.profile.settings);save.write('profile',store.profile);},
    clear:()=>{if(!save.clearAll())return;playing=false;store.profile={achievements:{},endings:[],settings:{music:.25,sound:.45}};store.run=(new StoryStore(config)).run;audio.volumes(store.profile.settings);ui.title(false);}
  });
  store.on('notice',n=>{let text=n.text;if(n.kind==='item')text='获得物品 · '+config.items.find(i=>i.id===n.id)?.name;if(n.kind==='clue')text='记录线索 · '+config.clues.find(i=>i.id===n.id)?.name;if(text)ui.toast(text);audio.play(config.sounds?.notice);});
  store.on('achievement',id=>{const a=config.achievements.find(v=>v.id===id);ui.toast('发现新成就 · '+(a?.title||id));audio.play(config.sounds?.achievement);});
  store.on('command',a=>commands.push(a));
  store.on('change',()=>{if(playing&&!settlingCommand)persist();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){input.reset();if(playing){persist();if(!ui.kind)api.pause();}audio.suspend();}else audio.resume();},{signal:eventController.signal});
  window.addEventListener('pagehide',()=>{if(playing)persist();},{signal:eventController.signal});
  root.addEventListener('pointerdown',e=>{audio.unlock();if(e.target===canvas)root.focus({preventScroll:true});},{signal:eventController.signal});
  function enter(id,position){
    const old=scene();config.hooks?.exit?.(old.id,api);
    target=null;hold=0;triggerTimes.clear();triggerLatched.clear();input.reset();exitCooldown=.8;
    const s=transitionScene(store,config,id,position);
    audio.setMusic(s.music||config.music);config.hooks?.enter?.(id,api);persist();
  }
  function entries(){
    return [...(scene().interactions||[]),...(scene().exits||[]).filter(e=>!e.automatic).map(e=>({id:e.id,rect:e.rect,range:e.range||25,label:'进入',name:e.label||config.scenes.find(s=>s.id===e.to).name,
      branches:[{when:e.when,actions:[{type:'scene',id:e.to,position:e.spawn}]},{actions:[{type:'notice',text:e.lockedText||'这里暂时无法通行。'}]}]}))];
  }
  function interact(entry){
    if(blocked())return;
    const branch=entry.branches?.find(b=>store.test(b.when));const effects=branch?branch.actions:(entry.actions||[]);
    if(entry.once&&store.run.once.includes('interaction:'+entry.id)){ui.toast(entry.repeatText||'已经调查过了。');return;}
    audio.play(config.sounds?.interact);
    store.commit([{type:'count',id:entry.id},...effects],entry.once?'interaction:'+entry.id:null,branch?.when??entry.when);
  }
  async function runCommand(a){
    if(a.type==='scene'){finishCommand(a);enter(a.id,a.position);return;}
    if(a.type==='dialogue'){
      const d=config.dialogues.find(v=>v.id===a.id);ui.dialogueView(d,choice=>{try{completeCommand(a,[...(d.onComplete||[]),...(choice?.actions||[])],d.once?'dialogue:'+d.id:null);}catch(e){ui.error(e.message);}});return;
    }
    if(a.type==='ending'){
      finishCommand(a);
      const e=config.endings.find(v=>v.id===a.id);if(!store.test(e.when)){ui.toast('还有未完成的事情。');return;}
      store.run.ending=e.id;if(!store.profile.endings.includes(e.id))store.profile.endings.push(e.id);persist();ui.ending(e,title);return;
    }
    if(a.type==='minigame'){
      miniRequest=a;miniControls=null;const def=config.minigames.find(m=>m.id===a.id);const container=ui.minigame(def.title,()=>mini?.cancel());
      mini?.destroy();mini=new MiniGameHost(container,result=>{
        miniControls=null;ui.close();input.reset();const request=miniRequest;miniRequest=null;
        try{if(result.status==='success')completeCommand(a,(request.onSuccess||[]).map(effect=>effect.type==='custom'?{...effect,args:{...(effect.args||{}),result:clone(result.data??null)}}:effect),request.once?'mini:'+request.id:null);
        else if(result.status==='failure'){ui.toast('挑战未完成，可以再次尝试。');completeCommand(a,request.onFailure||[]);}
        else {finishCommand(a);if(result.status==='error')ui.toast('互动暂不可用：'+result.data.message);persist();}}catch(e){ui.error(e.message);}
      });for(const [id,loader] of miniRegistry)mini.register(id,loader);await mini.open(a.id,{input:()=>({...input.vector(),held:input.held}),useControls:options=>{miniControls=options;},state:store.snapshot()});return;
    }
    if(a.type==='custom'){const handler=actions.get(a.id);if(!handler)throw new Error('自定义动作未注册：'+a.id);const result=await handler({args:a.args,state:store.snapshot(),signal:eventController.signal});if(!destroyed&&Array.isArray(result))completeCommand(a,result);else{finishCommand(a);persist();}}
  }
  let executing=false;
  function pump(){if(executing||blocked()||!commands.length)return;executing=true;const command=commands.shift();activeCommand=command;persist();Promise.resolve(runCommand(command)).catch(e=>ui.error(e.message)).finally(()=>{executing=false;});}
  function update(dt){
    const s=scene(),p=store.run.player,v=input.vector();store.run.elapsed+=dt;exitCooldown=Math.max(0,exitCooldown-dt);
    if(v.x||v.y)p.facing=Math.abs(v.x)>Math.abs(v.y)?(v.x>0?'right':'left'):(v.y>0?'down':'up');
    const before={x:p.x,y:p.y};moveBody(p,v.x*config.player.speed*dt,v.y*config.player.speed*dt,s,solids(),config.player.radius||7);p.moving=Math.hypot(p.x-before.x,p.y-before.y)>.01;
    const explored=new Set(store.run.explored[s.id]||[]);for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)explored.add((Math.floor(p.x/64)+x)+','+(Math.floor(p.y/64)+y));store.run.explored[s.id]=[...explored];
    target=nearestInteraction(p,entries(),c=>store.test(c));
    if(!input.held){hold=0;holdId=null;holdLatch=false;}
    if(!target?.hold){hold=0;holdId=null;}
    if(target?.hold&&input.held&&!holdLatch){if(holdId!==target.id){hold=0;holdId=target.id;}hold+=dt;if(hold>=target.hold){holdLatch=true;hold=0;interact(target);}}
    for(const t of s.triggers||[]){const inside=contains(t.rect,p)&&store.test(t.when);if(!inside){triggerTimes.delete(t.id);triggerLatched.delete(t.id);continue;}if(triggerLatched.has(t.id))continue;if(t.once!==false&&store.run.once.includes('trigger:'+t.id))continue;const time=(triggerTimes.get(t.id)||0)+dt;triggerTimes.set(t.id,time);if(time>=(t.wait||0)){triggerLatched.add(t.id);store.commit(t.actions||[],t.once===false?null:'trigger:'+t.id);triggerTimes.set(t.id,0);}}
    if(exitCooldown===0)for(const e of s.exits||[])if(e.automatic&&contains(e.rect,p)&&store.test(e.when)){enter(e.to,e.spawn);break;}
    config.hooks?.update?.(s.id,dt,api);
    saveTimer+=dt;if(saveTimer>5){persist();saveTimer=0;}
  }
  function loop(now){
    if(destroyed)return;const dt=Math.min(.05,(now-last)/1000);last=now;
    try{
      ui.tick(dt);pump();if(!blocked()&&!executing)update(dt);else store.run.player.moving=false;
      animations.tick(blocked()?0:dt);renderer.scene(scene(),store,store.run.player,blocked()?null:target,blocked()?0:dt,target?.hold?hold/target.hold:0);
      config.hooks?.render?.(scene().id,renderer.ctx,api);ui.update(scene(),store,target,playing);
      input.block(blocked()&&ui.kind!=='minigame');
      if(ui.kind==='minigame')input.context(miniControls?.actionLabel||'交互',!!miniControls,true);
      else input.context(target?.hold?'长按'+target.label:target?.label,playing&&!ui.kind,!!target);
      raf=requestAnimationFrame(loop);
    }catch(e){input.block(true);ui.error(e.message);}
  }
  return api;
}
