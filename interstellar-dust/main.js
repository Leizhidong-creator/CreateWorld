import {createGame} from './src/engine.js';
import {story} from './content.js';
import {cameraFor} from './src/geometry.js';
let time=0;
story.hooks={update(id,dt){time+=dt;},render(id,ctx,game){
 const {run}=game.getState();const s=story.scenes.find(s=>s.id===id);const cam=cameraFor(run.player,s);
 ctx.save();
 if(id==='earth'){
  ctx.fillStyle='rgba(209,173,113,.09)';ctx.fillRect(0,0,640,360);
  for(let i=0;i<65;i++){const x=(i*113+time*42)%680-20,y=(i*71+time*8)%360;ctx.fillStyle=i%3?'#ead4a642':'#ead4a680';ctx.fillRect(x,y,2+i%4,1);}
 }else{
  ctx.strokeStyle='#ead6a980';ctx.lineWidth=1;
  for(let i=0;i<9;i++){ctx.beginPath();ctx.moveTo(375+i*6,153);ctx.lineTo(375+i*6,190);ctx.stroke();if(i%3===2){ctx.fillStyle='#ead6a935';ctx.fillRect(375+i*6,153,3,37);}}
 }
 // Small location plaques are world-space decoration, not permanent quest pointers.
 ctx.translate(-cam.x,-cam.y);ctx.font='9px monospace';ctx.textAlign='center';
 const labels=id==='earth'?[[200,253,'HOME'],[550,230,'WORKSHOP'],[1050,245,run.flags.coordinates?'NASA':'· · ·']]:[];
 for(const [x,y,t]of labels){ctx.fillStyle='#172128de';ctx.fillRect(x-32,y-9,64,14);ctx.fillStyle='#ead2a4';ctx.fillText(t,x,y+1);}
 ctx.restore();
}};
document.title='尘埃之外 · 双场景像素剧情';
const game=createGame(story);game.start();
window.addEventListener('pagehide',()=>game.save());
