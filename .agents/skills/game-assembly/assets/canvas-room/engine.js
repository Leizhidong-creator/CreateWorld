/* Deterministic single-room rules. No DOM, network or writable debug hooks. */
export const FLAGS = ['briefed','powerReady','guidanceReady','eggHumor','eggRain'];
export const DT = 1 / 60;
const copy = value => JSON.parse(JSON.stringify(value));
export function initialStory(){return {briefed:false,powerReady:false,guidanceReady:false,eggHumor:false,eggRain:false,finished:false};}
export function bodyRect(player, body){return {x:player.x-body.width/2,y:player.y-body.height,width:body.width,height:body.height};}
export function overlap(a,b){return a.x < b.x+b.width-1e-7 && a.x+a.width > b.x+1e-7 && a.y < b.y+b.height-1e-7 && a.y+a.height > b.y+1e-7;}
export function blockers(room){return [...room.obstacles,...room.npcs.map(n=>({id:'npc-'+n.id,...bodyRect(n,n.body)}))];}
export function legalPosition(room, player){
  if(!player||!Number.isFinite(player.x)||!Number.isFinite(player.y))return false;
  const box=bodyRect(player,room.player.body),b=room.walkable;
  return box.x>=b.x-1e-7&&box.y>=b.y-1e-7&&box.x+box.width<=b.x+b.width+1e-7&&box.y+box.height<=b.y+b.height+1e-7&&!blockers(room).some(r=>overlap(box,r));
}
export function moveBody(room, player, dx, dy){
  if(!legalPosition(room,player)||!Number.isFinite(dx)||!Number.isFinite(dy))throw Error('invalid movement input');
  const body=room.player.body,b=room.walkable,obstacles=blockers(room),result={...player};
  let x=Math.max(b.x+body.width/2,Math.min(b.x+b.width-body.width/2,player.x+dx));
  for(const r of obstacles){
    if(player.y>r.y+1e-7&&player.y-body.height<r.y+r.height-1e-7){
      if(dx>0&&player.x+body.width/2<=r.x+1e-7)x=Math.min(x,r.x-body.width/2);
      if(dx<0&&player.x-body.width/2>=r.x+r.width-1e-7)x=Math.max(x,r.x+r.width+body.width/2);
    }
  }
  result.x=x;
  let y=Math.max(b.y+body.height,Math.min(b.y+b.height,player.y+dy));
  for(const r of obstacles){
    if(x+body.width/2>r.x+1e-7&&x-body.width/2<r.x+r.width-1e-7){
      if(dy>0&&player.y<=r.y+1e-7)y=Math.min(y,r.y);
      if(dy<0&&player.y-body.height>=r.y+r.height-1e-7)y=Math.max(y,r.y+r.height+body.height);
    }
  }
  result.y=y;return result;
}
function segmentHitsRect(a,b,r){
  let near=0,far=1;
  for(const key of ['x','y']){
    const min=r[key],max=min+(key==='x'?r.width:r.height),delta=b[key]-a[key];
    if(Math.abs(delta)<1e-10){if(a[key]<=min||a[key]>=max)return false;continue;}
    const u=(min-a[key])/delta,v=(max-a[key])/delta;
    near=Math.max(near,Math.min(u,v));far=Math.min(far,Math.max(u,v));
    if(near>=far)return false;
  }
  return near<1-1e-6&&far>1e-6;
}
export function canInteract(room,player,target){
  return Math.hypot(player.x-target.x,player.y-target.y)<=target.range&&
    !room.obstacles.some(r=>segmentHitsRect(player,target,r));
}
export function nearbyTarget(room,player){
  return [...room.npcs.map(n=>({...n,kind:'npc',label:n.name})),...room.hotspots]
    .filter(t=>canInteract(room,player,t)).sort((a,b)=>Math.hypot(player.x-a.x,player.y-a.y)-Math.hypot(player.x-b.x,player.y-b.y)||(a.id<b.id?-1:a.id>b.id?1:0))[0]||null;
}
export function rotateMask(mask,rotation){for(let i=0;i<rotation;i++)mask=((mask<<1)&15)|((mask>>3)&1);return mask;}
export function initialPower(config){return config.tiles.map(t=>t.rotation);}
export function powerSolved(config,rotations){
  if(!Array.isArray(rotations)||rotations.length!==config.tiles.length||rotations.some((r,i)=>!Number.isInteger(r)||r<0||r>3||(config.tiles[i].locked&&r!==config.tiles[i].rotation)))return false;
  const masks=config.tiles.map((t,i)=>rotateMask(t.mask,rotations[i])),n=config.size;
  const start=config.start.row*n+config.start.col,goal=config.goal.row*n+config.goal.col;
  if(!(masks[start]&config.start.port)||!(masks[goal]&config.goal.port))return false;
  const queue=[start],seen=new Set(queue),dirs=[[-1,0,1,4],[0,1,2,8],[1,0,4,1],[0,-1,8,2]];
  while(queue.length){const i=queue.shift();if(i===goal)return true;const row=Math.floor(i/n),col=i%n;
    for(const [dr,dc,port,opposite] of dirs){const r=row+dr,c=col+dc,j=r*n+c;if(r>=0&&r<n&&c>=0&&c<n&&(masks[i]&port)&&(masks[j]&opposite)&&!seen.has(j)){seen.add(j);queue.push(j);}}
  }return false;
}
export function guidanceInitial(config){return {angle:config.initialAngle,velocity:config.initialVelocity,hold:0,ticks:0,success:false,failed:false};}
export function wrapAngle(angle){return ((angle+180)%360+360)%360-180;}
export function guidanceStep(config,old,input){
  if(!Number.isInteger(input)||input<0||input>7)throw Error('invalid guidance input');
  if(old.success||old.failed)return {...old};
  let velocity=old.velocity+((input&2?1:0)-(input&1?1:0))*config.thrust*DT;
  if(input&4)velocity=Math.sign(velocity)*Math.max(0,Math.abs(velocity)-config.brake*DT);
  velocity=Math.max(-120,Math.min(120,velocity));
  const angle=wrapAngle(old.angle+velocity*DT),ticks=old.ticks+1;
  const aligned=Math.abs(wrapAngle(angle-config.targetAngle))<=config.angleTolerance&&Math.abs(velocity)<=config.speedTolerance;
  const hold=aligned?old.hold+1:0,success=hold>=Math.ceil(config.holdSeconds/DT);
  return {angle,velocity,hold,ticks,success,failed:!success&&ticks>=Math.ceil(config.timeLimit/DT)};
}
export function replayGuidance(config,inputs){
  if(!Array.isArray(inputs)||inputs.length>Math.ceil(config.timeLimit/DT))throw Error('invalid guidance trace length');
  let state=guidanceInitial(config);
  for(const input of inputs){if(state.success||state.failed)throw Error('trace continues after guidance stopped');state=guidanceStep(config,state,input);}
  return state;
}
export function dialogueBranch(room,id,story){
  const dialogue=room.dialogues.find(d=>d.id===id);
  return dialogue?.branches.find(b=>Object.entries(b.when).every(([key,value])=>story[key]===value))||null;
}
export function storyEvent(room,story,event){
  if(story.finished)throw Error('journey already finished');
  const next={...story};
  if(event.type==='dialogue'){
    const npc=room.npcs.find(n=>n.id===event.id);if(!npc)throw Error('unknown NPC');
    const branch=dialogueBranch(room,npc.dialogueId,story);if(!branch||branch.id!==event.branchId)throw Error('dialogue branch not available');
    for(const flag of branch.setFlags||[])next[flag]=true;
  }else if(event.type==='power'){
    if(!story.briefed||story.powerReady||!powerSolved(room.modules.power,event.rotations))throw Error('power proof invalid');
    next.powerReady=true;
  }else if(event.type==='guidance'){
    if(!story.briefed||story.guidanceReady||!replayGuidance(room.modules.guidance,event.inputs).success)throw Error('guidance proof invalid');
    next.guidanceReady=true;
  }else if(event.type==='egg'){
    const egg=room.hotspots.find(h=>h.id===event.id&&h.kind==='egg');
    if(!egg||(egg.requires||[]).some(f=>!story[f]))throw Error('egg not available');
    const branch=dialogueBranch(room,egg.dialogueId,story);if(!branch||branch.id!==event.branchId)throw Error('egg dialogue not available');
    next[egg.eggFlag]=true;
  }else if(event.type==='finish'){
    if(!story.briefed||!story.powerReady||!story.guidanceReady)throw Error('preparation incomplete');next.finished=true;
  }else throw Error('unknown story event');
  return next;
}
export function replayStory(room,history){
  if(!Array.isArray(history)||history.length>2000)throw Error('story trace invalid');
  return history.reduce((s,e)=>storyEvent(room,s,e),initialStory());
}
export function commitStoryEvent(room,story,history,event){
  const next=storyEvent(room,story,event),changed=[...FLAGS,'finished'].some(flag=>next[flag]!==story[flag]);
  return {story:next,history:changed?[...history,copy(event)]:history};
}
export function createSave(room,fingerprint,player,history,power,guidanceInputs){
  return {schemaVersion:1,backend:'canvas-room-v1',fingerprint,player:copy(player),history:copy(history),story:replayStory(room,history),power:copy(power),guidanceInputs:copy(guidanceInputs)};
}
export function validateSave(room,fingerprint,save){
  if(!save||save.schemaVersion!==1||save.backend!=='canvas-room-v1'||save.fingerprint!==fingerprint)throw Error('存档属于其他游戏或版本。');
  if(!legalPosition(room,save.player)||!['up','down','left','right'].includes(save.player.direction))throw Error('存档位置不合法。');
  const story=replayStory(room,save.history);
  if(!save.story||Object.keys(save.story).length!==6||[...FLAGS,'finished'].some(key=>typeof save.story[key]!=='boolean'||save.story[key]!==story[key]))throw Error('存档剧情状态与操作证据不一致。');
  const rotations=save.power;
  if(!Array.isArray(rotations)||rotations.length!==room.modules.power.tiles.length||rotations.some((r,i)=>!Number.isInteger(r)||r<0||r>3||(room.modules.power.tiles[i].locked&&r!==room.modules.power.tiles[i].rotation)))throw Error('线路存档无效。');
  const localGuidance=replayGuidance(room.modules.guidance,save.guidanceInputs);
  if(story.powerReady&&!powerSolved(room.modules.power,rotations))throw Error('供电完成标志与线路不一致。');
  if(localGuidance.success!==story.guidanceReady)throw Error('姿态完成标志与训练记录不一致。');
  return copy(save);
}
