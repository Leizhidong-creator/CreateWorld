import {FLAGS,DT,initialStory,legalPosition,moveBody,nearbyTarget,rotateMask,initialPower,powerSolved,guidanceInitial,guidanceStep,wrapAngle,replayGuidance,dialogueBranch,storyEvent,commitStoryEvent,createSave,validateSave} from './engine.js';
(() => {
  'use strict';
  const room=JSON.parse(JSON.stringify(window.__ROOM_DATA__)),fingerprint=room.fingerprint;
  delete window.__ROOM_DATA__;
  const $=id=>document.getElementById(id),canvas=$('world'),ctx=canvas.getContext('2d'),images=new Map();
  canvas.width=room.width;canvas.height=room.height;ctx.imageSmoothingEnabled=false;
  let player={...room.spawn},story=initialStory(),history=[],power=initialPower(room.modules.power),guidanceInputs=[],guidance=guidanceInitial(room.modules.guidance);
  let mode='loading',started=false,paused=false,saveOpen=false,helpOpen=false,dialogue=null,moving=false,lastTime=0,accumulator=0,walkTime=0,pointerGuidance=0;
  const keys=new Set(),touchMoves=new Set();
  const characterById=new Map(room.characters.map(c=>[c.id,c]));
  const feed=text=>{$('feedback').textContent=text;};
  function clearInput(){keys.clear();touchMoves.clear();pointerGuidance=0;moving=false;accumulator=0;}
  function commit(event){const committed=commitStoryEvent(room,story,history,event);history=committed.history;story=committed.story;updateHud();}
  function activeOverlay(){return helpOpen?$('help-overlay'):saveOpen?$('save-overlay'):paused?$('pause-overlay'):['dialogue','power','guidance','ending'].includes(mode)?$(mode+'-overlay'):mode==='loading'?$('loading'):null;}
  function returnFocus(){const overlay=activeOverlay();(overlay?.querySelector('button:not(:disabled),textarea')||canvas).focus({preventScroll:true});}
  function showMode(next){clearInput();mode=next;for(const id of ['dialogue','power','guidance','ending'])$(id+'-overlay').hidden=mode!==id;updateHud();}
  function updateHud(){
    $('title').textContent=room.title;$('subtitle').textContent=room.subtitle;document.title=room.title;
    $('objectives').replaceChildren(...[['briefed','向同伴听取任务简报'],['powerReady','连接辅助供电线路'],['guidanceReady','完成着陆姿态训练']].map(([flag,label])=>{const li=document.createElement('li');li.textContent=(story[flag]?'✓ ':'◇ ')+label;li.className=story[flag]?'done':'';return li;}));
    const near=nearbyTarget(room,player);
    $('prompt').textContent=mode==='explore'?(near?'E · '+near.label:'走近同伴或设备，按 E 交互。'):mode==='ending'?'准备完成。':'当前操作界面打开，世界移动已暂停。';
    $('interact').disabled=!started||mode!=='explore'||paused||saveOpen||helpOpen;
    document.querySelectorAll('[data-move]').forEach(b=>b.disabled=!started||mode!=='explore'||paused||saveOpen||helpOpen);
    $('pause').disabled=!started||mode==='ending';$('open-save').disabled=!started;
    $('ending-title').textContent=room.ending.title;$('ending-text').textContent=room.ending.text;
  }
  function start(){player={...room.spawn};story=initialStory();history=[];power=initialPower(room.modules.power);guidanceInputs=[];guidance=guidanceInitial(room.modules.guidance);started=true;paused=false;saveOpen=false;helpOpen=false;dialogue=null;$('loading').hidden=true;$('pause-overlay').hidden=true;$('save-overlay').hidden=true;$('help-overlay').hidden=true;showMode('explore');feed('在任务舱内自由移动，先与同伴交谈。');returnFocus();}
  function openDialogue(target){
    const branch=dialogueBranch(room,target.dialogueId,story);
    if(!branch){feed('当前没有可用对话。');return;}
    dialogue={target,branch,index:0};showMode('dialogue');renderDialogue();$('dialogue-next').focus();
  }
  function renderDialogue(){const line=dialogue.branch.lines[dialogue.index];$('dialogue-name').textContent=dialogue.target.label||dialogue.target.name;$('speaker').textContent=line.speaker;$('dialogue-text').textContent=line.text;$('dialogue-next').textContent=dialogue.index===dialogue.branch.lines.length-1?'完成交谈':'下一句';}
  function advanceDialogue(){
    if(mode!=='dialogue'||paused||saveOpen||helpOpen)return;
    if(dialogue.index+1<dialogue.branch.lines.length){dialogue.index++;renderDialogue();return;}
    const {target,branch}=dialogue;
    if(target.kind==='egg'){
      if(!story[target.eggFlag])commit({type:'egg',id:target.id,branchId:branch.id});
      feed('发现了一段可选的舱内细节。');
    }else{commit({type:'dialogue',id:target.id,branchId:branch.id});feed('交谈结束。');}
    dialogue=null;showMode('explore');returnFocus();
  }
  function cancelOverlay(){if(paused||saveOpen||helpOpen)return;if(['dialogue','power','guidance'].includes(mode)){dialogue=null;showMode('explore');feed('已返回任务舱，进度保留，未完成操作不会获得奖励。');returnFocus();}}
  function interact(){
    if(!started||mode!=='explore'||paused||saveOpen||helpOpen)return;
    const target=nearbyTarget(room,player);if(!target){feed('先靠近人物或设备。');return;}
    if((target.requires||[]).some(f=>!story[f])){feed(target.lockedText||'先完成任务简报。');return;}
    if(target.kind==='npc'||target.kind==='egg'){openDialogue(target);return;}
    if(target.kind==='power'){
      if(story.powerReady){feed('辅助电源已稳定，不需要重复操作。');return;}
      showMode('power');renderPower();$('power-grid').querySelector('button:not(:disabled)')?.focus();return;
    }
    if(target.kind==='guidance'){
      if(story.guidanceReady){feed('姿态训练已经通过，不重复计入完成。');return;}
      showMode('guidance');$('guidance-reset').focus();return;
    }
    if(target.kind==='exit'){
      if(!story.briefed||!story.powerReady||!story.guidanceReady){feed('先听取简报，再完成供电与姿态训练。');return;}
      commit({type:'finish'});showMode('ending');$('ending-restart').focus();
    }
  }
  function renderPower(){
    const input=room.modules.power.start,output=room.modules.power.goal;
    $('power-input').textContent=`输入 →`;$('power-output').textContent=`→ 输出`;
    $('power-input').style.top=`${(input.row+.5)/room.modules.power.size*100}%`;
    $('power-output').style.top=`${(output.row+.5)/room.modules.power.size*100}%`;
    $('power-instructions').textContent=`仅亮色线路块可以旋转，暗色块固定。输入在第 ${input.row+1} 行左侧，输出在第 ${output.row+1} 行右侧；让实际端口连成完整通路后检测。`;
    $('power-grid').style.gridTemplateColumns=`repeat(${room.modules.power.size},1fr)`;
    $('power-grid').replaceChildren(...room.modules.power.tiles.map((tile,index)=>{
      const button=document.createElement('button');button.className='power-tile';button.dataset.tile=String(index);button.disabled=tile.locked;
      const mask=rotateMask(tile.mask,power[index]);button.setAttribute('aria-label',`线路 ${index+1}，方向 ${power[index]}${tile.locked?'，固定':''}`);
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 80 80');
      for(const [port,x,y] of [[1,40,0],[2,80,40],[4,40,80],[8,0,40]])if(mask&port){const line=document.createElementNS(svg.namespaceURI,'line');for(const [k,v]of Object.entries({x1:40,y1:40,x2:x,y2:y,stroke:'#d5b77b','stroke-width':12}))line.setAttribute(k,String(v));svg.append(line);}
      const center=document.createElementNS(svg.namespaceURI,'circle');center.setAttribute('cx','40');center.setAttribute('cy','40');center.setAttribute('r','10');center.setAttribute('fill',tile.locked?'#627c88':'#e5c98e');svg.append(center);button.append(svg);
      button.addEventListener('click',()=>{if(mode!=='power'||paused||saveOpen||helpOpen||tile.locked)return;power[index]=(power[index]+1)%4;renderPower();$('power-grid').querySelector(`[data-tile="${index}"]`).focus();$('power-status').textContent='线路已旋转，检测将验证实际端口连接。';});return button;
    }));
  }
  function checkPower(){if(mode!=='power'||paused||saveOpen||helpOpen)return;if(powerSolved(room.modules.power,power)){commit({type:'power',rotations:[...power]});showMode('explore');feed('线路贯通，辅助电源恢复。');returnFocus();}else $('power-status').textContent='检测失败：输入与输出尚未形成连续线路。继续调整或重置。';}
  function guidanceInput(){return pointerGuidance|(keys.has('arrowleft')||keys.has('a')?1:0)|(keys.has('arrowright')||keys.has('d')?2:0)|(keys.has(' ')?4:0);}
  function tick(){
    if(!started||paused||saveOpen||helpOpen)return;
    if(mode==='explore'){
      let dx=(keys.has('arrowright')||keys.has('d')||touchMoves.has('right')?1:0)-(keys.has('arrowleft')||keys.has('a')||touchMoves.has('left')?1:0);
      let dy=(keys.has('arrowdown')||keys.has('s')||touchMoves.has('down')?1:0)-(keys.has('arrowup')||keys.has('w')||touchMoves.has('up')?1:0);
      const length=Math.hypot(dx,dy);moving=length>0;
      if(moving){dx/=length;dy/=length;player.direction=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');const old=player;player=moveBody(room,player,dx*room.player.speed*DT,dy*room.player.speed*DT);moving=Math.hypot(old.x-player.x,old.y-player.y)>1e-7;if(moving)walkTime+=DT;updateHud();}
    }else if(mode==='guidance'&&!guidance.success&&!guidance.failed){
      const input=guidanceInput();guidanceInputs.push(input);guidance=guidanceStep(room.modules.guidance,guidance,input);
      if(guidance.success){commit({type:'guidance',inputs:[...guidanceInputs]});showMode('explore');feed('姿态与角速度稳定，训练校准通过。');returnFocus();}
    }
  }
  function sprite(characterId,at,isMoving=false){const char=characterById.get(characterId);const frame=isMoving?Math.floor(walkTime*1000/char.frameMs)%4:0;const sheet=images.get(char.sheets[at.direction||'down']);ctx.drawImage(sheet,frame*char.cell.width,0,char.cell.width,char.cell.height,Math.round(at.x-char.footAnchor.x*char.scale),Math.round(at.y-char.footAnchor.y*char.scale),char.cell.width*char.scale,char.cell.height*char.scale);}
  function playerOccluded(){
    const char=characterById.get(room.player.characterId),r={x:player.x-char.footAnchor.x*char.scale,y:player.y-char.footAnchor.y*char.scale,width:char.cell.width*char.scale,height:char.cell.height*char.scale},floor=room.walkable;
    return r.x<floor.x||r.y<floor.y||r.x+r.width>floor.x+floor.width||r.y+r.height>floor.y+floor.height||room.obstacles.some(o=>player.y<o.y+o.height-1e-6&&r.x<o.x+o.width&&r.x+r.width>o.x&&r.y<o.y+o.height&&r.y+r.height>o.y);
  }
  const silhouette=document.createElement('canvas'),outline=document.createElement('canvas');
  function drawOccludedOutline(){
    const char=characterById.get(room.player.characterId),frame=moving&&mode==='explore'&&!paused&&!saveOpen&&!helpOpen?Math.floor(walkTime*1000/char.frameMs)%4:0;
    silhouette.width=char.cell.width;silhouette.height=char.cell.height;const mask=silhouette.getContext('2d');mask.drawImage(images.get(char.sheets[player.direction]),frame*char.cell.width,0,char.cell.width,char.cell.height,0,0,char.cell.width,char.cell.height);mask.globalCompositeOperation='source-in';mask.fillStyle='#a4dce8';mask.fillRect(0,0,silhouette.width,silhouette.height);
    outline.width=char.cell.width+2;outline.height=char.cell.height+2;const edge=outline.getContext('2d');for(const [dx,dy]of [[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2]])edge.drawImage(silhouette,dx,dy);edge.globalCompositeOperation='destination-out';edge.drawImage(silhouette,1,1);
    const floor=room.walkable;ctx.save();ctx.beginPath();ctx.rect(0,0,room.width,floor.y);ctx.rect(0,floor.y, floor.x,floor.height);ctx.rect(floor.x+floor.width,floor.y,room.width-floor.x-floor.width,floor.height);ctx.rect(0,floor.y+floor.height,room.width,room.height-floor.y-floor.height);
    for(const obstacle of room.obstacles)if(player.y<obstacle.y+obstacle.height-1e-6)ctx.rect(obstacle.x,obstacle.y,obstacle.width,obstacle.height);
    ctx.clip();ctx.globalAlpha=.8;ctx.drawImage(outline,Math.round(player.x-(char.footAnchor.x+1)*char.scale),Math.round(player.y-(char.footAnchor.y+1)*char.scale),outline.width*char.scale,outline.height*char.scale);ctx.restore();
  }
  function drawGuidance(){
    const c=$('guidance-display').getContext('2d'),config=room.modules.guidance;c.clearRect(0,0,400,240);c.fillStyle='#08151f';c.fillRect(0,0,400,240);
    c.save();c.translate(200,123);c.strokeStyle='#365a68';c.lineWidth=2;c.beginPath();c.arc(0,0,90,0,Math.PI*2);c.stroke();
    c.strokeStyle='#76b797';c.lineWidth=15;c.beginPath();c.arc(0,0,90,(config.targetAngle-config.angleTolerance-90)*Math.PI/180,(config.targetAngle+config.angleTolerance-90)*Math.PI/180);c.stroke();
    c.rotate(guidance.angle*Math.PI/180);c.strokeStyle='#efcb88';c.lineWidth=5;c.beginPath();c.moveTo(0,15);c.lineTo(0,-82);c.stroke();c.fillStyle='#efcb88';c.fillRect(-6,-6,12,12);c.restore();
    c.font='14px monospace';c.fillStyle='#cfe1e5';c.fillText(`角度 ${guidance.angle.toFixed(1)}°`,12,22);c.fillText(`速度 ${guidance.velocity.toFixed(1)}°/s`,12,222);c.fillText(`目标 ${config.targetAngle}°`,280,22);
    $('guidance-status').textContent=guidance.failed?'训练超时。点击重新训练；失败不会改变任务进度。':`稳定保持 ${(guidance.hold*DT).toFixed(1)} / ${config.holdSeconds} 秒 · 剩余 ${Math.max(0,config.timeLimit-guidance.ticks*DT).toFixed(1)} 秒`;
  }
  function draw(){
    if(!images.size)return;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,room.width,room.height);ctx.drawImage(images.get(room.assets.background),0,0,room.width,room.height);
    const figures=[...room.npcs.map(n=>({...n,npc:true})),{...player,characterId:room.player.characterId,npc:false}].sort((a,b)=>a.y-b.y);
    ctx.save();ctx.beginPath();ctx.rect(room.walkable.x,room.walkable.y,room.walkable.width,room.walkable.height);ctx.clip();
    for(const figure of figures){
      ctx.fillStyle='#02081166';ctx.beginPath();ctx.ellipse(figure.x,figure.y-3,17,6,0,0,Math.PI*2);ctx.fill();sprite(figure.characterId,figure,!figure.npc&&moving&&mode==='explore'&&!paused&&!saveOpen&&!helpOpen);
      // Repaint each foreground rectangle only while this actor is behind its front edge.
      for(const obstacle of room.obstacles)if(figure.y<obstacle.y+obstacle.height-1e-6)ctx.drawImage(images.get(room.assets.background),obstacle.x,obstacle.y,obstacle.width,obstacle.height,obstacle.x,obstacle.y,obstacle.width,obstacle.height);
    }
    ctx.restore();
    if(started&&playerOccluded()){
      drawOccludedOutline();
      ctx.save();ctx.strokeStyle='#f8e1a6';ctx.lineWidth=2;ctx.setLineDash([5,3]);ctx.beginPath();ctx.ellipse(player.x,player.y-3,room.player.body.width/2+5,10,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      ctx.font='14px system-ui';const label=room.player.name,width=ctx.measureText(label).width+14,y=Math.min(room.walkable.y+room.walkable.height-5,player.y+23);ctx.fillStyle='#07111ee8';ctx.fillRect(player.x-width/2,y-15,width,21);ctx.fillStyle='#f8e1a6';ctx.textAlign='center';ctx.fillText(label,player.x,y);ctx.restore();
    }
    if(started&&mode==='explore'&&!paused&&!saveOpen){const target=nearbyTarget(room,player);if(target){ctx.strokeStyle='#edcf92';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(target.x,target.y+4,23,9,0,0,Math.PI*2);ctx.stroke();ctx.font='18px system-ui';ctx.textAlign='center';ctx.fillStyle='#f6e0af';ctx.fillText('E · '+target.label,target.x,target.y-128);ctx.textAlign='left';}}
    if(mode==='guidance')drawGuidance();
  }
  function pause(){if(!started||mode==='ending'||saveOpen||helpOpen)return;paused=true;clearInput();$('pause-overlay').hidden=false;$('resume').focus();updateHud();}
  function resume(){paused=false;clearInput();$('pause-overlay').hidden=true;returnFocus();updateHud();}
  function openSave(){if(!started||helpOpen)return;saveOpen=true;clearInput();$('save-overlay').hidden=false;$('save-status').textContent='导入前会完整校验；无效存档不会覆盖当前旅程。';$('export-save').focus();updateHud();}
  function closeSave(){saveOpen=false;clearInput();$('save-overlay').hidden=true;returnFocus();updateHud();}
  $('start-game').addEventListener('click',start);$('restart').addEventListener('click',()=>{if(started)start();});$('ending-restart').addEventListener('click',start);
  $('interact').addEventListener('click',interact);$('dialogue-next').addEventListener('click',advanceDialogue);$('dialogue-cancel').addEventListener('click',cancelOverlay);
  $('power-check').addEventListener('click',checkPower);$('power-cancel').addEventListener('click',cancelOverlay);$('guidance-cancel').addEventListener('click',cancelOverlay);
  $('power-reset').addEventListener('click',()=>{if(mode!=='power'||paused||saveOpen||helpOpen)return;power=initialPower(room.modules.power);renderPower();$('power-status').textContent='线路已恢复初态。';});
  $('guidance-reset').addEventListener('click',()=>{if(mode!=='guidance'||paused||saveOpen||helpOpen)return;clearInput();guidanceInputs=[];guidance=guidanceInitial(room.modules.guidance);});
  $('pause').addEventListener('click',pause);$('resume').addEventListener('click',resume);$('open-save').addEventListener('click',openSave);$('close-save').addEventListener('click',closeSave);
  $('open-help').addEventListener('click',()=>{if(saveOpen)return;helpOpen=true;clearInput();$('help-overlay').hidden=false;$('close-help').focus();updateHud();});
  function closeHelp(){helpOpen=false;clearInput();$('help-overlay').hidden=true;returnFocus();updateHud();}
  $('close-help').addEventListener('click',closeHelp);
  $('export-save').addEventListener('click',()=>{$('save-data').value=JSON.stringify(createSave(room,fingerprint,player,history,power,guidanceInputs));$('save-status').textContent='存档已生成，可复制保存。';});
  $('import-save').addEventListener('click',()=>{try{const raw=$('save-data').value;if(raw.length>1048576)throw Error('存档过大。');const saved=validateSave(room,fingerprint,JSON.parse(raw));player=saved.player;history=saved.history;story=saved.story;power=saved.power;guidanceInputs=saved.guidanceInputs;guidance=replayGuidance(room.modules.guidance,guidanceInputs);paused=false;dialogue=null;$('pause-overlay').hidden=true;showMode(story.finished?'ending':'explore');$('save-status').textContent='已恢复。关闭存档界面继续。';}catch(error){$('save-status').textContent='无法载入：'+error.message;}});
  document.querySelectorAll('[data-move]').forEach(button=>{const direction=button.dataset.move;button.addEventListener('pointerdown',event=>{if(button.disabled||event.button!==0)return;event.preventDefault();button.setPointerCapture(event.pointerId);touchMoves.add(direction);});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>touchMoves.delete(direction));});
  document.querySelectorAll('[data-guidance]').forEach(button=>{const bit=Number(button.dataset.guidance);button.addEventListener('pointerdown',event=>{if(mode!=='guidance'||paused||saveOpen||helpOpen||event.button!==0)return;event.preventDefault();button.setPointerCapture(event.pointerId);pointerGuidance|=bit;});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{pointerGuidance&=~bit;});});
  window.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey)return;const key=event.key.toLowerCase();
    if(key==='tab'&&activeOverlay()){
      const overlay=activeOverlay(),focusable=[...overlay.querySelectorAll('button:not(:disabled),textarea,a[href],[tabindex="0"]')].filter(node=>node.offsetParent!==null);
      if(focusable.length){const index=focusable.indexOf(document.activeElement);if(index<0||event.shiftKey&&index===0||!event.shiftKey&&index===focusable.length-1){event.preventDefault();focusable[event.shiftKey?focusable.length-1:0].focus();}}return;
    }
    if(event.target instanceof Element&&event.target.closest('textarea,input,select,[contenteditable=true]'))return;
    if(key==='escape'){event.preventDefault();if(helpOpen)closeHelp();else if(saveOpen)closeSave();else if(paused)resume();else if(mode==='explore')pause();else cancelOverlay();return;}
    if(!started||paused||saveOpen||helpOpen)return;
    if(mode==='dialogue'&&(key===' '||key==='enter')&&event.target instanceof Element&&event.target.closest('button'))return;
    if(mode==='dialogue'&&(key==='e'||key===' '||key==='enter')){event.preventDefault();if(!event.repeat)advanceDialogue();return;}
    if(mode==='guidance'&&['arrowleft','arrowright','a','d',' '].includes(key)){event.preventDefault();keys.add(key);return;}
    if(mode!=='explore'||event.target instanceof Element&&event.target.closest('button'))return;
    if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(key)){event.preventDefault();keys.add(key);}
    else if(key==='e'&&!event.repeat){event.preventDefault();interact();}
  });
  window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));window.addEventListener('blur',()=>{clearInput();if(started&&mode!=='ending'&&!saveOpen)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(started&&mode!=='ending'&&!saveOpen)pause();}});
  Object.defineProperty(window,'__ROOM_STATE__',{configurable:false,get:()=>JSON.parse(JSON.stringify({fingerprint,started,mode,paused,saveOpen,helpOpen,player,playerOccluded:playerOccluded(),story,nearby:nearbyTarget(room,player)?.id||null,dialogue:dialogue?{id:dialogue.target.dialogueId,branchId:dialogue.branch.id,index:dialogue.index}:null,power:{rotations:power,solved:powerSolved(room.modules.power,power)},guidance,historyLength:history.length}))});
  function frame(time){const delta=lastTime?Math.min((time-lastTime)/1000,0.1):0;lastTime=time;if(!paused&&!saveOpen&&!helpOpen&&started){accumulator+=delta;let steps=0;while(accumulator>=DT&&steps<6){tick();accumulator=Math.max(0,accumulator-DT);steps++;}if(steps===6)accumulator=0;}else accumulator=0;draw();requestAnimationFrame(frame);}
  function fitRoom(){
    const main=document.querySelector('main'),footer=document.querySelector('footer');
    const availableHeight=Math.max(280,innerHeight-main.getBoundingClientRect().top-footer.getBoundingClientRect().height-40);
    document.documentElement.style.setProperty('--room-width',`${Math.floor(availableHeight*room.width/room.height)}px`);
  }
  window.addEventListener('resize',fitRoom);
  updateHud();fitRoom();
  const paths=new Set([room.assets.background,...room.characters.flatMap(c=>Object.values(c.sheets))]);
  Promise.all([...paths].map(path=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{if(!img.naturalWidth||!img.naturalHeight){reject(Error('资源无法解码：'+path));return;}images.set(path,img);resolve();};img.onerror=()=>reject(Error('资源加载失败：'+path));img.src=path;}))).then(()=>{
    const bg=images.get(room.assets.background);if(bg.naturalWidth!==room.width||bg.naturalHeight!==room.height)throw Error('场景像素尺寸与世界坐标不一致。');
    for(const c of room.characters)for(const path of Object.values(c.sheets)){const img=images.get(path);if(img.naturalWidth!==c.cell.width*4||img.naturalHeight!==c.cell.height)throw Error('角色帧尺寸不匹配：'+path);}
    $('loading-title').textContent=room.title;$('loading-status').textContent='一个任务舱、三位同伴、两项真正可操作的准备工作。';$('start-game').hidden=false;requestAnimationFrame(frame);
  }).catch(error=>{$('loading-title').textContent='素材校验未通过';$('loading-status').textContent=error.message;console.error(error);});
})();
