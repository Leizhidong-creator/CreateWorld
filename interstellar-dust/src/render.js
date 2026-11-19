import { cameraFor, worldToMap } from './geometry.js';
export const VIEW={width:640,height:360};
const hash=(x,y)=>(Math.imul(x+71,374761393)^Math.imul(y+19,668265263))>>>0;
export class Renderer {
  constructor(canvas,resources,config){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.resources=resources;this.config=config;this.camera={x:0,y:0};this.time=0;}
  scene(scene,store,player,target,dt,hold=0){
    const ctx=this.ctx;this.time+=dt;this.camera=cameraFor(player,scene);const cam=this.camera,pal=scene.palette||this.config.theme.world;
    ctx.imageSmoothingEnabled=false;ctx.fillStyle=pal.floor;ctx.fillRect(0,0,640,360);ctx.save();ctx.translate(-Math.round(cam.x),-Math.round(cam.y));
    const bg=this.resources.images.get(scene.background);
    if(bg)ctx.drawImage(bg,0,0,scene.width,scene.height);
    else{
      const tile=32;
      for(let y=Math.floor(cam.y/tile)*tile;y<cam.y+360;y+=tile)for(let x=Math.floor(cam.x/tile)*tile;x<cam.x+640;x+=tile){
        const h=hash(x,y);ctx.fillStyle=h%3===0?pal.floorAlt:pal.floor;ctx.fillRect(x,y,tile,tile);
        ctx.fillStyle=pal.seam;ctx.fillRect(x,y,32,1);ctx.fillRect(x+(y%64?16:0),y,1,32);
        ctx.fillStyle=pal.detail;ctx.fillRect(x+4+h%18,y+7+(h>>>5)%16,2,1);
      }
    }
    for(const r of scene.collisions||[])this.wall(r,pal);
    // Floor decals are not depth sorted; props, NPCs and the player share foot-point sorting.
    const objects=(scene.objects||[]).filter(o=>store.test(o.when));
    for(const o of objects.filter(o=>o.layer==='floor'))this.object(o,pal);
    const entries=objects.filter(o=>o.layer!=='floor').map(o=>({y:o.y+(o.h||32),draw:()=>this.object(o,pal)}));
    for(const npc of scene.npcs||[])if(store.test(npc.when))entries.push({y:npc.y,draw:()=>this.character(npc,this.config.characters.find(c=>c.id===npc.character),false)});
    entries.push({y:player.y,draw:()=>this.character(player,this.config.characters.find(c=>c.id===this.config.player.character),player.moving)});
    entries.sort((a,b)=>a.y-b.y).forEach(e=>e.draw());
    if(target){const r=target.rect;const cx=r.x+r.w/2,cy=r.y-12+Math.round(Math.sin(this.time*3)*2);ctx.fillStyle=this.config.theme.accent;ctx.fillRect(cx-3,cy,6,6);ctx.fillRect(cx-1,cy+6,2,3);}
    if(hold>0){ctx.fillStyle='#151b22';ctx.fillRect(player.x-23,player.y-52,46,5);ctx.fillStyle=this.config.theme.accent;ctx.fillRect(player.x-22,player.y-51,44*hold,3);}
    ctx.restore();
    // Soft perimeter shade keeps readable center and UI contrast without blurring pixels.
    const vignette=ctx.createRadialGradient(320,160,100,320,180,390);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#02080e80');ctx.fillStyle=vignette;ctx.fillRect(0,0,640,360);
  }
  wall(r,p){const c=this.ctx;c.fillStyle=p.wall;c.fillRect(r.x,r.y,r.w,r.h);c.fillStyle=p.wallTop;c.fillRect(r.x,r.y,r.w,Math.min(5,r.h));c.fillStyle=p.shadow;c.fillRect(r.x,r.y+r.h-3,r.w,3);for(let y=r.y+12;y<r.y+r.h;y+=12){c.fillStyle=p.seam;c.fillRect(r.x,y,r.w,1);}}
  object(o,p){
    const c=this.ctx,w=o.w||32,h=o.h||32,x=o.x,y=o.y;
    if(o.asset){const image=this.resources.images.get(o.asset);if(image)c.drawImage(image,x,y,w,h);return;}
    if(o.kind==='rug'){c.fillStyle=o.color||p.cloth;c.fillRect(x,y,w,h);c.strokeStyle=p.trim;c.lineWidth=2;c.strokeRect(x+5,y+5,w-10,h-10);for(let i=8;i<w-5;i+=12){c.fillStyle=p.trim;c.fillRect(x+i,y+9,3,3);c.fillRect(x+i,y+h-12,3,3);}return;}
    if(o.kind==='water'){c.fillStyle=p.water;c.fillRect(x,y,w,h);c.fillStyle=p.wave;for(let yy=8;yy<h;yy+=15)for(let xx=0;xx<w;xx+=35){const offset=Math.floor(this.time*8+yy)%30;c.fillRect(x+((xx+offset)%w),y+yy,Math.min(12,w-((xx+offset)%w)),1);}return;}
    if(o.kind==='lamp'){c.fillStyle='#111b25';c.fillRect(x+w/2-2,y+8,4,h-8);c.fillStyle=p.trim;c.fillRect(x+w/2-8,y+3,16,3);c.fillStyle='#ffdb8c';c.fillRect(x+w/2-5,y+6,10,12);c.fillStyle='#ffedb9';c.fillRect(x+w/2-2,y+8,4,7);return;}
    c.fillStyle=p.shadow;c.fillRect(x+3,y+h-5,w,10);
    if(o.kind==='tree'){c.fillStyle='#5a4136';c.fillRect(x+w*.4,y+h*.45,w*.2,h*.55);for(const [dx,dy,ww,hh] of [[.15,.25,.7,.5],[0,.1,1,.35],[.2,0,.6,.35]]){c.fillStyle=dy===0?p.leafLight:p.leaf;c.fillRect(x+w*dx,y+h*dy,w*ww,h*hh);}c.fillStyle=p.leafLight;c.fillRect(x+w*.1,y+h*.25,w*.3,4);return;}
    if(o.kind==='building'){c.fillStyle=p.wall;c.fillRect(x,y+20,w,h-20);c.fillStyle=p.roof;c.fillRect(x-6,y,w+12,28);for(let yy=5;yy<28;yy+=7){c.fillStyle=p.roofLight;c.fillRect(x-6,y+yy,w+12,2);}c.fillStyle=p.shadow;c.fillRect(x+w/2-10,y+h-32,20,32);c.fillStyle=p.trim;c.fillRect(x+w/2-12,y+h-34,24,3);for(const xx of [x+16,x+w-32]){c.fillStyle='#e1bb70';c.fillRect(xx,y+44,16,18);c.fillStyle=p.wallTop;c.fillRect(xx+7,y+44,2,18);c.fillRect(xx,y+51,16,2);}return;}
    c.fillStyle=o.color||p.wood;c.fillRect(x,y,w,h);c.fillStyle=p.woodLight;c.fillRect(x,y,w,5);c.fillStyle=p.woodDark;c.fillRect(x,y+h-5,w,5);
    if(o.kind==='shelf'){for(let yy=10;yy<h-5;yy+=18){for(let xx=4;xx<w-5;xx+=7){c.fillStyle=['#a96757','#7f9b89','#caaf75','#5d7b95'][Math.floor(xx/7+yy)%4];c.fillRect(x+xx,y+yy,5,12);}c.fillStyle=p.woodLight;c.fillRect(x,y+yy+12,w,3);}}
    if(o.kind==='desk'||o.kind==='crate'){c.fillStyle=p.woodDark;for(let xx=12;xx<w;xx+=16)c.fillRect(x+xx,y+5,1,h-10);}
    if(o.kind==='desk'){c.fillStyle='#e9d6a5';c.fillRect(x+w*.25,y+9,18,12);c.fillStyle='#927951';c.fillRect(x+w*.25+3,y+12,12,1);c.fillRect(x+w*.25+3,y+16,8,1);}
    if(o.kind==='bed'){c.fillStyle=p.cloth;c.fillRect(x+4,y+15,w-8,h-20);c.fillStyle='#ddd7c1';c.fillRect(x+6,y+5,w-12,13);}
    if(o.kind==='sign'){c.fillStyle=p.trim;c.fillRect(x+5,y+6,w-10,2);c.fillRect(x+5,y+12,w-15,2);}
  }
  character(p,def,moving){
    if(!def)return;const c=this.ctx,w=def.width||26,h=def.height||39;
    c.fillStyle='#030c1355';c.fillRect(Math.round(p.x-w*.35),Math.round(p.y-3),w*.7,6);
    const image=this.resources.images.get(def.asset);if(!image)return;
    const row=({down:0,left:1,right:2,up:3})[p.facing||'down']||0;
    // Legacy sheets default to 3 frames / idle column 1. Skill packs retain 4 frames.
    const frame=moving?Math.floor(this.time*1000/(def.frameDuration??125))%(def.frameCount??3):(def.idleFrame??1);
    const anchor=def.footAnchor||{x:def.frameWidth/2,y:def.frameHeight};
    c.drawImage(image,frame*def.frameWidth,row*def.frameHeight,def.frameWidth,def.frameHeight,Math.round(p.x-anchor.x/def.frameWidth*w),Math.round(p.y-anchor.y/def.frameHeight*h),w,h);
  }
}
export function drawMap(canvas,scene,store,quest,config,expanded=false){
  const c=canvas.getContext('2d'),W=canvas.width,H=canvas.height,p=scene.palette||config.theme.world;
  c.imageSmoothingEnabled=false;c.fillStyle='#0d1820';c.fillRect(0,0,W,H);
  const scale=Math.min((W-20)/scene.width,(H-20)/scene.height),r={x:(W-scene.width*scale)/2,y:(H-scene.height*scale)/2,w:scene.width*scale,h:scene.height*scale};
  const rectangle=(v,color)=>{const pt=worldToMap(v,scene,r);c.fillStyle=color;c.fillRect(pt.x,pt.y,v.w*scale,v.h*scale);};
  rectangle({x:0,y:0,w:scene.width,h:scene.height},p.floorAlt);
  for(const wall of scene.collisions||[])rectangle(wall,p.wallTop);
  for(const o of scene.objects||[])if(store.test(o.when)&&o.kind!=='lamp')rectangle({...o,w:o.w||32,h:o.h||32},o.kind==='water'?p.water:'#506364');
  if(config.features?.fog){
    const explored=new Set(store.run.explored[scene.id]||[]),tile=64;
    for(let y=0;y<scene.height;y+=tile)for(let x=0;x<scene.width;x+=tile)if(!explored.has(Math.floor(x/tile)+','+Math.floor(y/tile)))rectangle({x,y,w:Math.min(tile,scene.width-x),h:Math.min(tile,scene.height-y)},'#0d1820');
  }
  for(const mark of scene.landmarks||[]){if(mark.when&&!store.test(mark.when))continue;const pt=worldToMap(mark,scene,r);c.fillStyle='#c1c9c0';c.fillRect(pt.x-2,pt.y-2,4,4);if(expanded){c.font='14px sans-serif';c.textAlign='center';c.fillText(mark.label,pt.x,pt.y-8);}}
  // Region guidance only: hide it on arrival; never show the exact quest object.
  if(quest?.target){
    let target=null;
    if(quest.target.scene===scene.id){const region=scene.regions?.find(v=>v.id===quest.target.region);if(region && !(store.run.player.x>=region.x&&store.run.player.x<=region.x+region.w&&store.run.player.y>=region.y&&store.run.player.y<=region.y+region.h))target=region;}
    else{const visited=new Set([scene.id]),queue=[{id:scene.id,first:null}];while(queue.length&&!target){const next=queue.shift();const s=config.scenes.find(v=>v.id===next.id);for(const exit of s.exits||[]){if(!store.test(exit.when)||visited.has(exit.to))continue;const first=next.first||exit;if(exit.to===quest.target.scene){target=first.rect;break;}visited.add(exit.to);queue.push({id:exit.to,first});}}}
    if(target){const pt=worldToMap({x:target.x+target.w/2,y:target.y+target.h/2},scene,r);c.strokeStyle=config.theme.accent;c.lineWidth=2;c.strokeRect(pt.x-8,pt.y-8,16,16);}
  }
  const player=worldToMap(store.run.player,scene,r);c.fillStyle='#8be3d4';c.beginPath();c.arc(player.x,player.y,expanded?5:3,0,Math.PI*2);c.fill();c.strokeStyle='#fff4cf';c.lineWidth=1;c.strokeRect(r.x,r.y,r.w,r.h);
}
