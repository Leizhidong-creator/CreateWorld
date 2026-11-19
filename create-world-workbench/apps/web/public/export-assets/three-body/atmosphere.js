/* Adapted from existing scenes-v1/preview.js; world-space effects shared with the playable camera. */
window.VillaAtmosphere=(()=>{
let ctx,time=0;
const effects={fire:{x:.24,y:.28,w:.052,h:.052},windows:[]};
for(const [x,w] of [[.591,.025],[.622,.058],[.691,.052],[.75,.049],[.813,.043],[.862,.019]])for(const [y,h] of [[.085,.058],[.155,.109]])effects.windows.push({x,y,w,h});
// Distant fine snow, middle-distance flakes, and a few soft nearby flakes.
// Smooth subpixel travel avoids the old two-pixel stepping and repeating rows.
const exteriorFlakes=Array.from({length:240},(_,i)=>{
  const rand=n=>{const v=Math.sin((i+19)*127.1+n*311.7)*43758.5453;return v-Math.floor(v)};
  const layer=i<140?0:i<220?1:2;
  return {x:rand(1),y:rand(2),phase:rand(3)*Math.PI*2,
    radius:[.55,1.05,1.8][layer]+rand(4)*[.45,.65,.65][layer],
    speed:[17,30,45][layer]+rand(5)*12,
    drift:3+rand(6)*6,sway:3+rand(7)*9,
    alpha:[.23,.43,.52][layer]+rand(8)*.13,layer};
});
const snowSprites=[false,true].map(warm=>{
  const sprite=document.createElement('canvas');sprite.width=sprite.height=32;
  const paint=sprite.getContext('2d'),g=paint.createRadialGradient(16,16,0,16,16,16);
  const color=warm?'245,219,177':'199,214,232';
  g.addColorStop(0,`rgba(${color},1)`);g.addColorStop(.34,`rgba(${color},.9)`);
  g.addColorStop(.68,`rgba(${color},.38)`);g.addColorStop(1,`rgba(${color},0)`);
  paint.fillStyle=g;paint.fillRect(0,0,32,32);return sprite;
});
function exteriorSnow(){
  ctx.save();ctx.imageSmoothingEnabled=true;
  const w=1536,h=1024,margin=40;
  for(const f of exteriorFlakes){
    const y=(f.y*(h+margin*2)+time*f.speed)%(h+margin*2)-margin;
    const wind=Math.sin(time*.24+f.phase*.2)*16;
    const x=((f.x*(w+margin*2)+time*f.drift+wind+Math.sin(time*.7+f.phase)*f.sway)%(w+margin*2)+w+margin*2)%(w+margin*2)-margin;
    const edge=Math.max(0,Math.min(1,(x+10)/35,(w+10-x)/35,(y+10)/35,(h+10-y)/45));
    const light=Math.exp(-(((x-755)/135)**2+((y-760)/105)**2));
    const breath=.94+.06*Math.sin(time*.9+f.phase);
    const size=f.radius*3;
    ctx.globalAlpha=f.alpha*edge*breath;
    ctx.drawImage(snowSprites[0],x-size/2,y-size/2,size,size);
    if(light>.025){ctx.globalAlpha=f.alpha*edge*light*.65;ctx.drawImage(snowSprites[1],x-size/2,y-size/2,size,size)}
  }
  ctx.restore();
}
// One continuous snow field behind ALL panes, so frames occlude flakes naturally.
// Deterministic varied depth, speed and phase; no repeated pattern in each pane.
const windowFlakes=Array.from({length:62},(_,i)=>{
  const rand=n=>{const v=Math.sin((i+1)*127.1+n*311.7)*43758.5453;return v-Math.floor(v)};
  const depth=rand(1);
  return {x:rand(2),y:rand(3),radius:.55+depth*.95,speed:9+depth*15,phase:rand(4)*Math.PI*2,sway:2+rand(5)*5,alpha:.16+depth*.32};
});
function windowSnow(){
  ctx.save();ctx.beginPath();
  for(const r of effects.windows)ctx.rect(r.x*1536,r.y*1024,r.w*1536,r.h*1024);
  ctx.clip();
  const left=900,top=78,width=470,height=215;
  for(const f of windowFlakes){
    const y=(f.y*(height+28)+time*f.speed)%(height+28)-14;
    const breeze=Math.sin(time*.23)*7;
    const x=((f.x*(width+36)+time*3.5+Math.sin(time*.65+f.phase)*f.sway+breeze)%(width+36))-18;
    const fade=Math.max(0,Math.min(1,(y+8)/18,(height+8-y)/18));
    ctx.globalAlpha=f.alpha*fade;ctx.fillStyle='#c5d2df';
    ctx.beginPath();ctx.ellipse(left+x,top+y,f.radius*.8,f.radius,0,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function fire(){
  ctx.save();ctx.globalCompositeOperation='screen';
  const strength=.12+.025*Math.sin(time*5.4)+.015*Math.sin(time*9.1);
  const glow=ctx.createRadialGradient(367,273,5,367,273,105);glow.addColorStop(0,`rgba(255,121,25,${strength})`);glow.addColorStop(1,'rgba(255,100,15,0)');ctx.fillStyle=glow;ctx.fillRect(260,168,215,215);
  ctx.beginPath();ctx.rect(286,214,153,91);ctx.clip();
  for(let j=0;j<10;j++){
    const x=326+j*8.2,y=281+Math.sin(j*2.7)*3,h=17+12*(.5+.5*Math.sin(time*5+j*1.9))+6*Math.sin(time*2.8+j)**2,w=5+2*Math.sin(j*1.4)**2,sway=Math.sin(time*4.1+j*1.7)*4;
    const color=ctx.createLinearGradient(x,y,x,y-h);color.addColorStop(0,'rgba(255,126,20,.38)');color.addColorStop(.32,'rgba(255,171,48,.78)');color.addColorStop(.68,'rgba(248,112,20,.58)');color.addColorStop(1,'rgba(245,83,13,0)');
    ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x-w,y);ctx.bezierCurveTo(x-w*1.8,y-h*.35,x+sway+5,y-h*.55,x+sway,y-h);ctx.bezierCurveTo(x+sway-3,y-h*.55,x+w*1.3,y-h*.3,x+w,y);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,211,111,.42)';ctx.beginPath();ctx.ellipse(x,y-5,w*.42,7+Math.sin(time*6+j)*2,0,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
return {draw(context,scene,seconds){ctx=context;time=seconds;if(scene==='interior'){windowSnow();fire();}else exteriorSnow();}};
})();
