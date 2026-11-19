/** Frames are source-pixel rectangles; anchor is normalized within the drawn frame. */
export function frameFor(def,facing='down',moving=false,time=0){
  const atlas=def.atlas;
  if(atlas?.directions){const frames=atlas.directions[facing]||atlas.directions.down;const index=moving?Math.floor(time*(atlas.fps||8))%frames.length:Math.min(atlas.idleFrame??0,frames.length-1);return frames[index];}
  const cols=atlas?.columns||3,rows=atlas?.rows||{down:0,left:1,right:2,up:3};
  const frame=moving?Math.floor(time*(atlas?.fps||8))%cols:Math.min(atlas?.idleFrame??1,cols-1);
  return{x:frame*def.frameWidth,y:(rows[facing]??rows.down??0)*def.frameHeight,w:def.frameWidth,h:def.frameHeight};
}
export function characterRect(p,def){const w=def.width||26,h=def.height||39,anchor=def.anchor||{x:.5,y:1};return{x:Math.round(p.x-w*anchor.x),y:Math.round(p.y-h*anchor.y),w,h};}
