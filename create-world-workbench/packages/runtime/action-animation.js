/** A visual action clock; story effects remain owned by the caller's transaction. */
export class ActionAnimator {
 constructor(){this.active=new Map();}
 play(actor,definition,{onEvent=(_name)=>{},signal}={}){
  if(!definition?.frames?.length||!Number.isFinite(definition.fps)||definition.fps<=0)throw Error('Invalid action animation');
  this.cancel(actor);return new Promise((resolve,reject)=>{const current={definition,time:0,fired:new Set(),resolve,reject,onEvent,cleanup:()=>signal?.removeEventListener('abort',abort)};const abort=()=>this.cancel(actor);if(signal?.aborted){reject(new Error('Animation cancelled'));return;}signal?.addEventListener('abort',abort,{once:true});this.active.set(actor,current);});
 }
 tick(dt){for(const [actor,a]of this.active){a.time+=Math.max(0,dt);const index=Math.min(a.definition.frames.length-1,Math.floor(a.time*a.definition.fps));for(const [i,event]of (a.definition.events||[]).entries())if(event.frame<=index&&!a.fired.has(i)){a.fired.add(i);try{a.onEvent(event.name);}catch(e){this.active.delete(actor);a.cleanup();a.reject(e);break;}}if(this.active.get(actor)!==a)continue;if(a.time*a.definition.fps>=a.definition.frames.length){this.active.delete(actor);a.cleanup();a.resolve({completed:true});}}}
 frame(actor){const a=this.active.get(actor);return a?{...a.definition,frame:a.definition.frames[Math.min(a.definition.frames.length-1,Math.floor(a.time*a.definition.fps))]}:null;}
 cancel(actor){const a=this.active.get(actor);if(a){this.active.delete(actor);a.cleanup();a.reject(new Error('Animation cancelled'));}}
 destroy(){for(const actor of this.active.keys())this.cancel(actor);}
}
