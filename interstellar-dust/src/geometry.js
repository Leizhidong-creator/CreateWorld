export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const contains = (r, p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
export const overlaps = (a, b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
export function distanceToRect(p, r) { return Math.hypot(p.x-clamp(p.x,r.x,r.x+r.w), p.y-clamp(p.y,r.y,r.y+r.h)); }
// Position is the character's feet. Collision and visual bounds are intentionally distinct.
export function bodyAt(p, radius = 7) { return { x:p.x-radius, y:p.y-radius, w:radius*2, h:radius*2 }; }
export function canStand(p, scene, solids = scene.collisions || [], radius = 7) {
  const b = bodyAt(p, radius);
  return b.x >= 0 && b.y >= 0 && b.x+b.w <= scene.width && b.y+b.h <= scene.height && !solids.some(r=>overlaps(b,r));
}
export function moveBody(player, dx, dy, scene, solids, radius = 7) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/Math.max(1,radius)));
  for(let i=0;i<steps;i++) {
    const x = {x:player.x+dx/steps,y:player.y}; if(canStand(x,scene,solids,radius)) player.x=x.x;
    const y = {x:player.x,y:player.y+dy/steps}; if(canStand(y,scene,solids,radius)) player.y=y.y;
  }
}
export function cameraFor(player, scene, width=640, height=360) {
  return { x:clamp(player.x-width/2,0,Math.max(0,scene.width-width)), y:clamp(player.y-height/2,0,Math.max(0,scene.height-height)) };
}
export function worldToMap(p, scene, rect) { return {x:rect.x+p.x/scene.width*rect.w,y:rect.y+p.y/scene.height*rect.h}; }
export function nearestInteraction(player, entries, test = ()=>true) {
  return entries.filter(e=>test(e.when) && distanceToRect(player,e.rect)<=(e.range??30))
    .sort((a,b)=>(b.priority||0)-(a.priority||0) || distanceToRect(player,a.rect)-distanceToRect(player,b.rect) || a.id.localeCompare(b.id))[0] || null;
}
