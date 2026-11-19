import { drawMap } from './render.js';
export function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
export function button(label,action,cls='button'){const b=el('button',cls,label);b.type='button';b.addEventListener('click',action);return b;}
export class UI {
  constructor(root,config,callbacks){
    this.root=root;this.config=config;this.cb=callbacks;this.kind=null;this.dialogue=null;this.generation=0;this.lastFocus=null;
    this.hud=el('header','hud');this.mapButton=button('',()=>callbacks.map(),'map-button');this.mapButton.setAttribute('aria-label','展开地图 M');this.mini=el('canvas');this.mini.width=180;this.mini.height=110;this.mapButton.append(this.mini,el('span','map-caption','地图 · M'));
    this.place=el('div','place');this.sceneName=el('div','scene-name');this.goal=el('div','goal');this.place.append(el('div','eyebrow','CURRENT OBJECTIVE'),this.sceneName,this.goal);
    const nav=el('nav','toolbar');nav.setAttribute('aria-label','游戏菜单');nav.append(button('物品 I',()=>callbacks.inventory(),'tool'),button('成就 J',()=>callbacks.achievements(),'tool'),button('暂停',()=>callbacks.pause(),'tool'));this.hud.append(this.mapButton,this.place,nav);
    this.context=el('div','context-label');this.context.setAttribute('aria-live','polite');
    this.overlay=el('section','overlay');this.overlay.hidden=true;this.overlay.setAttribute('role','dialog');this.overlay.setAttribute('aria-modal','true');
    this.toastBox=el('div','toasts');this.toastBox.setAttribute('aria-live','polite');this.toastTimers=new Set();root.append(this.hud,this.context,this.overlay,this.toastBox);
    this.keyTrap=e=>{if(e.key!=='Tab'||!this.kind)return;const buttons=[...this.overlay.querySelectorAll('button:not(:disabled),input,a')].filter(e=>!e.hidden);if(!buttons.length){e.preventDefault();return;}const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&(document.activeElement===first||!this.overlay.contains(document.activeElement))){last.focus();e.preventDefault();}else if(!e.shiftKey&&(document.activeElement===last||!this.overlay.contains(document.activeElement))){first.focus();e.preventDefault();}};
    root.addEventListener('keydown',this.keyTrap);
  }
  show(kind,title,sub=''){
    ++this.generation;this.dialogue=null;this.kind=kind;this.cb.modal(true);this.hud.inert=true;this.overlay.replaceChildren();this.overlay.hidden=false;this.overlay.className='overlay '+kind;
    const panel=el('div','panel');panel.tabIndex=-1;this.overlay.append(panel);this.overlay.setAttribute('aria-label',title);
    if(title){const head=el('div','panel-head');head.append(el('div','eyebrow',sub||'PIXEL STORY KIT'),el('h1',null,title));panel.append(head);}this.panel=panel;return panel;
  }
  focus(){this.overlay.querySelector('button,input,a')?.focus({preventScroll:true});}
  close(){++this.generation;this.kind=null;this.dialogue=null;this.overlay.hidden=true;this.overlay.replaceChildren();this.hud.inert=false;this.cb.modal(false);this.root.focus({preventScroll:true});}
  loading(progress=0){if(this.kind!=='loading'){const p=this.show('loading','准备进入故事','LOADING');this.progress=el('progress');this.progress.max=1;p.append(this.progress);}this.progress.value=progress;}
  error(message){const p=this.show('error','暂时无法进入故事','PLEASE CHECK');p.append(el('p','body-copy',message),button('重新加载',()=>location.reload()));this.focus();}
  title(hasSave){
    const p=this.show('title',this.config.title,this.config.subtitle);p.append(el('p','intro',this.config.description));
    const line=el('div','title-facts');line.append(el('span',null,'2D 像素剧情'),el('span',null,'键盘 / 触屏'),el('span',null,'约 5 分钟'));p.append(line);
    const actions=el('div','actions');if(hasSave)actions.append(button('继续故事',()=>this.cb.begin(false),'button primary'));actions.append(button(hasSave?'重新开始':'开始探索',()=>hasSave?this.confirm('重新开始？','本局剧情与物品将重置，已解锁成就和设置保留。',()=>this.cb.begin(true),()=>this.title(true)):this.cb.begin(true),hasSave?'button':'button primary'));p.append(actions);
    if(this.config.alternate){const alternate=el('a','switch-theme',this.config.alternate.label);alternate.href=this.config.alternate.href;p.append(alternate);}p.append(el('p','fine','WASD / 方向键移动 · E / 空格交互 · M 地图'));
    this.focus();
  }
  confirm(title,text,yes,no){const p=this.show('confirm',title);p.append(el('p','body-copy',text));const row=el('div','actions');row.append(button('取消',no),button('确认',yes,'button primary'));p.append(row);this.focus();}
  pause(store){
    const p=this.show('pause','停留片刻','PAUSED');p.append(el('p','body-copy','故事会在这里等你。'));const row=el('div','actions vertical');row.append(button('继续游戏',()=>this.close(),'button primary'),button('声音设置',()=>this.settings(store)),button('操作说明',()=>this.help(()=>this.pause(store))),button('保存并返回标题',()=>this.cb.title()));p.append(row);this.focus();
  }
  settings(store){const p=this.show('settings','声音与记录','SETTINGS');for(const [key,label] of [['music','背景音乐'],['sound','操作音效']]){const row=el('label','setting');const slider=el('input');slider.type='range';slider.min=0;slider.max=1;slider.step=.05;slider.value=store.profile.settings[key];slider.setAttribute('aria-label',label);slider.addEventListener('input',()=>this.cb.volume(key,Number(slider.value)));row.append(el('span',null,label),slider);p.append(row);}p.append(button('清除本游戏全部记录',()=>this.confirm('清除全部记录？','将清除本游戏进度、成就、结局与设置，无法撤销。其他游戏不受影响。',()=>this.cb.clear(),()=>this.settings(store)),'button danger'),button('返回暂停',()=>this.pause(store)));this.focus();}
  help(done){const p=this.show('help','从这里开始','HOW TO PLAY');const table=el('div','help-grid');for(const [key,text] of [['WASD / ↑↓←→','移动角色；手机使用左下摇杆'],['E / 空格','靠近人物或物件进行交互'],['M / 点击地图','查看区域；金色方框指向相关区域'],['I / J / Esc','查看物品 / 成就 / 暂停']]){table.append(el('strong',null,key),el('span',null,text));}p.append(table,el('p','fine','右侧按钮会随情境改变。进入提示区域后，请自行寻找人物与物件。'),button('开始探索',done,'button primary'));this.focus();}
  dialogueView(def,done){
    this.show('dialogue','','');this.dialogue={def,index:0,done,shown:0,elapsed:0,ready:false};this.renderLine();
  }
  renderLine(){
    const d=this.dialogue;this.panel.replaceChildren();const line=d.def.lines[d.index];d.shown=0;d.elapsed=0;d.ready=false;
    this.panel.append(el('div','speaker',line.speaker||'旁白'));this.text=el('p','dialogue-text','');this.panel.append(this.text);this.dialogueActions=el('div','dialogue-actions');this.panel.append(this.dialogueActions);this.continueButton=button('继续 · E',()=>this.advance(),'button subtle');this.dialogueActions.append(this.continueButton);this.focus();
  }
  tick(dt){const d=this.dialogue;if(!d||d.ready)return;d.elapsed+=dt;d.shown=Math.min(d.def.lines[d.index].text.length,Math.floor(d.elapsed*38));this.text.textContent=d.def.lines[d.index].text.slice(0,d.shown);if(d.shown===d.def.lines[d.index].text.length)this.lineReady();}
  lineReady(){const d=this.dialogue;if(!d)return;d.ready=true;this.text.textContent=d.def.lines[d.index].text;if(d.index===d.def.lines.length-1&&d.def.choices?.length){this.dialogueActions.replaceChildren();for(const choice of d.def.choices)if(this.cb.test(choice.when))this.dialogueActions.append(button(choice.label,()=>{const done=d.done;this.close();done(choice);},'button choice'));if(!this.dialogueActions.children.length)this.dialogueActions.append(button('结束交谈',()=>{const done=d.done;this.close();done(null);}));this.focus();}}
  advance(){const d=this.dialogue;if(!d)return;if(!d.ready){this.lineReady();return;}if(d.index<d.def.lines.length-1){d.index++;this.renderLine();return;}if(d.def.choices?.length){this.focus();return;}const done=d.done;this.close();done(null);}
  map(scene,store,quest){const p=this.show('map','区域地图',scene.name);const canvas=el('canvas','large-map');canvas.width=640;canvas.height=340;drawMap(canvas,scene,store,quest,this.config,true);p.append(canvas,el('p','fine','● 青色：你的位置　□ 金色：相关区域或出口　■ 深色：未探索区域'),button('收起地图 · M',()=>this.close()));this.focus();}
  inventory(store){const p=this.show('inventory','随身物品','INVENTORY & NOTES');const list=el('div','item-list');let count=0;for(const item of this.config.items)if(store.run.items[item.id]){count++;const card=button('',()=>{const detail=this.show('item',item.name,'ITEM DETAIL');detail.append(el('div','item-icon large',item.icon||'◇'),el('p','body-copy',item.description),el('p','document',item.content||'靠近对应目标，使用交互按钮即可。'),button('返回物品',()=>this.inventory(store)));this.focus();},'item-card');card.append(el('span','item-icon',item.icon||'◇'),el('strong',null,item.name),el('span','fine','数量 '+store.run.items[item.id]));list.append(card);}if(!count)list.append(el('p','body-copy','暂时没有携带物品。'));p.append(list);if(this.config.features?.clueNotebook){p.append(el('h2',null,'已知线索'));for(const clue of this.config.clues)if(store.run.clues.includes(clue.id))p.append(el('p','note',clue.name+' · '+clue.description));}p.append(button('返回探索',()=>this.close()));this.focus();}
  achievements(store){const p=this.show('achievements','探索的痕迹','DISCOVERIES');const list=el('div','achievement-list');for(const a of this.config.achievements){const unlocked=!!store.profile.achievements[a.id];const card=el('article','achievement '+(unlocked?'unlocked':''));card.append(el('span','badge',unlocked?(a.icon||'✦'):'?'),el('strong',null,unlocked?a.title:'未发现'),el('p','fine',unlocked?a.description:'一个尚未揭开的秘密'));list.append(card);}p.append(list,button('返回探索',()=>this.close()));this.focus();}
  ending(def,onDone){let page=0;const render=()=>{const data=def.pages[page],p=this.show('ending',data.title||def.title,'EPILOGUE · '+(page+1)+' / '+def.pages.length);if(data.image){const img=el('img','ending-image');img.src=this.cb.assetUrl(data.image);img.alt=data.title||def.title;p.append(img);}p.append(el('p','ending-copy',data.text),button(page===def.pages.length-1?'返回标题':'继续',()=>{if(++page<def.pages.length)render();else onDone();},'button primary'));this.focus();};render();}
  minigame(title,cancel){const p=this.show('minigame',title,'INTERACTIVE SCENE');const container=el('div','mini-container');p.append(container,button('退出互动',cancel));this.focus();return container;}
  toast(text){const node=el('div','toast',text);this.toastBox.append(node);while(this.toastBox.children.length>3)this.toastBox.firstChild.remove();const timer=setTimeout(()=>{node.remove();this.toastTimers.delete(timer);},4200);this.toastTimers.add(timer);}
  update(scene,store,target,playing){this.hud.hidden=!playing;this.context.hidden=!playing||!!this.kind;this.sceneName.textContent=scene.name;const quest=store.currentQuest();this.goal.textContent=quest?.title||'自由探索';this.context.textContent=target?(target.label||'交互')+' · '+(target.name||'E / 空格'):'';this.mapButton.hidden=this.config.features?.map===false;drawMap(this.mini,scene,store,quest,this.config);}
  destroy(){for(const t of this.toastTimers)clearTimeout(t);this.root.removeEventListener('keydown',this.keyTrap);this.hud.remove();this.context.remove();this.overlay.remove();this.toastBox.remove();}
}
