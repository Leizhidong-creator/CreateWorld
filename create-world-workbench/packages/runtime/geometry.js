export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const contains=(r,p)=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
export const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export function distanceToRect(p,r){return Math.hypot(p.x-clamp(p.x,r.x,r.x+r.w),p.y-clamp(p.y,r.y,r.y+r.h));}
export function distanceToSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function pointInPolygon(p,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if(distanceToSegment(p,a,b)<1e-8)return true;if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
export function circleIntersectsShape(p,radius,shape){
  if(shape.type==='circle')return Math.hypot(p.x-shape.x,p.y-shape.y)<radius+shape.r;
  if(shape.type==='polygon'){const points=shape.points;return pointInPolygon(p,points)||points.some((a,i)=>distanceToSegment(p,a,points[(i+1)%points.length])<radius);}
  return distanceToRect(p,shape)<radius;
}
export function bodyAt(p,radius=7){return{x:p.x-radius,y:p.y-radius,w:radius*2,h:radius*2};}
export function sceneSolids(scene,test=(_condition)=>true){return[...(scene.collisions||[]),...(scene.objects||[]).filter(o=>o.solid&&test(o.when)).map(o=>o.solid)];}
export function canStand(p,scene,solids=scene.collisions||[],radius=7){
  if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y)||p.x-radius<0||p.y-radius<0||p.x+radius>scene.width||p.y+radius>scene.height)return false;
  if(scene.walkPolygon){const poly=scene.walkPolygon;if(!pointInPolygon(p,poly)||poly.some((a,i)=>distanceToSegment(p,a,poly[(i+1)%poly.length])<radius))return false;}
  return!solids.some(s=>circleIntersectsShape(p,radius,s));
}
export function moveBody(p,dx,dy,scene,solids,radius=7){const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/Math.max(1,radius/2)));for(let i=0;i<steps;i++){const x={x:p.x+dx/steps,y:p.y};if(canStand(x,scene,solids,radius))p.x=x.x;const y={x:p.x,y:p.y+dy/steps};if(canStand(y,scene,solids,radius))p.y=y.y;}}
export function cameraFor(p,scene,width=640,height=360){const camera=scene.camera||{};return{x:clamp(camera.mode==='fixed'?(camera.x||0):p.x-width/2,0,Math.max(0,scene.width-width)),y:clamp(camera.mode==='fixed'?(camera.y||0):p.y-height/2,0,Math.max(0,scene.height-height))};}
export function worldToMap(p,scene,r){return{x:r.x+p.x/scene.width*r.w,y:r.y+p.y/scene.height*r.h};}
export function imageToWorld(p,scene){const source=scene.sourceSize||{width:scene.width,height:scene.height};return{x:p.x/source.width*scene.width,y:p.y/source.height*scene.height};}
export function worldToImage(p,scene){const source=scene.sourceSize||{width:scene.width,height:scene.height};return{x:p.x/scene.width*source.width,y:p.y/scene.height*source.height};}
export function worldToScreen(p,camera){return{x:p.x-camera.x,y:p.y-camera.y};}
export function screenToWorld(p,camera){return{x:p.x+camera.x,y:p.y+camera.y};}
export function nearestInteraction(p,entries,test=(_condition)=>true){return entries.filter(e=>test(e.when)&&distanceToRect(p,e.rect)<=(e.range??30)).sort((a,b)=>(b.priority||0)-(a.priority||0)||distanceToRect(p,a.rect)-distanceToRect(p,b.rect)||a.id.localeCompare(b.id))[0]||null;}
